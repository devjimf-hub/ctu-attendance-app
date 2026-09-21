/**
 * IndexedDB Enterprise Storage Engine for Class Check
 * 
 * Provides robust, asynchronous, multi-gigabyte client-side storage
 * with indexed query capabilities, atomic transactions, and zero external dependencies.
 */

const DB_NAME = 'ClassCheckDB';
const DB_VERSION = 1;

export const STORES = {
  COURSES: 'courses',
  STUDENTS: 'students',
  SESSIONS: 'sessions',
  PROGRAMS: 'programs',
  SUBJECTS: 'subjects',
  SECTIONS: 'sections',
  PENDING_SYNC: 'pending_sync',
  META: 'meta'
} as const;

export type StoreName = typeof STORES[keyof typeof STORES];

class IndexedDbService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private isAvailable: boolean = true;

  constructor() {
    this.initDb();
  }

  private initDb(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    if (typeof window === 'undefined' || !window.indexedDB) {
      this.isAvailable = false;
      return Promise.reject(new Error('IndexedDB is not supported in this environment.'));
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Courses store
          if (!db.objectStoreNames.contains(STORES.COURSES)) {
            const courseStore = db.createObjectStore(STORES.COURSES, { keyPath: 'id' });
            courseStore.createIndex('teacherId', 'teacherId', { unique: false });
            courseStore.createIndex('code', 'code', { unique: false });
          }

          // Students store
          if (!db.objectStoreNames.contains(STORES.STUDENTS)) {
            const studentStore = db.createObjectStore(STORES.STUDENTS, { keyPath: 'id' });
            studentStore.createIndex('courseId', 'courseId', { unique: false });
            studentStore.createIndex('teacherId', 'teacherId', { unique: false });
            studentStore.createIndex('studentId', 'studentId', { unique: false });
          }

          // Sessions store
          if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
            const sessionStore = db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
            sessionStore.createIndex('courseId', 'courseId', { unique: false });
            sessionStore.createIndex('teacherId', 'teacherId', { unique: false });
            sessionStore.createIndex('date', 'date', { unique: false });
          }

          // Curriculum Programs store
          if (!db.objectStoreNames.contains(STORES.PROGRAMS)) {
            const programStore = db.createObjectStore(STORES.PROGRAMS, { keyPath: 'id' });
            programStore.createIndex('code', 'code', { unique: false });
          }

          // Curriculum Subjects store
          if (!db.objectStoreNames.contains(STORES.SUBJECTS)) {
            const subjectStore = db.createObjectStore(STORES.SUBJECTS, { keyPath: 'id' });
            subjectStore.createIndex('programId', 'programId', { unique: false });
          }

          // Curriculum Sections store
          if (!db.objectStoreNames.contains(STORES.SECTIONS)) {
            const sectionStore = db.createObjectStore(STORES.SECTIONS, { keyPath: 'id' });
            sectionStore.createIndex('programId', 'programId', { unique: false });
          }

          // Pending Sync Queue store
          if (!db.objectStoreNames.contains(STORES.PENDING_SYNC)) {
            const pendingStore = db.createObjectStore(STORES.PENDING_SYNC, { keyPath: 'id' });
            pendingStore.createIndex('teacherId', 'teacherId', { unique: false });
            pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
          }

          // Meta / Config store
          if (!db.objectStoreNames.contains(STORES.META)) {
            db.createObjectStore(STORES.META, { keyPath: 'key' });
          }
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = (e) => {
          console.warn('IndexedDB failed to open, falling back to LocalStorage:', e);
          this.isAvailable = false;
          reject(request.error);
        };

        request.onblocked = () => {
          console.warn('IndexedDB blocked by other open tab.');
        };
      } catch (err) {
        console.warn('IndexedDB exception during open:', err);
        this.isAvailable = false;
        reject(err);
      }
    });

    return this.dbPromise;
  }

  public isSupported(): boolean {
    return this.isAvailable;
  }

  /**
   * Get all items from a given store
   */
  public async getAll<T>(storeName: StoreName): Promise<T[]> {
    try {
      const db = await this.initDb();
      return new Promise<T[]>((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          resolve((request.result as T[]) || []);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (err) {
      console.error(`Error in IndexedDB getAll(${storeName}):`, err);
      return [];
    }
  }

  /**
   * Get item by key
   */
  public async get<T>(storeName: StoreName, key: string): Promise<T | null> {
    try {
      const db = await this.initDb();
      return new Promise<T | null>((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => {
          resolve((request.result as T) || null);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (err) {
      console.error(`Error in IndexedDB get(${storeName}, ${key}):`, err);
      return null;
    }
  }

  /**
   * Set (replace) all items in a store atomically
   */
  public async setAll<T extends { id?: string; key?: string }>(storeName: StoreName, items: T[]): Promise<void> {
    try {
      const db = await this.initDb();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        store.clear();
        for (const item of items) {
          store.put(item);
        }

        transaction.oncomplete = () => {
          resolve();
        };

        transaction.onerror = () => {
          reject(transaction.error);
        };
      });
    } catch (err) {
      console.error(`Error in IndexedDB setAll(${storeName}):`, err);
    }
  }

  /**
   * Bulk put (upsert) array of items into a store
   */
  public async putBulk<T extends { id?: string; key?: string }>(storeName: StoreName, items: T[]): Promise<void> {
    if (!items || items.length === 0) return;
    try {
      const db = await this.initDb();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

        for (const item of items) {
          store.put(item);
        }

        transaction.oncomplete = () => {
          resolve();
        };

        transaction.onerror = () => {
          reject(transaction.error);
        };
      });
    } catch (err) {
      console.error(`Error in IndexedDB putBulk(${storeName}):`, err);
    }
  }

  /**
   * Put (upsert) a single item
   */
  public async put<T extends { id?: string; key?: string }>(storeName: StoreName, item: T): Promise<void> {
    try {
      const db = await this.initDb();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(item);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (err) {
      console.error(`Error in IndexedDB put(${storeName}):`, err);
    }
  }

  /**
   * Delete item by key
   */
  public async delete(storeName: StoreName, key: string): Promise<void> {
    try {
      const db = await this.initDb();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (err) {
      console.error(`Error in IndexedDB delete(${storeName}, ${key}):`, err);
    }
  }

  /**
   * Clear all items in a store
   */
  public async clear(storeName: StoreName): Promise<void> {
    try {
      const db = await this.initDb();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (err) {
      console.error(`Error in IndexedDB clear(${storeName}):`, err);
    }
  }
}

export const indexedDbService = new IndexedDbService();
