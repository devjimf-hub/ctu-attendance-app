import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
  getFirestore
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { FirebaseConfig } from '../types';

const STORAGE_KEY_FIREBASE_CONFIG = 'uniattend_firebase_config';

/**
 * Default sample or environment config
 */
export function getSavedFirebaseConfig(): FirebaseConfig | null {
  // Check Vite environment variables first
  if (import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID) {
    return {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ''
    };
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY_FIREBASE_CONFIG);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load saved Firebase config', e);
  }

  return null;
}

export function saveFirebaseConfig(config: FirebaseConfig): void {
  localStorage.setItem(STORAGE_KEY_FIREBASE_CONFIG, JSON.stringify(config));
}

export function removeFirebaseConfig(): void {
  localStorage.removeItem(STORAGE_KEY_FIREBASE_CONFIG);
}

let cachedDb: Firestore | null = null;
let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

export function getFirebaseInstance(): { app: FirebaseApp | null; db: Firestore | null } {
  if (cachedDb && cachedApp) {
    return { app: cachedApp, db: cachedDb };
  }

  const config = getSavedFirebaseConfig();
  if (!config || !config.apiKey || !config.projectId) {
    return { app: null, db: null };
  }

  try {
    const apps = getApps();
    const app = apps.length > 0 ? getApp() : initializeApp(config);
    cachedApp = app;

    try {
      // Enable multi-tab offline persistence for Firestore
      const db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
      cachedDb = db;
      return { app, db };
    } catch {
      // If already initialized, get standard instance
      const db = getFirestore(app);
      cachedDb = db;
      return { app, db };
    }
  } catch (err) {
    console.warn('Firebase initialization notice:', err);
    return { app: null, db: null };
  }
}

export function getFirebaseAuth(): Auth | null {
  if (cachedAuth) return cachedAuth;
  const { app } = getFirebaseInstance();
  if (app) {
    cachedAuth = getAuth(app);
    return cachedAuth;
  }
  return null;
}

export function getFirestoreDb(): Firestore | null {
  return getFirebaseInstance().db;
}

export function resetFirebaseInstance(): void {
  cachedDb = null;
  cachedApp = null;
  cachedAuth = null;
}
