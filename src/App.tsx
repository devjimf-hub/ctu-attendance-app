import { useState, useEffect, useMemo } from 'react';
import {
  Course,
  Student,
  AttendanceSession,
  AttendanceStatus,
  SyncStatus,
  TeacherUser
} from './types';
import { storageService } from './services/storageService';
import { authService } from './services/authService';
import { calculateStudentSummaries, getLocalDateString } from './utils/collegeUtils';

import { LoginScreen } from './components/LoginScreen';
import { AdminPortal } from './components/AdminPortal';
import { Navbar } from './components/Navbar';
import { OfflineBanner } from './components/OfflineBanner';
import { Dashboard } from './components/Dashboard';
import { SubjectDetail } from './components/SubjectDetail';
import { CourseModal } from './components/CourseModal';
import { StudentBulkModal } from './components/StudentBulkModal';
import { EditStudentModal } from './components/EditStudentModal';
import { RemarksModal } from './components/RemarksModal';
import { SettingsModal } from './components/SettingsModal';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';

import './styles/theme.css';
import './styles/app.css';

// Helper to detect hidden Admin URL route (#/admin, /admin, or ?admin=1)
const checkIsAdminRoute = (): boolean => {
  const hash = window.location.hash.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();
  const search = new URLSearchParams(window.location.search);
  return (
    hash.includes('admin') ||
    pathname.endsWith('/admin') ||
    pathname.includes('/admin/') ||
    search.has('admin')
  );
};

export function App() {
  // Authentication State
  const [teacher, setTeacher] = useState<TeacherUser | null>(() => authService.getCurrentUser());

  // Admin Portal Mode (syncs with URL #/admin or ?admin=true)
  const [isAdminPortalOpen, setIsAdminPortalOpen] = useState<boolean>(() => checkIsAdminRoute());

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('uniattend_theme') as 'dark' | 'light') || 'light';
  });

  // Navigation State: null means in Dashboard (list of subjects), courseId means inside Subject
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // Core Data
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);

  // Roll Call Active Parameters
  const [currentDate, setCurrentDate] = useState<string>(() => getLocalDateString());
  const [currentSessionType, setCurrentSessionType] = useState<'lecture' | 'lab' | 'tutorial' | 'exam'>('lecture');
  const [currentTopic, setCurrentTopic] = useState<string>('');

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(storageService.getSyncStatus());

  // Modal States
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const [isBulkStudentModalOpen, setIsBulkStudentModalOpen] = useState(false);
  const [isEditStudentModalOpen, setIsEditStudentModalOpen] = useState(false);
  const [selectedStudentForEdit, setSelectedStudentForEdit] = useState<Student | null>(null);

  const [isRemarksModalOpen, setIsRemarksModalOpen] = useState(false);
  const [selectedStudentForRemark, setSelectedStudentForRemark] = useState<Student | null>(null);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // PWA Install Prompt
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Load Data & Teacher Sync
  useEffect(() => {
    if (teacher) {
      storageService.setActiveTeacher(teacher.id);
      storageService.initializeDefaultData(teacher.id);
      refreshLocalData();
    } else {
      storageService.setActiveTeacher(null);
      setCourses([]);
      setStudents([]);
      setSessions([]);
    }

    const unsubscribeSync = storageService.subscribeToSyncStatus(status => {
      setSyncStatus(status);
    });

    const unsubscribeData = storageService.subscribeToDataChange(() => {
      refreshLocalData();
    });

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      unsubscribeSync();
      unsubscribeData();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, [teacher]);

  // Theme Sync
  useEffect(() => {
    document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
    localStorage.setItem('uniattend_theme', theme);
  }, [theme]);

  // URL Routing Sync for Admin Portal (#/admin, /admin, ?admin)
  useEffect(() => {
    const syncAdminRoute = () => {
      setIsAdminPortalOpen(checkIsAdminRoute());
    };

    window.addEventListener('hashchange', syncAdminRoute);
    window.addEventListener('popstate', syncAdminRoute);
    return () => {
      window.removeEventListener('hashchange', syncAdminRoute);
      window.removeEventListener('popstate', syncAdminRoute);
    };
  }, []);

  const refreshLocalData = () => {
    const teacherId = teacher?.id;
    const loadedCourses = storageService.getCourses(teacherId);
    setCourses(loadedCourses);
    setStudents(storageService.getStudents(undefined, teacherId));
    setSessions(storageService.getSessions(undefined, teacherId));
  };

  // Active Subject Data
  const activeCourse = useMemo(() => {
    return courses.find(c => c.id === selectedCourseId) || null;
  }, [courses, selectedCourseId]);

  const activeCourseStudents = useMemo(() => {
    return selectedCourseId ? students.filter(s => s.courseId === selectedCourseId) : [];
  }, [students, selectedCourseId]);

  const activeCourseSessions = useMemo(() => {
    return selectedCourseId ? sessions.filter(s => s.courseId === selectedCourseId) : [];
  }, [sessions, selectedCourseId]);

  // Current Session Object
  const currentSession = useMemo<AttendanceSession>(() => {
    if (!selectedCourseId) {
      return {
        id: '',
        courseId: '',
        date: currentDate,
        sessionType: currentSessionType,
        records: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    }

    const existing = activeCourseSessions.find(
      s => s.date === currentDate && s.sessionType === currentSessionType
    );

    if (existing) return existing;

    return {
      id: `${selectedCourseId}_${currentDate}_${currentSessionType}`,
      courseId: selectedCourseId,
      date: currentDate,
      sessionType: currentSessionType,
      topic: currentTopic,
      records: {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }, [activeCourseSessions, selectedCourseId, currentDate, currentSessionType, currentTopic]);

  // Student Attendance Summaries for active subject
  const studentSummaries = useMemo(() => {
    return calculateStudentSummaries(activeCourseStudents, activeCourseSessions);
  }, [activeCourseStudents, activeCourseSessions]);

  // Handlers
  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleLogout = async () => {
    await authService.logout();
    setTeacher(null);
    setSelectedCourseId(null);
  };

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setShowInstallPrompt(false);
      setDeferredPrompt(null);
    }
  };

  // Course Actions
  const handleSaveCourse = async (course: Course, selectedSectionId?: string) => {
    let newStudents: Student[] = [];

    // If teacher selected an existing block section, auto-enroll that section's students!
    if (selectedSectionId) {
      const sec = storageService.getSectionById(selectedSectionId);
      if (sec && sec.students && sec.students.length > 0) {
        newStudents = sec.students.map((ms, idx) => ({
          id: `stu_${course.id}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          teacherId: teacher?.id,
          studentId: ms.studentId,
          name: ms.name,
          email: ms.email,
          courseId: course.id,
          major: sec.name,
          yearLevel: sec.yearLevel,
          createdAt: Date.now()
        }));
      }
    }

    // Save Course and Students together atomically
    await storageService.saveCourseWithStudents(course, newStudents, teacher?.id);

    refreshLocalData();
    setSelectedCourseId(course.id);
  };

  const handleDeleteCourse = async (courseId: string) => {
    await storageService.deleteCourse(courseId);
    refreshLocalData();
    if (selectedCourseId === courseId) {
      setSelectedCourseId(null);
    }
  };

  // Student Actions
  const handleAddStudents = async (newStudents: Student[]) => {
    await storageService.saveStudentsBulk(newStudents);
    refreshLocalData();
  };

  const handleEditStudent = async (updatedStudent: Student) => {
    await storageService.saveStudent(updatedStudent);
    refreshLocalData();
  };

  const handleDeleteStudent = async (studentId: string) => {
    await storageService.deleteStudent(studentId);
    refreshLocalData();
  };

  // Roll Call Actions
  const handleUpdateRecord = async (studentId: string, status: AttendanceStatus) => {
    if (!selectedCourseId) return;

    const updatedRecords = {
      ...currentSession.records,
      [studentId]: {
        studentId,
        status,
        timestamp: Date.now(),
        remarks: currentSession.records[studentId]?.remarks
      }
    };

    const updatedSession: AttendanceSession = {
      ...currentSession,
      records: updatedRecords,
      updatedAt: Date.now()
    };

    await storageService.saveSession(updatedSession);
    refreshLocalData();
  };

  const handleBulkUpdateStatus = async (status: AttendanceStatus, targetStudents?: Student[]) => {
    if (!selectedCourseId) return;

    const targets = targetStudents || activeCourseStudents;
    const updatedRecords = { ...currentSession.records };

    targets.forEach(s => {
      updatedRecords[s.id] = {
        studentId: s.id,
        status,
        timestamp: Date.now(),
        remarks: currentSession.records[s.id]?.remarks
      };
    });

    const updatedSession: AttendanceSession = {
      ...currentSession,
      records: updatedRecords,
      updatedAt: Date.now()
    };

    await storageService.saveSession(updatedSession);
    refreshLocalData();
  };

  const handleSaveRemark = async (studentId: string, remark: string) => {
    if (!selectedCourseId) return;

    const existing = currentSession.records[studentId] || {
      studentId,
      status: 'present' as AttendanceStatus,
      timestamp: Date.now()
    };

    const updatedRecords = {
      ...currentSession.records,
      [studentId]: {
        ...existing,
        remarks: remark
      }
    };

    const updatedSession: AttendanceSession = {
      ...currentSession,
      records: updatedRecords,
      updatedAt: Date.now()
    };

    await storageService.saveSession(updatedSession);
    refreshLocalData();
  };

  // Handler to close Admin Portal and reset URL
  const handleCloseAdminPortal = () => {
    if (window.location.hash.toLowerCase().includes('admin')) {
      window.location.hash = '';
    }
    if (new URLSearchParams(window.location.search).has('admin')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('admin');
      window.history.replaceState(null, '', url.pathname + (url.hash || ''));
    }
    if (window.location.pathname.toLowerCase().includes('/admin')) {
      window.history.pushState(null, '', '/' + (window.location.hash || ''));
    }
    setIsAdminPortalOpen(false);
  };

  // If Admin Portal is active, show Admin Portal
  if (isAdminPortalOpen) {
    return <AdminPortal onBackToTeacherPortal={handleCloseAdminPortal} />;
  }

  // If teacher is not signed in, show clean Login Screen
  if (!teacher) {
    return (
      <LoginScreen
        onLoginSuccess={user => setTeacher(user)}
      />
    );
  }

  return (
    <div className="app-layout">
      {/* Google Classroom Mobile-First Header */}
      <Navbar
        syncStatus={syncStatus}
        theme={theme}
        teacher={teacher}
        onToggleTheme={handleToggleTheme}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onManualSync={() => storageService.syncWithFirebase()}
        onLogout={handleLogout}
        canInstallPwa={!!deferredPrompt}
        onInstallPwa={handleInstallPwa}
      />

      {/* Offline Alert */}
      <OfflineBanner
        syncStatus={syncStatus}
        onRetrySync={() => storageService.syncWithFirebase()}
      />

      {/* Main View Area */}
      <main className="main-wrapper">
        {!selectedCourseId || !activeCourse ? (
          /* VIEW 1: DASHBOARD (List of Created Subjects) */
          <Dashboard
            courses={courses}
            students={students}
            onSelectCourse={id => setSelectedCourseId(id)}
            onOpenCreateCourse={() => {
              setEditingCourse(null);
              setIsCourseModalOpen(true);
            }}
            onEditCourse={course => {
              setEditingCourse(course);
              setIsCourseModalOpen(true);
            }}
            onDeleteCourse={handleDeleteCourse}
          />
        ) : (
          /* VIEW 2: SUBJECT DETAIL (Inside Subject with Roll Call, Students, Print Summary) */
          <SubjectDetail
            course={activeCourse}
            students={activeCourseStudents}
            session={currentSession}
            sessions={activeCourseSessions}
            summaries={studentSummaries}
            teacher={teacher}
            onBackToDashboard={() => setSelectedCourseId(null)}
            onUpdateRecord={handleUpdateRecord}
            onBulkUpdateStatus={handleBulkUpdateStatus}
            onUpdateSessionDate={date => setCurrentDate(date)}
            onUpdateSessionType={type => setCurrentSessionType(type)}
            onUpdateSessionTopic={topic => setCurrentTopic(topic)}
            onOpenRemarkModal={student => {
              setSelectedStudentForRemark(student);
              setIsRemarksModalOpen(true);
            }}
            onOpenAddStudents={() => setIsBulkStudentModalOpen(true)}
            onOpenEditCourse={c => {
              setEditingCourse(c);
              setIsCourseModalOpen(true);
            }}
            onDeleteStudent={handleDeleteStudent}
            onEditStudent={s => {
              setSelectedStudentForEdit(s);
              setIsEditStudentModalOpen(true);
            }}
          />
        )}
      </main>

      {/* Floating PWA Install Prompt */}
      {showInstallPrompt && (
        <PWAInstallPrompt
          onInstall={handleInstallPwa}
          onDismiss={() => setShowInstallPrompt(false)}
        />
      )}

      {/* Modals */}
      <CourseModal
        isOpen={isCourseModalOpen}
        onClose={() => {
          setIsCourseModalOpen(false);
          setEditingCourse(null);
        }}
        onSave={handleSaveCourse}
        onDelete={handleDeleteCourse}
        initialCourse={editingCourse}
        teacherProgramId={teacher?.programId}
      />

      {activeCourse && (
        <StudentBulkModal
          isOpen={isBulkStudentModalOpen}
          onClose={() => setIsBulkStudentModalOpen(false)}
          courseId={activeCourse.id}
          courseCode={activeCourse.code}
          existingStudentsCount={activeCourseStudents.length}
          onAddStudents={handleAddStudents}
        />
      )}

      <EditStudentModal
        isOpen={isEditStudentModalOpen}
        onClose={() => {
          setIsEditStudentModalOpen(false);
          setSelectedStudentForEdit(null);
        }}
        student={selectedStudentForEdit}
        onSave={handleEditStudent}
      />

      <RemarksModal
        isOpen={isRemarksModalOpen}
        onClose={() => {
          setIsRemarksModalOpen(false);
          setSelectedStudentForRemark(null);
        }}
        student={selectedStudentForRemark}
        record={selectedStudentForRemark ? currentSession.records[selectedStudentForRemark.id] : undefined}
        onSaveRemark={handleSaveRemark}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        syncStatus={syncStatus}
        onSyncRefresh={refreshLocalData}
        canInstallPwa={!!deferredPrompt}
        onInstallPwa={handleInstallPwa}
      />
    </div>
  );
}
