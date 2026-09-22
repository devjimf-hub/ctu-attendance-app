export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type DayCode = 'M' | 'T' | 'W' | 'TH' | 'F' | 'S' | 'SU';

export interface Course {
  id: string;
  teacherId?: string; // Associated Teacher User ID for isolated storage
  code: string; // e.g., "CS-301", "IT-204"
  name: string; // e.g., "Database Management Systems"
  section: string; // e.g., "BSIT 3-A", "CS 2-B"
  semester: string; // e.g., "1st Semester 2026-2027"
  room?: string; // e.g., "Lab 402", "Hall B"
  schedule?: string; // e.g., "MWF 9:00 - 10:30 AM"
  days?: DayCode[]; // e.g., ['M', 'W', 'F'] or ['T', 'TH']
  time?: string; // e.g. "9:00 - 10:30 AM"
  dayTimes?: Partial<Record<DayCode, { startTime: string; endTime: string }>>; // per-day start and end times
  color: string; // Accent color hex
  order?: number; // Custom display sequence order for drag-and-drop
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
  programId?: string; // Associated College Course / Program (e.g. BSIT)
  isLoggedIn: boolean;
}

export interface CurriculumProgram {
  id: string;
  code: string; // e.g., "BSIT", "BSCS"
  name: string; // e.g., "Bachelor of Science in Information Technology"
  department?: string; // e.g., "College of Computer Studies"
  createdByTeacherId?: string; // ID of the teacher who created this program
  createdByTeacherName?: string; // Teacher name for admin reference
  isPublic?: boolean; // If true or undefined (system defaults), visible to everyone; if false, visible only to creator until approved by admin
  createdAt: number;
}

export interface CurriculumSubject {
  id: string;
  programId: string; // Belongs to CurriculumProgram.id
  code: string; // e.g., "IT 204", "CS 301"
  name: string; // e.g., "Database Management Systems"
  units?: number;
  yearLevel?: string; // e.g., "1st Year", "2nd Year", "3rd Year", "4th Year"
  semester?: string; // e.g., "1st Semester", "2nd Semester"
  createdAt: number;
}

export interface MasterStudent {
  id: string;
  studentId: string; // e.g., "2024-00101"
  name: string; // e.g., "Abbott, Hannah"
  email?: string;
  gender?: 'M' | 'F';
}

export interface CurriculumSection {
  id: string;
  programId: string; // Belongs to CurriculumProgram.id
  name: string; // e.g., "BSIT 3-A", "BSIT 2-B"
  yearLevel: string; // e.g., "3rd Year"
  semester?: string;
  students: MasterStudent[];
  createdAt: number;
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
