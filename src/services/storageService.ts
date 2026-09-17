import {
  collection,
  doc,
  getDocs,
  writeBatch,
  query,
  where
} from 'firebase/firestore';
import {
  Course,
  Student,
  AttendanceSession,
  SyncStatus,
  CurriculumProgram,
  CurriculumSubject,
  CurriculumSection
} from '../types';
import { getFirebaseInstance, getSavedFirebaseConfig } from '../firebase/config';
import { getSampleCurriculumData } from '../utils/collegeUtils';

const STORAGE_KEYS = {
  COURSES: 'uniattend_courses',
  STUDENTS: 'uniattend_students',
  SESSIONS: 'uniattend_sessions',
  PROGRAMS: 'uniattend_curriculum_programs',
  SUBJECTS: 'uniattend_curriculum_subjects',
  SECTIONS: 'uniattend_curriculum_sections',
  PENDING_SYNC: 'uniattend_pending_sync',
  LAST_SYNC: 'uniattend_last_sync'
};

interface PendingSyncItem {
  id: string;
  type: 'course' | 'student' | 'session' | 'program' | 'subject' | 'section';
  action: 'upsert' | 'delete';
  data?: any;
  teacherId?: string;
  timestamp: number;
}

class StorageService {
  private syncListeners: ((status: SyncStatus) => void)[] = [];
  private isSyncing = false;
  private currentTeacherId: string | null = null;

  constructor() {
    this.initializeCurriculumData();

    // Monitor online/offline network transitions
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.notifyStatusChange();
        this.syncWithFirebase();
      });
      window.addEventListener('offline', () => {
        this.notifyStatusChange();
      });
    }
  }

  public setActiveTeacher(teacherId: string | null): void {
    this.currentTeacherId = teacherId;
    this.notifyStatusChange();
    if (teacherId) {
      this.syncWithFirebase();
    }
  }

  public getActiveTeacherId(): string | null {
    return this.currentTeacherId;
  }

  public subscribeToSyncStatus(listener: (status: SyncStatus) => void): () => void {
    this.syncListeners.push(listener);
    listener(this.getSyncStatus());
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== listener);
    };
  }

  private notifyStatusChange(): void {
    const status = this.getSyncStatus();
    this.syncListeners.forEach(listener => listener(status));
  }

  public getSyncStatus(): SyncStatus {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const pending = this.getPendingSyncItems();
    const config = getSavedFirebaseConfig();
    const lastSynced = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);

    return {
      isOnline,
      isSyncing: this.isSyncing,
      pendingChangesCount: pending.length,
      lastSyncedAt: lastSynced ? parseInt(lastSynced, 10) : undefined,
      firebaseConnected: !!(config && config.projectId)
    };
  }

  // --- LOCAL PERSISTENCE HELPERS ---

  private getLocalData<T>(key: string): T[] {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error(`Error reading from localStorage (${key}):`, e);
      return [];
    }
  }

  private setLocalData<T>(key: string, data: T[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`Error writing to localStorage (${key}):`, e);
    }
  }

  private getPendingSyncItems(): PendingSyncItem[] {
    const allPending = this.getLocalData<PendingSyncItem>(STORAGE_KEYS.PENDING_SYNC);
    if (!this.currentTeacherId) return allPending;
    return allPending.filter(p => !p.teacherId || p.teacherId === this.currentTeacherId);
  }

  private addPendingSync(item: Omit<PendingSyncItem, 'id' | 'timestamp'>): void {
    const items = this.getLocalData<PendingSyncItem>(STORAGE_KEYS.PENDING_SYNC);
    const syncItem: PendingSyncItem = {
      ...item,
      teacherId: item.teacherId || this.currentTeacherId || undefined,
      id: `${item.type}_${item.data?.id || Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now()
    };
    items.push(syncItem);
    this.setLocalData(STORAGE_KEYS.PENDING_SYNC, items);
    this.notifyStatusChange();
  }

  private clearPendingSync(teacherId?: string): void {
    if (!teacherId) {
      this.setLocalData(STORAGE_KEYS.PENDING_SYNC, []);
    } else {
      const remaining = this.getLocalData<PendingSyncItem>(STORAGE_KEYS.PENDING_SYNC)
        .filter(item => item.teacherId && item.teacherId !== teacherId);
      this.setLocalData(STORAGE_KEYS.PENDING_SYNC, remaining);
    }
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
    this.notifyStatusChange();
  }

  // --- INITIALIZATION / SEEDING ---

  public initializeCurriculumData(): void {
    const CURRICULUM_VERSION_KEY = 'uniattend_curriculum_v4_ctu_bsit_sections_students';
    const hasCurrentVersion = localStorage.getItem(CURRICULUM_VERSION_KEY);
    const programs = this.getLocalData<CurriculumProgram>(STORAGE_KEYS.PROGRAMS);

    if (programs.length === 0 || !hasCurrentVersion) {
      const sample = getSampleCurriculumData();

      if (programs.length > 0) {
        // Keep non-BSIT subjects and sections, replace BSIT catalog with official CTU sections and student rosters
        const nonBsitSubjects = this.getSubjects().filter(s => s.programId !== 'prog_bsit');
        const newBsitSubjects = sample.subjects.filter(s => s.programId === 'prog_bsit');
        this.setLocalData(STORAGE_KEYS.SUBJECTS, [...newBsitSubjects, ...nonBsitSubjects]);

        const nonBsitSections = this.getSections().filter(sec => sec.programId !== 'prog_bsit');
        const newBsitSections = sample.sections.filter(sec => sec.programId === 'prog_bsit');
        this.setLocalData(STORAGE_KEYS.SECTIONS, [...newBsitSections, ...nonBsitSections]);
      } else {
        this.setLocalData(STORAGE_KEYS.PROGRAMS, sample.programs);
        this.setLocalData(STORAGE_KEYS.SUBJECTS, sample.subjects);
        this.setLocalData(STORAGE_KEYS.SECTIONS, sample.sections);
      }

      localStorage.setItem(CURRICULUM_VERSION_KEY, 'true');
    }
  }

  public initializeDefaultData(_teacherId?: string): void {
    // Ensure shared curriculum programs, subjects, and sections catalog is available
    this.initializeCurriculumData();
  }

  // --- CURRICULUM ADMIN CRUD (Global Shared) ---

  public getPrograms(): CurriculumProgram[] {
    return this.getLocalData<CurriculumProgram>(STORAGE_KEYS.PROGRAMS);
  }

  public getProgramById(programId: string): CurriculumProgram | undefined {
    return this.getPrograms().find(p => p.id === programId);
  }

  public saveProgram(program: CurriculumProgram): void {
    const programs = this.getPrograms();
    const index = programs.findIndex(p => p.id === program.id);
    if (index >= 0) {
      programs[index] = program;
    } else {
      programs.push(program);
    }
    this.setLocalData(STORAGE_KEYS.PROGRAMS, programs);
    this.addPendingSync({ type: 'program', action: 'upsert', data: program });
    this.syncWithFirebase();
  }

  public deleteProgram(programId: string): void {
    const programs = this.getPrograms().filter(p => p.id !== programId);
    this.setLocalData(STORAGE_KEYS.PROGRAMS, programs);

    // Cascade delete subjects and sections for this program
    const subjects = this.getSubjects().filter(s => s.programId !== programId);
    this.setLocalData(STORAGE_KEYS.SUBJECTS, subjects);

    const sections = this.getSections().filter(sec => sec.programId !== programId);
    this.setLocalData(STORAGE_KEYS.SECTIONS, sections);

    this.addPendingSync({ type: 'program', action: 'delete', data: { id: programId } });
    this.syncWithFirebase();
  }

  public getSubjects(programId?: string): CurriculumSubject[] {
    const subjects = this.getLocalData<CurriculumSubject>(STORAGE_KEYS.SUBJECTS);
    return programId ? subjects.filter(s => s.programId === programId) : subjects;
  }

  public saveSubject(subject: CurriculumSubject): void {
    const subjects = this.getLocalData<CurriculumSubject>(STORAGE_KEYS.SUBJECTS);
    const index = subjects.findIndex(s => s.id === subject.id);
    if (index >= 0) {
      subjects[index] = subject;
    } else {
      subjects.push(subject);
    }
    this.setLocalData(STORAGE_KEYS.SUBJECTS, subjects);
    this.addPendingSync({ type: 'subject', action: 'upsert', data: subject });
    this.syncWithFirebase();
  }

  public deleteSubject(subjectId: string): void {
    const subjects = this.getLocalData<CurriculumSubject>(STORAGE_KEYS.SUBJECTS).filter(s => s.id !== subjectId);
    this.setLocalData(STORAGE_KEYS.SUBJECTS, subjects);
    this.addPendingSync({ type: 'subject', action: 'delete', data: { id: subjectId } });
    this.syncWithFirebase();
  }

  public getSections(programId?: string): CurriculumSection[] {
    const sections = this.getLocalData<CurriculumSection>(STORAGE_KEYS.SECTIONS);
    return programId ? sections.filter(s => s.programId === programId) : sections;
  }

  public getSectionById(sectionId: string): CurriculumSection | undefined {
    return this.getSections().find(s => s.id === sectionId);
  }

  public saveSection(section: CurriculumSection): void {
    const sections = this.getLocalData<CurriculumSection>(STORAGE_KEYS.SECTIONS);
    const index = sections.findIndex(s => s.id === section.id);
    if (index >= 0) {
      sections[index] = section;
    } else {
      sections.push(section);
    }
    this.setLocalData(STORAGE_KEYS.SECTIONS, sections);
    this.addPendingSync({ type: 'section', action: 'upsert', data: section });
    this.syncWithFirebase();
  }

  public deleteSection(sectionId: string): void {
    const sections = this.getLocalData<CurriculumSection>(STORAGE_KEYS.SECTIONS).filter(s => s.id !== sectionId);
    this.setLocalData(STORAGE_KEYS.SECTIONS, sections);
    this.addPendingSync({ type: 'section', action: 'delete', data: { id: sectionId } });
    this.syncWithFirebase();
  }

  // --- COURSES CRUD (Teacher Isolated) ---

  public getCourses(teacherId?: string): Course[] {
    const targetId = teacherId || this.currentTeacherId;
    const courses = this.getLocalData<Course>(STORAGE_KEYS.COURSES);
    if (!targetId) return courses;
    return courses.filter(c => !c.teacherId || c.teacherId === targetId);
  }

  public async saveCourse(course: Course, teacherId?: string): Promise<void> {
    const targetTeacherId = teacherId || course.teacherId || this.currentTeacherId || undefined;
    const updatedCourse: Course = { ...course, teacherId: targetTeacherId };

    const courses = this.getLocalData<Course>(STORAGE_KEYS.COURSES);
    const index = courses.findIndex(c => c.id === updatedCourse.id);
    if (index >= 0) {
      courses[index] = updatedCourse;
    } else {
      courses.push(updatedCourse);
    }
    this.setLocalData(STORAGE_KEYS.COURSES, courses);
    this.addPendingSync({ type: 'course', action: 'upsert', data: updatedCourse, teacherId: targetTeacherId });
    this.syncWithFirebase();
  }

  public async deleteCourse(courseId: string, teacherId?: string): Promise<void> {
    const targetTeacherId = teacherId || this.currentTeacherId || undefined;
    const courses = this.getLocalData<Course>(STORAGE_KEYS.COURSES).filter(c => c.id !== courseId);
    this.setLocalData(STORAGE_KEYS.COURSES, courses);

    // Also delete associated students and sessions
    const students = this.getStudents(courseId, targetTeacherId);
    for (const student of students) {
      await this.deleteStudent(student.id, targetTeacherId);
    }

    const sessions = this.getSessions(courseId, targetTeacherId);
    for (const session of sessions) {
      await this.deleteSession(session.id, targetTeacherId);
    }

    this.addPendingSync({ type: 'course', action: 'delete', data: { id: courseId }, teacherId: targetTeacherId });
    this.syncWithFirebase();
  }

  // --- STUDENTS CRUD (Teacher Isolated) ---

  public getStudents(courseId?: string, teacherId?: string): Student[] {
    const targetId = teacherId || this.currentTeacherId;
    let students = this.getLocalData<Student>(STORAGE_KEYS.STUDENTS);
    if (targetId) {
      students = students.filter(s => !s.teacherId || s.teacherId === targetId);
    }
    return courseId ? students.filter(s => s.courseId === courseId) : students;
  }

  public async saveStudent(student: Student, teacherId?: string): Promise<void> {
    const targetTeacherId = teacherId || student.teacherId || this.currentTeacherId || undefined;
    const updatedStudent: Student = { ...student, teacherId: targetTeacherId };

    const students = this.getLocalData<Student>(STORAGE_KEYS.STUDENTS);
    const index = students.findIndex(s => s.id === updatedStudent.id);
    if (index >= 0) {
      students[index] = updatedStudent;
    } else {
      students.push(updatedStudent);
    }
    this.setLocalData(STORAGE_KEYS.STUDENTS, students);
    this.addPendingSync({ type: 'student', action: 'upsert', data: updatedStudent, teacherId: targetTeacherId });
    this.syncWithFirebase();
  }

  public async saveStudentsBulk(newStudents: Student[], teacherId?: string): Promise<void> {
    const targetTeacherId = teacherId || this.currentTeacherId || undefined;
    const allStudents = this.getLocalData<Student>(STORAGE_KEYS.STUDENTS);
    const existingIds = new Set(allStudents.map(s => s.id));
    const combined = [...allStudents];

    for (const s of newStudents) {
      const studentWithTeacher = { ...s, teacherId: targetTeacherId };
      if (!existingIds.has(studentWithTeacher.id)) {
        combined.push(studentWithTeacher);
        this.addPendingSync({ type: 'student', action: 'upsert', data: studentWithTeacher, teacherId: targetTeacherId });
      }
    }

    this.setLocalData(STORAGE_KEYS.STUDENTS, combined);
    this.syncWithFirebase();
  }

  public async deleteStudent(studentId: string, teacherId?: string): Promise<void> {
    const targetTeacherId = teacherId || this.currentTeacherId || undefined;
    const students = this.getLocalData<Student>(STORAGE_KEYS.STUDENTS).filter(s => s.id !== studentId);
    this.setLocalData(STORAGE_KEYS.STUDENTS, students);
    this.addPendingSync({ type: 'student', action: 'delete', data: { id: studentId }, teacherId: targetTeacherId });
    this.syncWithFirebase();
  }

  // --- ATTENDANCE SESSIONS CRUD (Teacher Isolated) ---

  public getSessions(courseId?: string, teacherId?: string): AttendanceSession[] {
    const targetId = teacherId || this.currentTeacherId;
    let sessions = this.getLocalData<AttendanceSession>(STORAGE_KEYS.SESSIONS);
    if (targetId) {
      sessions = sessions.filter(s => !s.teacherId || s.teacherId === targetId);
    }
    return courseId ? sessions.filter(s => s.courseId === courseId) : sessions;
  }

  public getSessionByDate(courseId: string, date: string, sessionType: string = 'lecture', teacherId?: string): AttendanceSession | undefined {
    const sessions = this.getSessions(courseId, teacherId);
    return sessions.find(s => s.date === date && s.sessionType === sessionType);
  }

  public async saveSession(session: AttendanceSession, teacherId?: string): Promise<void> {
    const targetTeacherId = teacherId || session.teacherId || this.currentTeacherId || undefined;
    const updatedSession: AttendanceSession = { ...session, teacherId: targetTeacherId, updatedAt: Date.now() };

    const sessions = this.getLocalData<AttendanceSession>(STORAGE_KEYS.SESSIONS);
    const index = sessions.findIndex(s => s.id === updatedSession.id);
    if (index >= 0) {
      sessions[index] = updatedSession;
    } else {
      sessions.push(updatedSession);
    }
    this.setLocalData(STORAGE_KEYS.SESSIONS, sessions);
    this.addPendingSync({ type: 'session', action: 'upsert', data: updatedSession, teacherId: targetTeacherId });
    this.syncWithFirebase();
  }

  public async deleteSession(sessionId: string, teacherId?: string): Promise<void> {
    const targetTeacherId = teacherId || this.currentTeacherId || undefined;
    const sessions = this.getLocalData<AttendanceSession>(STORAGE_KEYS.SESSIONS).filter(s => s.id !== sessionId);
    this.setLocalData(STORAGE_KEYS.SESSIONS, sessions);
    this.addPendingSync({ type: 'session', action: 'delete', data: { id: sessionId }, teacherId: targetTeacherId });
    this.syncWithFirebase();
  }

  // --- FIREBASE SYNC ENGINE ---

  public async syncWithFirebase(): Promise<boolean> {
    const { db } = getFirebaseInstance();
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const teacherId = this.currentTeacherId;

    if (!db || !isOnline || this.isSyncing) {
      return false;
    }

    this.isSyncing = true;
    this.notifyStatusChange();

    try {
      // 1. Push pending sync queue
      const pending = this.getPendingSyncItems();
      if (pending.length > 0) {
        const batch = writeBatch(db);

        for (const item of pending) {
          let colName = 'courses';
          if (item.type === 'student') colName = 'students';
          else if (item.type === 'session') colName = 'sessions';
          else if (item.type === 'program') colName = 'curriculum_programs';
          else if (item.type === 'subject') colName = 'curriculum_subjects';
          else if (item.type === 'section') colName = 'curriculum_sections';

          const docRef = doc(db, colName, item.data.id);

          if (item.action === 'upsert') {
            const dataToSave = {
              ...item.data,
              teacherId: item.data.teacherId || item.teacherId || (item.type === 'course' || item.type === 'student' || item.type === 'session' ? teacherId || 'default' : undefined)
            };
            batch.set(docRef, dataToSave, { merge: true });
          } else if (item.action === 'delete') {
            batch.delete(docRef);
          }
        }

        await batch.commit();
        this.clearPendingSync(teacherId || undefined);
      }

      // 2. Fetch remote collections
      const coursesQuery = teacherId
        ? query(collection(db, 'courses'), where('teacherId', '==', teacherId))
        : collection(db, 'courses');

      const studentsQuery = teacherId
        ? query(collection(db, 'students'), where('teacherId', '==', teacherId))
        : collection(db, 'students');

      const sessionsQuery = teacherId
        ? query(collection(db, 'sessions'), where('teacherId', '==', teacherId))
        : collection(db, 'sessions');

      const [courseSnap, studentSnap, sessionSnap, progSnap, subjSnap, secSnap] = await Promise.all([
        getDocs(coursesQuery),
        getDocs(studentsQuery),
        getDocs(sessionsQuery),
        getDocs(collection(db, 'curriculum_programs')).catch(() => null),
        getDocs(collection(db, 'curriculum_subjects')).catch(() => null),
        getDocs(collection(db, 'curriculum_sections')).catch(() => null)
      ]);

      // Merge remote items for this teacher into local store
      if (!courseSnap.empty || !studentSnap.empty || !sessionSnap.empty) {
        // Update courses
        const existingCourses = this.getLocalData<Course>(STORAGE_KEYS.COURSES)
          .filter(c => teacherId ? c.teacherId !== teacherId : false);
        const remoteCourses: Course[] = [];
        courseSnap.forEach(d => remoteCourses.push(d.data() as Course));
        this.setLocalData(STORAGE_KEYS.COURSES, [...existingCourses, ...remoteCourses]);

        // Update students
        const existingStudents = this.getLocalData<Student>(STORAGE_KEYS.STUDENTS)
          .filter(s => teacherId ? s.teacherId !== teacherId : false);
        const remoteStudents: Student[] = [];
        studentSnap.forEach(d => remoteStudents.push(d.data() as Student));
        this.setLocalData(STORAGE_KEYS.STUDENTS, [...existingStudents, ...remoteStudents]);

        // Update sessions
        const existingSessions = this.getLocalData<AttendanceSession>(STORAGE_KEYS.SESSIONS)
          .filter(sess => teacherId ? sess.teacherId !== teacherId : false);
        const remoteSessions: AttendanceSession[] = [];
        sessionSnap.forEach(d => remoteSessions.push(d.data() as AttendanceSession));
        this.setLocalData(STORAGE_KEYS.SESSIONS, [...existingSessions, ...remoteSessions]);
      }

      // Merge curriculum data if available in cloud
      if (progSnap && !progSnap.empty) {
        const remoteProgs: CurriculumProgram[] = [];
        progSnap.forEach(d => remoteProgs.push(d.data() as CurriculumProgram));
        this.setLocalData(STORAGE_KEYS.PROGRAMS, remoteProgs);
      }
      if (subjSnap && !subjSnap.empty) {
        const remoteSubjs: CurriculumSubject[] = [];
        subjSnap.forEach(d => remoteSubjs.push(d.data() as CurriculumSubject));
        this.setLocalData(STORAGE_KEYS.SUBJECTS, remoteSubjs);
      }
      if (secSnap && !secSnap.empty) {
        const remoteSecs: CurriculumSection[] = [];
        secSnap.forEach(d => remoteSecs.push(d.data() as CurriculumSection));
        this.setLocalData(STORAGE_KEYS.SECTIONS, remoteSecs);
      }

      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
      this.isSyncing = false;
      this.notifyStatusChange();
      return true;
    } catch (error) {
      console.warn('Firebase sync deferred (working in local offline mode):', error);
      this.isSyncing = false;
      this.notifyStatusChange();
      return false;
    }
  }

  // --- BACKUP & RESTORE ---

  public exportFullBackupJSON(): string {
    const backup = {
      version: '2.0',
      teacherId: this.currentTeacherId,
      exportedAt: new Date().toISOString(),
      programs: this.getPrograms(),
      subjects: this.getSubjects(),
      sections: this.getSections(),
      courses: this.getCourses(),
      students: this.getStudents(),
      sessions: this.getSessions()
    };
    return JSON.stringify(backup, null, 2);
  }

  public importFullBackupJSON(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr);
      if (data.programs && Array.isArray(data.programs)) {
        this.setLocalData(STORAGE_KEYS.PROGRAMS, data.programs);
      }
      if (data.subjects && Array.isArray(data.subjects)) {
        this.setLocalData(STORAGE_KEYS.SUBJECTS, data.subjects);
      }
      if (data.sections && Array.isArray(data.sections)) {
        this.setLocalData(STORAGE_KEYS.SECTIONS, data.sections);
      }
      if (data.courses && Array.isArray(data.courses)) {
        this.setLocalData(STORAGE_KEYS.COURSES, data.courses);
      }
      if (data.students && Array.isArray(data.students)) {
        this.setLocalData(STORAGE_KEYS.STUDENTS, data.students);
      }
      if (data.sessions && Array.isArray(data.sessions)) {
        this.setLocalData(STORAGE_KEYS.SESSIONS, data.sessions);
      }
      this.notifyStatusChange();
      this.syncWithFirebase();
      return true;
    } catch (e) {
      console.error('Invalid backup JSON', e);
      return false;
    }
  }

  public resetAllData(): void {
    localStorage.removeItem(STORAGE_KEYS.COURSES);
    localStorage.removeItem(STORAGE_KEYS.STUDENTS);
    localStorage.removeItem(STORAGE_KEYS.SESSIONS);
    localStorage.removeItem(STORAGE_KEYS.PROGRAMS);
    localStorage.removeItem(STORAGE_KEYS.SUBJECTS);
    localStorage.removeItem(STORAGE_KEYS.SECTIONS);
    localStorage.removeItem(STORAGE_KEYS.PENDING_SYNC);
    localStorage.removeItem(STORAGE_KEYS.LAST_SYNC);
    this.initializeCurriculumData();
    this.initializeDefaultData(this.currentTeacherId || undefined);
    this.notifyStatusChange();
  }
}

export const storageService = new StorageService();
