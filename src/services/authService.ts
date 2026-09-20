import { TeacherUser } from '../types';
import { getFirebaseAuth, getFirestoreDb } from '../firebase/config';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const STORAGE_KEY_AUTH = 'uniattend_teacher_auth';
const STORAGE_KEY_RECENT_ACCOUNTS = 'uniattend_recent_teacher_accounts';

export const authService = {
  getCurrentUser(): TeacherUser | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY_AUTH);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Error loading auth user', e);
    }
    return null;
  },

  getRecentAccounts(): TeacherUser[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_RECENT_ACCOUNTS);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Error loading recent accounts', e);
    }
    return [];
  },

  saveRecentAccount(teacher: TeacherUser): void {
    try {
      const current = this.getRecentAccounts();
      const filtered = current.filter(
        a => a.email.toLowerCase() !== teacher.email.toLowerCase() && a.id !== teacher.id
      );
      // Put most recent at the top, max 5 accounts
      const updated = [teacher, ...filtered].slice(0, 5);
      localStorage.setItem(STORAGE_KEY_RECENT_ACCOUNTS, JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving recent account', e);
    }
  },

  removeRecentAccount(emailOrId: string): TeacherUser[] {
    try {
      const current = this.getRecentAccounts();
      const updated = current.filter(
        a => a.id !== emailOrId && a.email.toLowerCase() !== emailOrId.toLowerCase()
      );
      localStorage.setItem(STORAGE_KEY_RECENT_ACCOUNTS, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Error removing recent account', e);
      return [];
    }
  },

  formatAuthError(error: any): string {
    if (!error) return 'An unknown error occurred.';
    const code = error.code || '';
    const msg = error.message || '';

    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'Incorrect email or password. Please try again.';
      case 'auth/user-not-found':
        return 'No account found with this email. Please register first.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Please sign in instead.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters long.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/network-request-failed':
        return 'Network connection failed. Please check your internet connection.';
      case 'auth/too-many-requests':
        return 'Access temporarily disabled due to many failed attempts. Try again later.';
      default:
        return msg || 'Authentication failed. Please verify your credentials.';
    }
  },

  async loginWithFirebase(email: string, password: string): Promise<TeacherUser> {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error('Firebase Authentication is not configured. Please check your Firebase settings.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const fbUser = userCred.user;

    const safeEmailKey = cleanEmail.replace(/[^a-z0-9]/g, '_');
    let teacherName = fbUser.displayName || cleanEmail.split('@')[0] || 'Faculty Member';
    let teacherDepartment = 'BSIT';
    let teacherProgramId = 'prog_bsit';

    // Try to load extra faculty profile info from Firestore
    try {
      const db = getFirestoreDb();
      if (db) {
        const teacherDocRef = doc(db, 'teachers', fbUser.uid);
        const docSnap = await getDoc(teacherDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.name) teacherName = data.name;
          if (data.department) teacherDepartment = data.department;
          if (data.programId) teacherProgramId = data.programId;
        }
      }
    } catch (err) {
      console.warn('Could not fetch teacher profile from Firestore:', err);
    }

    // Fallback to existing local cached profile if available
    const existing = this.getCurrentUser();
    if (existing && existing.email === cleanEmail) {
      if ((!teacherProgramId || teacherProgramId === 'prog_bsit') && existing.programId) {
        teacherProgramId = existing.programId;
      }
      if ((!teacherDepartment || teacherDepartment === 'College of Technology') && existing.department) {
        teacherDepartment = existing.department;
      }
      if (existing.name && teacherName === 'Faculty Member') {
        teacherName = existing.name;
      }
    }

    const teacher: TeacherUser = {
      id: `teacher_${safeEmailKey}`,
      name: teacherName,
      email: cleanEmail,
      department: teacherDepartment,
      programId: teacherProgramId,
      isLoggedIn: true
    };

    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(teacher));
    this.saveRecentAccount(teacher);
    return teacher;
  },

  async registerWithFirebase(
    name: string,
    email: string,
    password: string,
    department: string = 'BSIT',
    programId: string = 'prog_bsit'
  ): Promise<TeacherUser> {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new Error('Firebase Authentication is not configured. Please check your Firebase settings.');
    }

    const cleanName = name.trim() || 'Faculty Member';
    const cleanEmail = email.trim().toLowerCase();
    const cleanDept = department.trim() || 'BSIT';

    const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    const fbUser = userCred.user;

    try {
      await updateProfile(fbUser, { displayName: cleanName });
    } catch (e) {
      console.warn('Could not update Firebase displayName profile', e);
    }

    const safeEmailKey = cleanEmail.replace(/[^a-z0-9]/g, '_');
    const teacher: TeacherUser = {
      id: `teacher_${safeEmailKey}`,
      name: cleanName,
      email: cleanEmail,
      department: cleanDept,
      programId: programId,
      isLoggedIn: true
    };

    // Save profile to Firestore for cloud persistence across devices
    try {
      const db = getFirestoreDb();
      if (db) {
        const teacherDocRef = doc(db, 'teachers', fbUser.uid);
        await setDoc(teacherDocRef, {
          id: teacher.id,
          uid: fbUser.uid,
          name: cleanName,
          email: cleanEmail,
          department: cleanDept,
          programId: programId,
          createdAt: Date.now()
        }, { merge: true });
      }
    } catch (err) {
      console.warn('Could not store teacher profile in Firestore:', err);
    }

    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(teacher));
    this.saveRecentAccount(teacher);
    return teacher;
  },

  async logout(): Promise<void> {
    const auth = getFirebaseAuth();
    if (auth) {
      try {
        await signOut(auth);
      } catch (e) {
        console.error('Firebase signOut error', e);
      }
    }
    localStorage.removeItem(STORAGE_KEY_AUTH);
  }
};
