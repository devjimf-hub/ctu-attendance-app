export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface Course {
  id: string;
  teacherId?: string; // Associated Teacher User ID for isolated storage
  code: string; // e.g., "CS-301", "IT-204"
  name: string; // e.g., "Database Management Systems"
  section: string; // e.g., "BSIT 3-A", "CS 2-B"
  semester: string; // e.g., "1st Semester 2026-2027"
  room?: string; // e.g., "Lab 402", "Hall B"
  schedule?: string; // e.g., "MWF 9:00 - 10:30 AM"
  color: string; // Accent color hex
  createdAt: number;
}

export interface Student {
  id: string;
  teacherId?: string; // Associated Teacher User ID for isolated storage
  studentId: string; // College ID / Matriculation No (e.g., "2024-01928")
  name: string; // Full Name
  courseId: string; // Associated Course ID
  major?: string; // e.g., "BS Information Technology"
  yearLevel?: string; // e.g., "3rd Year"
  email?: string;
  createdAt: number;
}

export interface AttendanceRecord {
  studentId: string;
  status: AttendanceStatus;
  timestamp: number;
  remarks?: string;
}

export interface AttendanceSession {
  id: string;
  teacherId?: string; // Associated Teacher User ID for isolated storage
  courseId: string;
  date: string; // "YYYY-MM-DD"
  sessionType: 'lecture' | 'lab' | 'tutorial' | 'exam';
  records: Record<string, AttendanceRecord>;
  topic?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TeacherUser {
  id: string;
  name: string;
  email: string;
  department?: string;
  isLoggedIn: boolean;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  measurementId?: string;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingChangesCount: number;
  lastSyncedAt?: number;
  firebaseConnected: boolean;
}

export interface StudentAttendanceSummary {
  student: Student;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  attendancePercentage: number;
  statusCategory: 'good' | 'warning' | 'critical';
}
