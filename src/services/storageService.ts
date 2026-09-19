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
  private dataListeners: (() => void)[] = [];
  private isSyncing = false;
  private currentTeacherId: string | null = null;
  private syncDebounceTimer: any = null;
  private periodicSyncInterval: any = null;

  constructor() {
    this.initializeCurriculumData();

    // Monitor online/offline network transitions
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.notifyStatusChange();
        this.syncWithFirebase(true);
      });
      window.addEventListener('offline', () => {
        this.notifyStatusChange();
      });

      // Background sync when returning to tab
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine && !this.isSyncing) {
          this.syncWithFirebase(false);
        }
      });

      // Periodic auto-sync heartbeat every 3 minutes
      this.periodicSyncInterval = setInterval(() => {
        if (navigator.onLine && !this.isSyncing && !this.syncDebounceTimer) {
          this.syncWithFirebase(false);
        }
      }, 180000);
    }
  }

  public destroy(): void {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = null;
    }
    if (this.periodicSyncInterval) {
      clearInterval(this.periodicSyncInterval);
      this.periodicSyncInterval = null;
    }
  }

  public setActiveTeacher(teacherId: string | null): void {
    this.currentTeacherId = teacherId;
    this.notifyStatusChange();
    if (teacherId) {
      this.syncWithFirebase(true);
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

  public subscribeToDataChange(listener: () => void): () => void {
    this.dataListeners.push(listener);
    return () => {
      this.dataListeners = this.dataListeners.filter(l => l !== listener);
    };
  }

  private notifyStatusChange(): void {
    const status = this.getSyncStatus();
    this.syncListeners.forEach(listener => {
      try {
        listener(status);
      } catch (e) {
        console.error('Error in sync listener:', e);
      }
    });
  }

  private notifyDataChange(): void {
    this.dataListeners.forEach(listener => {
      try {
        listener();
      } catch (e) {
        console.error('Error in data change listener:', e);
      }
    });
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

  /**
   * Smart queue coalescing:
   * Replaces duplicate pending modifications for the same entity with the latest state,
   * keeping the queue small and preventing redundant network payload transfers.
   */
  private addPendingSync(item: Omit<PendingSyncItem, 'id' | 'timestamp'>): void {
    const items = this.getLocalData<PendingSyncItem>(STORAGE_KEYS.PENDING_SYNC);
    const targetTeacherId = item.teacherId || this.currentTeacherId || undefined;
    const entityId = item.data?.id;

    // Check if an entry for this exact entity already exists in the pending queue
    const existingIndex = items.findIndex(
      p => p.type === item.type && p.data?.id === entityId && p.teacherId === targetTeacherId
    );

    const syncItem: PendingSyncItem = {
      ...item,
      teacherId: targetTeacherId,
      id: `${item.type}_${entityId || Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now()
    };

    if (existingIndex >= 0) {
      // Coalesce: Replace with the freshest state
      items[existingIndex] = syncItem;
    } else {
      items.push(syncItem);
    }

    this.setLocalData(STORAGE_KEYS.PENDING_SYNC, items);
    this.notifyStatusChange();
  }

  private removeCommittedPendingItems(committedIds: Set<string>): void {
    const items = this.getLocalData<PendingSyncItem>(STORAGE_KEYS.PENDING_SYNC);
    const remaining = items.filter(item => !committedIds.has(item.id));
    this.setLocalData(STORAGE_KEYS.PENDING_SYNC, remaining);
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
    this.notifyStatusChange();
  }

  /**
   * Schedules a debounced background sync.
   * Eliminates UI lag and network storms during rapid clicks (like roll call attendance).
   */
  public scheduleDebouncedSync(delayMs: number = 800): void {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    this.syncDebounceTimer = setTimeout(() => {
      this.syncDebounceTimer = null;
      this.syncWithFirebase(false);
    }, delayMs);
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

  // --- CURRICULUM ADMIN CRUD (Global Shared & Teacher Custom) ---

  public getPrograms(teacherId?: string, includeAllPrivate: boolean = false): CurriculumProgram[] {
    const all = this.getLocalData<CurriculumProgram>(STORAGE_KEYS.PROGRAMS);
    if (includeAllPrivate) {
      return all;
    }
    const currentId = teacherId || this.currentTeacherId;
    return all.filter(p => {
      // Default system programs or programs approved as public by admin
      if (!p.createdByTeacherId || p.isPublic) {
        return true;
      }
      // Private programs are only accessible to the teacher who added them
      return currentId && p.createdByTeacherId === currentId;
    });
  }

  public getAllPrograms(): CurriculumProgram[] {
    return this.getLocalData<CurriculumProgram>(STORAGE_KEYS.PROGRAMS);
  }

  public getProgramById(programId: string): CurriculumProgram | undefined {
    return this.getAllPrograms().find(p => p.id === programId);
  }

  public saveProgram(program: CurriculumProgram): void {
    const programs = this.getAllPrograms();
    const index = programs.findIndex(p => p.id === program.id);
    if (index >= 0) {
      programs[index] = program;
    } else {
      programs.push(program);
    }
    this.setLocalData(STORAGE_KEYS.PROGRAMS, programs);
    this.addPendingSync({ type: 'program', action: 'upsert', data: program });
    this.scheduleDebouncedSync();
  }

  public toggleProgramPublic(programId: string, isPublic: boolean): void {
    const programs = this.getAllPrograms();
    const target = programs.find(p => p.id === programId);
    if (target) {
      target.isPublic = isPublic;
      this.saveProgram(target);
    }
  }

  public deleteProgram(programId: string): void {
    const programs = this.getAllPrograms().filter(p => p.id !== programId);
    this.setLocalData(STORAGE_KEYS.PROGRAMS, programs);

    // Cascade delete subjects and sections for this program
    const subjects = this.getSubjects().filter(s => s.programId !== programId);
    this.setLocalData(STORAGE_KEYS.SUBJECTS, subjects);

    const sections = this.getSections().filter(sec => sec.programId !== programId);
    this.setLocalData(STORAGE_KEYS.SECTIONS, sections);

    this.addPendingSync({ type: 'program', action: 'delete', data: { id: programId } });
    this.scheduleDebouncedSync();
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
    this.scheduleDebouncedSync();
  }

  public deleteSubject(subjectId: string): void {
    const subjects = this.getLocalData<CurriculumSubject>(STORAGE_KEYS.SUBJECTS).filter(s => s.id !== subjectId);
    this.setLocalData(STORAGE_KEYS.SUBJECTS, subjects);
    this.addPendingSync({ type: 'subject', action: 'delete', data: { id: subjectId } });
    this.scheduleDebouncedSync();
  }

  public getSections(programId?: string): CurriculumSection[] {
    let sections = this.getLocalData<CurriculumSection>(STORAGE_KEYS.SECTIONS);
    if (!sections || sections.length === 0) {
      const sample = getSampleCurriculumData();
      sections = sample.sections;
      this.setLocalData(STORAGE_KEYS.SECTIONS, sections);
    }
    return programId ? sections.filter(s => s.programId === programId) : sections;
  }

  public getSectionById(sectionId: string): CurriculumSection | undefined {
    let sec = this.getSections().find(s => s.id === sectionId || s.name.toLowerCase() === sectionId.toLowerCase());
    if (!sec || !sec.students || sec.students.length === 0) {
      const sample = getSampleCurriculumData();
      const fallbackSec = sample.sections.find(s => s.id === sectionId || s.name.toLowerCase() === sectionId.toLowerCase());
      if (fallbackSec) return fallbackSec;
    }
    return sec;
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
    this.scheduleDebouncedSync();
  }

  public deleteSection(sectionId: string): void {
    const sections = this.getLocalData<CurriculumSection>(STORAGE_KEYS.SECTIONS).filter(s => s.id !== sectionId);
    this.setLocalData(STORAGE_KEYS.SECTIONS, sections);
    this.addPendingSync({ type: 'section', action: 'delete', data: { id: sectionId } });
    this.scheduleDebouncedSync();
  }

  // --- COURSES CRUD (Teacher Isolated) ---

  public getCourses(teacherId?: string): Course[] {
    const targetId = teacherId || this.currentTeacherId;
    const courses = this.getLocalData<Course>(STORAGE_KEYS.COURSES);
    const filtered = !targetId ? courses : courses.filter(c => !c.teacherId || c.teacherId === targetId);
    return filtered.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  public saveCourseOrder(orderedCourses: Course[], teacherId?: string): void {
    const targetTeacherId = teacherId || this.currentTeacherId || undefined;
    const allCourses = this.getLocalData<Course>(STORAGE_KEYS.COURSES);
    const otherCourses = targetTeacherId
      ? allCourses.filter(c => c.teacherId && c.teacherId !== targetTeacherId)
      : [];

    const updatedCourses = orderedCourses.map((c, idx) => ({
      ...c,
      teacherId: targetTeacherId,
      order: idx
    }));

    this.setLocalData(STORAGE_KEYS.COURSES, [...updatedCourses, ...otherCourses]);

    updatedCourses.forEach(c => {
      this.addPendingSync({ type: 'course', action: 'upsert', data: c, teacherId: targetTeacherId });
    });
    this.scheduleDebouncedSync();
  }

  public async saveCourse(course: Course, teacherId?: string): Promise<void> {
    const targetTeacherId = teacherId || course.teacherId || this.currentTeacherId || undefined;
    const courses = this.getLocalData<Course>(STORAGE_KEYS.COURSES);
    const existingIndex = courses.findIndex(c => c.id === course.id);
    const calculatedOrder = course.order !== undefined
      ? course.order
      : existingIndex >= 0
      ? courses[existingIndex].order
      : courses.length;

    const updatedCourse: Course = { ...course, teacherId: targetTeacherId, order: calculatedOrder };

    if (existingIndex >= 0) {
      courses[existingIndex] = updatedCourse;
    } else {
      courses.push(updatedCourse);
    }
    this.setLocalData(STORAGE_KEYS.COURSES, courses);
    this.addPendingSync({ type: 'course', action: 'upsert', data: updatedCourse, teacherId: targetTeacherId });
    this.scheduleDebouncedSync();
  }

  public async saveCourseWithStudents(course: Course, newStudents: Student[], teacherId?: string): Promise<void> {
    const targetTeacherId = teacherId || course.teacherId || this.currentTeacherId || undefined;
    const updatedCourse: Course = { ...course, teacherId: targetTeacherId };

    // 1. Save Course
    const courses = this.getLocalData<Course>(STORAGE_KEYS.COURSES);
    const index = courses.findIndex(c => c.id === updatedCourse.id);
    if (index >= 0) {
      courses[index] = updatedCourse;
    } else {
      courses.push(updatedCourse);
    }
    this.setLocalData(STORAGE_KEYS.COURSES, courses);
    this.addPendingSync({ type: 'course', action: 'upsert', data: updatedCourse, teacherId: targetTeacherId });

    // 2. Save Students together
    if (newStudents && newStudents.length > 0) {
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
    }

    // 3. Trigger debounced sync
    this.scheduleDebouncedSync();
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
    this.scheduleDebouncedSync();
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
    this.scheduleDebouncedSync();
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
    this.scheduleDebouncedSync();
  }

  public async deleteStudent(studentId: string, teacherId?: string): Promise<void> {
    const targetTeacherId = teacherId || this.currentTeacherId || undefined;
    const students = this.getLocalData<Student>(STORAGE_KEYS.STUDENTS).filter(s => s.id !== studentId);
    this.setLocalData(STORAGE_KEYS.STUDENTS, students);
    this.addPendingSync({ type: 'student', action: 'delete', data: { id: studentId }, teacherId: targetTeacherId });
    this.scheduleDebouncedSync();
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
    this.scheduleDebouncedSync();
  }

  public async deleteSession(sessionId: string, teacherId?: string): Promise<void> {
    const targetTeacherId = teacherId || this.currentTeacherId || undefined;
    const sessions = this.getLocalData<AttendanceSession>(STORAGE_KEYS.SESSIONS).filter(s => s.id !== sessionId);
    this.setLocalData(STORAGE_KEYS.SESSIONS, sessions);
    this.addPendingSync({ type: 'session', action: 'delete', data: { id: sessionId }, teacherId: targetTeacherId });
    this.scheduleDebouncedSync();
  }

  // --- FIREBASE SYNC ENGINE ---

  /**
   * Pushes pending local changes to Firestore using write batches.
   * Only clears the specific items that were successfully written.
   */
  public async pushPendingChanges(): Promise<boolean> {
    const { db } = getFirebaseInstance();
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!db || !isOnline) return false;

    const pending = this.getPendingSyncItems();
    if (pending.length === 0) return true;

    // Take snapshot of pending items to push (up to 450 per batch)
    const itemsToCommit = pending.slice(0, 450);
    const committedIds = new Set<string>();

    try {
      const batch = writeBatch(db);
      const teacherId = this.currentTeacherId;

      for (const item of itemsToCommit) {
        let colName = 'courses';
        if (item.type === 'student') colName = 'students';
        else if (item.type === 'session') colName = 'sessions';
        else if (item.type === 'program') colName = 'curriculum_programs';
        else if (item.type === 'subject') colName = 'curriculum_subjects';
        else if (item.type === 'section') colName = 'curriculum_sections';

        const docRef = doc(db, colName, item.data.id);

        if (item.action === 'upsert') {
          const dataToSave: any = { ...item.data };
          const resolvedTeacherId = item.data.teacherId || item.teacherId || (item.type === 'course' || item.type === 'student' || item.type === 'session' ? teacherId || 'default' : undefined);
          if (resolvedTeacherId !== undefined) {
            dataToSave.teacherId = resolvedTeacherId;
          }
          batch.set(docRef, dataToSave, { merge: true });
        } else if (item.action === 'delete') {
          batch.delete(docRef);
        }
        committedIds.add(item.id);
      }

      await batch.commit();
      this.removeCommittedPendingItems(committedIds);
      return true;
    } catch (err) {
      console.warn('Firebase batch push deferred:', err);
      return false;
    }
  }

  /**
   * Pulls remote changes from Firestore and merges them non-destructively.
   */
  public async pullRemoteChanges(): Promise<boolean> {
    const { db } = getFirebaseInstance();
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!db || !isOnline) return false;

    const teacherId = this.currentTeacherId;

    try {
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

      let hasNewData = false;

      // Non-destructive merge for courses
      if (courseSnap && !courseSnap.empty) {
        const localCourses = this.getLocalData<Course>(STORAGE_KEYS.COURSES);
        const courseMap = new Map<string, Course>();
        localCourses.forEach(c => courseMap.set(c.id, c));
        courseSnap.forEach(d => {
          const remoteCourse = d.data() as Course;
          courseMap.set(remoteCourse.id, remoteCourse);
        });
        this.setLocalData(STORAGE_KEYS.COURSES, Array.from(courseMap.values()));
        hasNewData = true;
      }

      // Non-destructive merge for students
      if (studentSnap && !studentSnap.empty) {
        const localStudents = this.getLocalData<Student>(STORAGE_KEYS.STUDENTS);
        const studentMap = new Map<string, Student>();
        localStudents.forEach(s => studentMap.set(s.id, s));
        studentSnap.forEach(d => {
          const remoteStudent = d.data() as Student;
          studentMap.set(remoteStudent.id, remoteStudent);
        });
        this.setLocalData(STORAGE_KEYS.STUDENTS, Array.from(studentMap.values()));
        hasNewData = true;
      }

      // Non-destructive merge for sessions
      if (sessionSnap && !sessionSnap.empty) {
        const localSessions = this.getLocalData<AttendanceSession>(STORAGE_KEYS.SESSIONS);
        const sessionMap = new Map<string, AttendanceSession>();
        localSessions.forEach(s => sessionMap.set(s.id, s));
        sessionSnap.forEach(d => {
          const remoteSession = d.data() as AttendanceSession;
          const local = sessionMap.get(remoteSession.id);
          if (!local || (remoteSession.updatedAt || 0) >= (local.updatedAt || 0)) {
            sessionMap.set(remoteSession.id, remoteSession);
          } else if (local && remoteSession.records) {
            // Merge individual student records non-destructively
            const mergedRecords = { ...remoteSession.records, ...local.records };
            sessionMap.set(local.id, { ...local, records: mergedRecords });
          }
        });
        this.setLocalData(STORAGE_KEYS.SESSIONS, Array.from(sessionMap.values()));
        hasNewData = true;
      }

      // Merge curriculum catalogs non-destructively
      if (progSnap && !progSnap.empty) {
        const localProgs = this.getAllPrograms();
        const progMap = new Map<string, CurriculumProgram>();
        localProgs.forEach(p => progMap.set(p.id, p));
        progSnap.forEach(d => {
          const remoteProg = d.data() as CurriculumProgram;
          progMap.set(remoteProg.id, remoteProg);
        });
        this.setLocalData(STORAGE_KEYS.PROGRAMS, Array.from(progMap.values()));
        hasNewData = true;
      }
      if (subjSnap && !subjSnap.empty) {
        const localSubjs = this.getLocalData<CurriculumSubject>(STORAGE_KEYS.SUBJECTS);
        const subjMap = new Map<string, CurriculumSubject>();
        localSubjs.forEach(s => subjMap.set(s.id, s));
        subjSnap.forEach(d => {
          const remoteSubj = d.data() as CurriculumSubject;
          subjMap.set(remoteSubj.id, remoteSubj);
        });
        this.setLocalData(STORAGE_KEYS.SUBJECTS, Array.from(subjMap.values()));
        hasNewData = true;
      }
      if (secSnap && !secSnap.empty) {
        const localSecs = this.getLocalData<CurriculumSection>(STORAGE_KEYS.SECTIONS);
        const secMap = new Map<string, CurriculumSection>();
        localSecs.forEach(s => secMap.set(s.id, s));
        secSnap.forEach(d => {
          const remoteSec = d.data() as CurriculumSection;
          secMap.set(remoteSec.id, remoteSec);
        });
        this.setLocalData(STORAGE_KEYS.SECTIONS, Array.from(secMap.values()));
        hasNewData = true;
      }

      if (hasNewData) {
        this.notifyDataChange();
      }

      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
      return true;
    } catch (err) {
      console.warn('Firebase pull deferred:', err);
      return false;
    }
  }

  /**
   * Full two-way sync: pushes pending local writes and pulls remote updates.
   */
  public async syncWithFirebase(forcePull: boolean = true): Promise<boolean> {
    const { db } = getFirebaseInstance();
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!db || !isOnline || this.isSyncing) {
      return false;
    }

    this.isSyncing = true;
    this.notifyStatusChange();

    try {
      // 1. Push any queued pending writes first
      await this.pushPendingChanges();

      // 2. Pull remote changes
      if (forcePull) {
        await this.pullRemoteChanges();
      }

      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
      return true;
    } catch (error) {
      console.warn('Firebase sync notice (running local offline):', error);
      return false;
    } finally {
      this.isSyncing = false;
      this.notifyStatusChange();
    }
  }

  public async uploadCurriculumToFirebase(): Promise<{ success: boolean; count: { programs: number; subjects: number; sections: number; students: number } }> {
    const { db } = getFirebaseInstance();
    if (!db) {
      throw new Error('Firebase Firestore is not initialized.');
    }

    const sample = getSampleCurriculumData();
    const programs = this.getPrograms().length > 0 ? this.getPrograms() : sample.programs;
    const subjects = this.getSubjects().length > 0 ? this.getSubjects() : sample.subjects;
    const sections = this.getSections().length > 0 ? this.getSections() : sample.sections;

    let totalStudents = 0;
    const batch = writeBatch(db);

    for (const prog of programs) {
      const docRef = doc(db, 'curriculum_programs', prog.id);
      batch.set(docRef, prog, { merge: true });
    }

    for (const subj of subjects) {
      const docRef = doc(db, 'curriculum_subjects', subj.id);
      batch.set(docRef, subj, { merge: true });
    }

    for (const sec of sections) {
      const docRef = doc(db, 'curriculum_sections', sec.id);
      batch.set(docRef, sec, { merge: true });
      totalStudents += sec.students?.length || 0;
    }

    await batch.commit();

    return {
      success: true,
      count: {
        programs: programs.length,
        subjects: subjects.length,
        sections: sections.length,
        students: totalStudents
      }
    };
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
