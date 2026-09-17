import { TeacherUser } from '../types';

const STORAGE_KEY_AUTH = 'uniattend_teacher_auth';

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

  login(name: string, email: string, department: string = 'College Faculty', programId?: string): TeacherUser {
    const cleanName = name.trim() || 'Faculty Member';
    const cleanEmail = email.trim().toLowerCase() || `${cleanName.toLowerCase().replace(/\s+/g, '.') || 'faculty'}@college.edu`;
    const cleanDept = department.trim() || 'College Faculty';

    // Generate stable teacher ID from normalized email
    const safeEmailKey = cleanEmail.replace(/[^a-z0-9]/g, '_');
    const user: TeacherUser = {
      id: `teacher_${safeEmailKey}`,
      name: cleanName,
      email: cleanEmail,
      department: cleanDept,
      programId: programId || 'prog_bsit',
      isLoggedIn: true
    };
    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(user));
    return user;
  },

  logout(): void {
    localStorage.removeItem(STORAGE_KEY_AUTH);
  }
};
