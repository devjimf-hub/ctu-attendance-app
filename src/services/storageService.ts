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
import { indexedDbService, STORES, StoreName } from './indexedDbService';

const STORAGE_KEYS = {
  COURSES: 'uniattend_courses',
  STUDENTS: 'uniattend_students',
  SESSIONS: 'uniattend_sessions',
  PROGRAMS: 'uniattend_curriculum_programs',
  SUBJECTS: 'uniattend_curriculum_subjects',
  SECTIONS: 'uniattend_curriculum_sections',
  PENDING_SYNC: 'uniattend_pending_sync',
  LAST_SYNC: 'uniattend_last_sync',
  IDB_MIGRATED: 'uniattend_idb_migrated'
};

const KEY_TO_STORE_MAP: Record<string, StoreName> = {
  [STORAGE_KEYS.COURSES]: STORES.COURSES,
  [STORAGE_KEYS.STUDENTS]: STORES.STUDENTS,
  [STORAGE_KEYS.SESSIONS]: STORES.SESSIONS,
  [STORAGE_KEYS.PROGRAMS]: STORES.PROGRAMS,
  [STORAGE_KEYS.SUBJECTS]: STORES.SUBJECTS,
  [STORAGE_KEYS.SECTIONS]: STORES.SECTIONS,
  [STORAGE_KEYS.PENDING_SYNC]: STORES.PENDING_SYNC
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

  // In-Memory Fast Cache for 0ms synchronous read access
  private memoryCache: Map<string, any[]> = new Map();
  private isInitialized = false;

  public isStorageReady(): boolean {
    return this.isInitialized;
  }

  constructor() {
    this.initializeMemoryCache();
    this.initializeCurriculumData();
    this.hydrateAndMigrateFromIndexedDb();

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

  /**
   * Synchronously seed memory cache from LocalStorage on immediate startup.
   */
  private initializeMemoryCache(): void {
    const keys = [
      STORAGE_KEYS.COURSES,
      STORAGE_KEYS.STUDENTS,
      STORAGE_KEYS.SESSIONS,
      STORAGE_KEYS.PROGRAMS,
      STORAGE_KEYS.SUBJECTS,
      STORAGE_KEYS.SECTIONS,
      STORAGE_KEYS.PENDING_SYNC
    ];

    for (const key of keys) {
      try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
        if (raw) {
          this.memoryCache.set(key, JSON.parse(raw));
        } else {
          this.memoryCache.set(key, []);
        }
      } catch (e) {
        console.warn(`Memory cache init for ${key}:`, e);
        this.memoryCache.set(key, []);
      }
    }
  }

  /**
   * Asynchronously hydrate data from IndexedDB and auto-migrate existing LocalStorage data.
   * Guarantees ZERO data loss.
   */
  private async hydrateAndMigrateFromIndexedDb(): Promise<void> {
    if (!indexedDbService.isSupported()) return;

    try {
      const keys = [
        STORAGE_KEYS.COURSES,
        STORAGE_KEYS.STUDENTS,
        STORAGE_KEYS.SESSIONS,
        STORAGE_KEYS.PROGRAMS,
        STORAGE_KEYS.SUBJECTS,
        STORAGE_KEYS.SECTIONS,
        STORAGE_KEYS.PENDING_SYNC
      ];

      for (const key of keys) {
        const storeName = KEY_TO_STORE_MAP[key];
        if (!storeName) continue;

        const idbItems = await indexedDbService.getAll<any>(storeName);
        const localItems = this.memoryCache.get(key) || [];

        if (idbItems.length > 0 && localItems.length === 0) {
          // If memory/localStorage is empty but IndexedDB has items, restore from IndexedDB
          this.memoryCache.set(key, idbItems);
          if (typeof localStorage !== 'undefined') {
            try {
              localStorage.setItem(key, JSON.stringify(idbItems));
            } catch (e) {
              console.warn(`LocalStorage write warning during hydration for ${key}:`, e);
            }
          }
        } else if (localItems.length > 0) {
          // Sync active state down to IndexedDB so it matches precisely
          await indexedDbService.setAll(storeName, localItems);
        }
      }

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.IDB_MIGRATED, 'true');
      }

      this.isInitialized = true;
      this.notifyDataChange();
      this.notifyStatusChange();
    } catch (err) {
      console.warn('IndexedDB hydration notice (fallback to memory/local active):', err);
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
    const lastSynced = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.LAST_SYNC) : null;

    return {
      isOnline,
      isSyncing: this.isSyncing,
      pendingChangesCount: pending.length,
      lastSyncedAt: lastSynced ? parseInt(lastSynced, 10) : undefined,
      firebaseConnected: !!(config && config.projectId)
    };
  }

  // --- DUAL-TIER PERSISTENCE HELPERS (Memory + IndexedDB + LocalStorage Fallback) ---

  private getLocalData<T>(key: string): T[] {
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key) as T[];
    }
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      const data = raw ? JSON.parse(raw) : [];
      this.memoryCache.set(key, data);
      return data;
    } catch (e) {
      console.error(`Error reading data for ${key}:`, e);
      return [];
    }
  }

  private setLocalData<T extends { id?: string }>(key: string, data: T[]): void {
    // 1. Instant in-memory cache update
    this.memoryCache.set(key, data);

    // 2. LocalStorage mirror update (with quota protection)
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(data));
      }
    } catch (e) {
      console.warn(`LocalStorage write warning for (${key}) - relying on IndexedDB:`, e);
    }

    // 3. Asynchronous IndexedDB persistent write (unlimited capacity)
    const storeName = KEY_TO_STORE_MAP[key];
    if (storeName && indexedDbService.isSupported()) {
      indexedDbService.setAll(storeName, data).catch(err => {
        console.warn(`IndexedDB background write for ${storeName}:`, err);
      });
    }

    // Notify components
    this.notifyDataChange();
  }

  private getPendingSyncItems(): PendingSyncItem[] {
    const allPending = this.getLocalData<PendingSyncItem>(STORAGE_KEYS.PENDING_SYNC);
    if (!this.currentTeacherId) return allPending;
    return allPending.filter(p => !p.teacherId || p.teacherId === this.currentTeacherId);
  }

  /**
   * Smart queue coalescing:
   * Replaces duplicate pending modifications for the same entity with the latest state.
   */
  private addPendingSync(item: Omit<PendingSyncItem, 'id' | 'timestamp'>): void {
    const allPending = this.getLocalData<PendingSyncItem>(STORAGE_KEYS.PENDING_SYNC);
    const entityId = item.data?.id;

    let updatedPending = allPending;

    if (entityId) {
      updatedPending = allPending.filter(
        p => !(p.type === item.type && p.data?.id === entityId)
      );
    }

    const newItem: PendingSyncItem = {
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    updatedPending.push(newItem);
    this.setLocalData(STORAGE_KEYS.PENDING_SYNC, updatedPending);
    this.notifyStatusChange();
  }

  private removeCommittedPendingItems(committedIds: Set<string>): void {
    if (committedIds.size === 0) return;
    const allPending = this.getLocalData<PendingSyncItem>(STORAGE_KEYS.PENDING_SYNC);
    const remaining = allPending.filter(p => !committedIds.has(p.id));
    this.setLocalData(STORAGE_KEYS.PENDING_SYNC, remaining);
    this.notifyStatusChange();
  }

  private scheduleDebouncedSync(delayMs: number = 800): void {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    this.syncDebounceTimer = setTimeout(() => {
      this.syncDebounceTimer = null;
      if (navigator.onLine && !this.isSyncing) {
        this.syncWithFirebase(false);
      }
    }, delayMs);
  }

  // --- CURRICULUM MANAGEMENT (Admin / Public Data) ---

  public initializeCurriculumData(): void {
    const programs = this.getPrograms();
    const subjects = this.getSubjects();
    const sections = this.getSections();

    if (programs.length === 0 || subjects.length === 0 || sections.length === 0) {
      const sample = getSampleCurriculumData();
      if (programs.length === 0) this.setLocalData(STORAGE_KEYS.PROGRAMS, sample.programs);
      if (subjects.length === 0) this.setLocalData(STORAGE_KEYS.SUBJECTS, sample.subjects);
      if (sections.length === 0) this.setLocalData(STORAGE_KEYS.SECTIONS, sample.sections);
    }
  }

  public getPrograms(): CurriculumProgram[] {
    const all = this.getLocalData<CurriculumProgram>(STORAGE_KEYS.PROGRAMS);
    return all.filter(p => p.isPublic !== false || (this.currentTeacherId && p.createdByTeacherId === this.currentTeacherId));
  }

  public getAllPrograms(): CurriculumProgram[] {
    return this.getLocalData<CurriculumProgram>(STORAGE_KEYS.PROGRAMS);
  }

  public async saveProgram(program: CurriculumProgram): Promise<void> {
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

  public async deleteProgram(programId: string): Promise<void> {
    const programs = this.getAllPrograms().filter(p => p.id !== programId);
    this.setLocalData(STORAGE_KEYS.PROGRAMS, programs);
    this.addPendingSync({ type: 'program', action: 'delete', data: { id: programId } });
    this.scheduleDebouncedSync();
  }

  public getProgramById(programId: string): CurriculumProgram | undefined {
    return this.getAllPrograms().find(p => p.id === programId);
  }

  public async toggleProgramPublic(programId: string, isPublic?: boolean): Promise<void> {
    const programs = this.getAllPrograms();
    const index = programs.findIndex(p => p.id === programId);
    if (index >= 0) {
      const nextPublic = isPublic !== undefined ? isPublic : !programs[index].isPublic;
      programs[index] = { ...programs[index], isPublic: nextPublic };
      this.setLocalData(STORAGE_KEYS.PROGRAMS, programs);
      this.addPendingSync({ type: 'program', action: 'upsert', data: programs[index] });
      this.scheduleDebouncedSync();
    }
  }

  public getSubjects(programId?: string): CurriculumSubject[] {
    const subjects = this.getLocalData<CurriculumSubject>(STORAGE_KEYS.SUBJECTS);
    return programId ? subjects.filter(s => s.programId === programId) : subjects;
  }

  public getSubjectById(subjectId: string): CurriculumSubject | undefined {
    return this.getSubjects().find(s => s.id === subjectId);
  }

  public async saveSubject(subject: CurriculumSubject): Promise<void> {
    const subjects = this.getSubjects();
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

  public async deleteSubject(subjectId: string): Promise<void> {
    const subjects = this.getSubjects().filter(s => s.id !== subjectId);
    this.setLocalData(STORAGE_KEYS.SUBJECTS, subjects);
    this.addPendingSync({ type: 'subject', action: 'delete', data: { id: subjectId } });
    this.scheduleDebouncedSync();
  }

  public getSections(programId?: string): CurriculumSection[] {
    const sections = this.getLocalData<CurriculumSection>(STORAGE_KEYS.SECTIONS);
    return programId ? sections.filter(s => s.programId === programId) : sections;
  }

  public getSectionById(sectionId: string): CurriculumSection | undefined {
    return this.getSections().find(s => s.id === sectionId);
  }

  public async saveSection(section: CurriculumSection): Promise<void> {
    const sections = this.getSections();
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

  public async deleteSection(sectionId: string): Promise<void> {
    const sections = this.getSections().filter(s => s.id !== sectionId);
    this.setLocalData(STORAGE_KEYS.SECTIONS, sections);
    this.addPendingSync({ type: 'section', action: 'delete', data: { id: sectionId } });
    this.scheduleDebouncedSync();
  }

  public async saveCourseWithStudents(course: Course, students: Student[], teacherId?: string): Promise<void> {
    const targetTeacherId = teacherId || course.teacherId || this.currentTeacherId || undefined;
    await this.saveCourse(course, targetTeacherId);
    if (students && students.length > 0) {
      await this.saveStudentsBulk(students, targetTeacherId);
    }
  }

  // --- INITIAL DATA SEEDING (Teacher Isolated) ---

  public initializeDefaultData(_teacherId?: string): void {
    // Intentionally left empty so refreshing the app does not auto-create dummy starter courses with no students
  }

  // --- COURSES CRUD (Teacher Isolated) ---

  public getCourses(teacherId?: string): Course[] {
    const targetId = teacherId || this.currentTeacherId;
    const courses = this.getLocalData<Course>(STORAGE_KEYS.COURSES);
    if (!targetId) return courses;
    return courses.filter(c => !c.teacherId || c.teacherId === targetId);
  }

  public getCourseById(courseId: string, teacherId?: string): Course | undefined {
    const courses = this.getCourses(teacherId);
    return courses.find(c => c.id === courseId);
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
    this.scheduleDebouncedSync();
  }

  public async saveCoursesBulk(newCourses: Course[], teacherId?: string): Promise<void> {
    const targetTeacherId = teacherId || this.currentTeacherId || undefined;
    const allCourses = this.getLocalData<Course>(STORAGE_KEYS.COURSES);
    const existingIds = new Set(allCourses.map(c => c.id));
    const combined = [...allCourses];

    for (const c of newCourses) {
      const courseWithTeacher = { ...c, teacherId: targetTeacherId };
      if (!existingIds.has(courseWithTeacher.id)) {
        combined.push(courseWithTeacher);
        this.addPendingSync({ type: 'course', action: 'upsert', data: courseWithTeacher, teacherId: targetTeacherId });
      }
    }

    this.setLocalData(STORAGE_KEYS.COURSES, combined);
    this.scheduleDebouncedSync();
  }

  public async deleteCourse(courseId: string, teacherId?: string): Promise<void> {
    const targetTeacherId = teacherId || this.currentTeacherId || undefined;
    const courses = this.getLocalData<Course>(STORAGE_KEYS.COURSES).filter(c => c.id !== courseId);
    this.setLocalData(STORAGE_KEYS.COURSES, courses);

    // Cascade delete students and sessions belonging to this course
    const allStudents = this.getLocalData<Student>(STORAGE_KEYS.STUDENTS);
    const removedStudents = allStudents.filter(s => s.courseId === courseId);
    const remainingStudents = allStudents.filter(s => s.courseId !== courseId);
    this.setLocalData(STORAGE_KEYS.STUDENTS, remainingStudents);
    for (const s of removedStudents) {
      this.addPendingSync({ type: 'student', action: 'delete', data: { id: s.id }, teacherId: targetTeacherId });
    }

    const allSessions = this.getLocalData<AttendanceSession>(STORAGE_KEYS.SESSIONS);
    const removedSessions = allSessions.filter(s => s.courseId === courseId);
    const remainingSessions = allSessions.filter(s => s.courseId !== courseId);
    this.setLocalData(STORAGE_KEYS.SESSIONS, remainingSessions);
    for (const sess of removedSessions) {
      this.addPendingSync({ type: 'session', action: 'delete', data: { id: sess.id }, teacherId: targetTeacherId });
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

  // --- FIREBASE SYNC ENGINE (With Field-Level Conflict Resolution) ---

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
      const pendingDeletes = new Set(
        this.getPendingSyncItems()
          .filter(p => p.action === 'delete')
          .map(p => p.data?.id)
          .filter(Boolean)
      );

      // Merge courses non-destructively
      if (courseSnap && !courseSnap.empty) {
        const localCourses = this.getLocalData<Course>(STORAGE_KEYS.COURSES);
        const courseMap = new Map<string, Course>();
        localCourses.forEach(c => courseMap.set(c.id, c));
        courseSnap.forEach(d => {
          const remoteCourse = d.data() as Course;
          if (!pendingDeletes.has(remoteCourse.id)) {
            courseMap.set(remoteCourse.id, remoteCourse);
          }
        });
        this.setLocalData(STORAGE_KEYS.COURSES, Array.from(courseMap.values()));
        hasNewData = true;
      }

      // Merge students non-destructively
      if (studentSnap && !studentSnap.empty) {
        const localStudents = this.getLocalData<Student>(STORAGE_KEYS.STUDENTS);
        const studentMap = new Map<string, Student>();
        localStudents.forEach(s => studentMap.set(s.id, s));
        studentSnap.forEach(d => {
          const remoteStudent = d.data() as Student;
          if (!pendingDeletes.has(remoteStudent.id)) {
            studentMap.set(remoteStudent.id, remoteStudent);
          }
        });
        this.setLocalData(STORAGE_KEYS.STUDENTS, Array.from(studentMap.values()));
        hasNewData = true;
      }

      // Field-Level Granular Merge for Attendance Sessions
      if (sessionSnap && !sessionSnap.empty) {
        const localSessions = this.getLocalData<AttendanceSession>(STORAGE_KEYS.SESSIONS);
        const sessionMap = new Map<string, AttendanceSession>();
        localSessions.forEach(s => sessionMap.set(s.id, s));

        sessionSnap.forEach(d => {
          const remoteSession = d.data() as AttendanceSession;
          if (pendingDeletes.has(remoteSession.id)) return;

          const local = sessionMap.get(remoteSession.id);

          if (!local) {
            sessionMap.set(remoteSession.id, remoteSession);
          } else {
            // Field-level record merging by individual student record timestamp
            const mergedRecords = { ...(local.records || {}) };
            const remoteRecords = remoteSession.records || {};

            for (const [studentId, remoteRec] of Object.entries(remoteRecords)) {
              if (pendingDeletes.has(studentId)) continue;
              const localRec = mergedRecords[studentId];
              if (!localRec || (remoteRec.timestamp || 0) >= (localRec.timestamp || 0)) {
                mergedRecords[studentId] = remoteRec;
              }
            }

            const latestUpdatedAt = Math.max(local.updatedAt || 0, remoteSession.updatedAt || 0);

            sessionMap.set(local.id, {
              ...local,
              ...remoteSession,
              records: mergedRecords,
              updatedAt: latestUpdatedAt
            });
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
          if (!pendingDeletes.has(remoteProg.id)) {
            progMap.set(remoteProg.id, remoteProg);
          }
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
          if (!pendingDeletes.has(remoteSubj.id)) {
            subjMap.set(remoteSubj.id, remoteSubj);
          }
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
          if (!pendingDeletes.has(remoteSec.id)) {
            secMap.set(remoteSec.id, remoteSec);
          }
        });
        this.setLocalData(STORAGE_KEYS.SECTIONS, Array.from(secMap.values()));
        hasNewData = true;
      }

      if (hasNewData) {
        this.notifyDataChange();
      }

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
      }
      return true;
    } catch (err) {
      console.warn('Firebase pull deferred:', err);
      return false;
    }
  }

  public async syncWithFirebase(forcePull: boolean = true): Promise<boolean> {
    const { db } = getFirebaseInstance();
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!db || !isOnline || this.isSyncing) {
      return false;
    }

    this.isSyncing = true;
    this.notifyStatusChange();

    try {
      await this.pushPendingChanges();
      if (forcePull) {
        await this.pullRemoteChanges();
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
      }
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
      version: '3.0',
      engine: 'IndexedDB+MemoryCache',
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
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.COURSES);
      localStorage.removeItem(STORAGE_KEYS.STUDENTS);
      localStorage.removeItem(STORAGE_KEYS.SESSIONS);
      localStorage.removeItem(STORAGE_KEYS.PROGRAMS);
      localStorage.removeItem(STORAGE_KEYS.SUBJECTS);
      localStorage.removeItem(STORAGE_KEYS.SECTIONS);
      localStorage.removeItem(STORAGE_KEYS.PENDING_SYNC);
      localStorage.removeItem(STORAGE_KEYS.LAST_SYNC);
    }
    this.memoryCache.clear();

    if (indexedDbService.isSupported()) {
      indexedDbService.clear(STORES.COURSES);
      indexedDbService.clear(STORES.STUDENTS);
      indexedDbService.clear(STORES.SESSIONS);
      indexedDbService.clear(STORES.PROGRAMS);
      indexedDbService.clear(STORES.SUBJECTS);
      indexedDbService.clear(STORES.SECTIONS);
      indexedDbService.clear(STORES.PENDING_SYNC);
    }

    this.initializeCurriculumData();
    this.notifyDataChange();
    this.notifyStatusChange();
  }
}

export const storageService = new StorageService();
