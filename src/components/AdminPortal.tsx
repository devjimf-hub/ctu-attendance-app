import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap,
  BookOpen,
  Users,
  Plus,
  Edit2,
  Trash2,
  Lock,
  LogOut,
  ShieldCheck,
  Search,
  ArrowLeft,
  KeyRound,
  Save,
  X,
  FileSpreadsheet,
  Upload,
  AlertCircle
} from 'lucide-react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import {
  CurriculumProgram,
  CurriculumSubject,
  CurriculumSection,
  MasterStudent
} from '../types';
import { storageService } from '../services/storageService';
import { getFirebaseAuth } from '../firebase/config';

interface AdminPortalProps {
  onBackToTeacherPortal: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onBackToTeacherPortal }) => {
  // --- AUTHENTICATION STATE ---
  const [adminUser, setAdminUser] = useState<FirebaseUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login Form State
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Core Curriculum Data
  const [activeTab, setActiveTab] = useState<'programs' | 'subjects' | 'sections'>('programs');
  const [programs, setPrograms] = useState<CurriculumProgram[]>(() => storageService.getPrograms());
  const [subjects, setSubjects] = useState<CurriculumSubject[]>(() => storageService.getSubjects());
  const [sections, setSections] = useState<CurriculumSection[]>(() => storageService.getSections());

  // Filters & Search
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals / Editing States
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<CurriculumProgram | null>(null);
  const [progCode, setProgCode] = useState('');
  const [progName, setProgName] = useState('');
  const [progDept, setProgDept] = useState('');

  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<CurriculumSubject | null>(null);
  const [subjProgramId, setSubjProgramId] = useState('');
  const [subjCode, setSubjCode] = useState('');
  const [subjName, setSubjName] = useState('');
  const [subjUnits, setSubjUnits] = useState(3);
  const [subjYear, setSubjYear] = useState('1st Year');
  const [subjSemester, setSubjSemester] = useState('1st Semester');

  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<CurriculumSection | null>(null);
  const [secProgramId, setSecProgramId] = useState('');
  const [secName, setSecName] = useState('');
  const [secYear, setSecYear] = useState('1st Year');
  const [secSemester, setSecSemester] = useState('1st Semester');

  const [managingSection, setManagingSection] = useState<CurriculumSection | null>(null);
  const [isBulkRosterOpen, setIsBulkRosterOpen] = useState(false);
  const [bulkRosterText, setBulkRosterText] = useState('');
  const [newStudentId, setNewStudentId] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');

  // Listen to Firebase Auth state
  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthError('Firebase Authentication is not configured. Please check your .env Firebase credentials.');
      setAuthChecking(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, user => {
      setAdminUser(user);
      setAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshData = () => {
    setPrograms(storageService.getPrograms());
    setSubjects(storageService.getSubjects());
    setSections(storageService.getSections());
  };

  // --- FIREBASE AUTH ACTIONS ---
  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!adminEmail.trim() || !adminPassword.trim()) {
      setAuthError('Please enter both admin email and password.');
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthError('Firebase Authentication is not initialized.');
      return;
    }

    setAuthLoading(true);

    try {
      if (authMode === 'login') {
        const userCred = await signInWithEmailAndPassword(auth, adminEmail.trim(), adminPassword);
        setAdminUser(userCred.user);
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, adminEmail.trim(), adminPassword);
        setAdminUser(userCred.user);
      }
    } catch (err: any) {
      console.error('Admin Firebase Auth failed:', err);
      let msg = 'Authentication failed. Please check your credentials.';
      const code = err.code || '';

      if (code === 'auth/configuration-not-found' || code === 'auth/operation-not-allowed') {
        msg = 'Firebase Authentication (Email/Password) is not enabled in your Firebase Console. Go to Firebase Console > Build > Authentication > Sign-in method and enable "Email/Password".';
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        msg = 'Invalid admin email or password.';
      } else if (code === 'auth/email-already-in-use') {
        msg = 'This email is already registered. Please switch to Sign In.';
      } else if (code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.message) {
        msg = err.message;
      }
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminSignOut = async () => {
    const auth = getFirebaseAuth();
    if (auth) {
      await signOut(auth);
    }
    setAdminUser(null);
    onBackToTeacherPortal();
  };

  // --- PROGRAM HANDLERS ---
  const handleOpenProgramModal = (prog?: CurriculumProgram) => {
    if (prog) {
      setEditingProgram(prog);
      setProgCode(prog.code);
      setProgName(prog.name);
      setProgDept(prog.department || '');
    } else {
      setEditingProgram(null);
      setProgCode('');
      setProgName('');
      setProgDept('College of Computer Studies');
    }
    setIsProgramModalOpen(true);
  };

  const handleSaveProgram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!progCode.trim() || !progName.trim()) return;

    const program: CurriculumProgram = {
      id: editingProgram ? editingProgram.id : `prog_${Date.now()}`,
      code: progCode.trim().toUpperCase(),
      name: progName.trim(),
      department: progDept.trim() || undefined,
      createdAt: editingProgram ? editingProgram.createdAt : Date.now()
    };

    storageService.saveProgram(program);
    refreshData();
    setIsProgramModalOpen(false);
  };

  const handleDeleteProgram = (id: string, name: string) => {
    if (confirm(`Delete program "${name}"? This will also remove associated subjects and sections.`)) {
      storageService.deleteProgram(id);
      refreshData();
    }
  };

  // --- SUBJECT HANDLERS ---
  const handleOpenSubjectModal = (subj?: CurriculumSubject) => {
    const defaultProg = programs[0]?.id || '';
    if (subj) {
      setEditingSubject(subj);
      setSubjProgramId(subj.programId);
      setSubjCode(subj.code);
      setSubjName(subj.name);
      setSubjUnits(subj.units || 3);
      setSubjYear(subj.yearLevel || '1st Year');
      setSubjSemester(subj.semester || '1st Semester');
    } else {
      setEditingSubject(null);
      setSubjProgramId(selectedProgramFilter !== 'all' ? selectedProgramFilter : defaultProg);
      setSubjCode('');
      setSubjName('');
      setSubjUnits(3);
      setSubjYear('1st Year');
      setSubjSemester('1st Semester');
    }
    setIsSubjectModalOpen(true);
  };

  const handleSaveSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjCode.trim() || !subjName.trim() || !subjProgramId) return;

    const subject: CurriculumSubject = {
      id: editingSubject ? editingSubject.id : `subj_${Date.now()}`,
      programId: subjProgramId,
      code: subjCode.trim().toUpperCase(),
      name: subjName.trim(),
      units: Number(subjUnits) || 3,
      yearLevel: subjYear,
      semester: subjSemester,
      createdAt: editingSubject ? editingSubject.createdAt : Date.now()
    };

    storageService.saveSubject(subject);
    refreshData();
    setIsSubjectModalOpen(false);
  };

  const handleDeleteSubject = (id: string, code: string) => {
    if (confirm(`Delete subject "${code}" from curriculum?`)) {
      storageService.deleteSubject(id);
      refreshData();
    }
  };

  // --- SECTION HANDLERS ---
  const handleOpenSectionModal = (sec?: CurriculumSection) => {
    const defaultProg = programs[0]?.id || '';
    if (sec) {
      setEditingSection(sec);
      setSecProgramId(sec.programId);
      setSecName(sec.name);
      setSecYear(sec.yearLevel);
      setSecSemester(sec.semester || '1st Semester');
    } else {
      setEditingSection(null);
      setSecProgramId(selectedProgramFilter !== 'all' ? selectedProgramFilter : defaultProg);
      setSecName('');
      setSecYear('1st Year');
      setSecSemester('1st Semester');
    }
    setIsSectionModalOpen(true);
  };

  const handleSaveSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secName.trim() || !secProgramId) return;

    const section: CurriculumSection = {
      id: editingSection ? editingSection.id : `sec_${Date.now()}`,
      programId: secProgramId,
      name: secName.trim().toUpperCase(),
      yearLevel: secYear,
      semester: secSemester,
      students: editingSection ? editingSection.students : [],
      createdAt: editingSection ? editingSection.createdAt : Date.now()
    };

    storageService.saveSection(section);
    refreshData();
    setIsSectionModalOpen(false);
  };

  const handleDeleteSection = (id: string, name: string) => {
    if (confirm(`Delete section "${name}" and its student roster?`)) {
      storageService.deleteSection(id);
      refreshData();
    }
  };

  // --- SECTION STUDENT ROSTER HANDLERS ---
  const handleOpenStudentManager = (section: CurriculumSection) => {
    setManagingSection(section);
    setIsBulkRosterOpen(false);
    setNewStudentId('');
    setNewStudentName('');
    setNewStudentEmail('');
  };

  const handleAddSingleStudentToSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingSection || !newStudentName.trim()) return;

    const currentStudents = managingSection.students || [];
    const autoId = newStudentId.trim() || `2024-${String(currentStudents.length + 101).padStart(5, '0')}`;

    const newStu: MasterStudent = {
      id: `mstu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      studentId: autoId,
      name: newStudentName.trim(),
      email: newStudentEmail.trim() || undefined
    };

    const updatedSection: CurriculumSection = {
      ...managingSection,
      students: [...currentStudents, newStu]
    };

    storageService.saveSection(updatedSection);
    setManagingSection(updatedSection);
    refreshData();
    setNewStudentId('');
    setNewStudentName('');
    setNewStudentEmail('');
  };

  const handleDeleteStudentFromSection = (studentId: string) => {
    if (!managingSection) return;
    const updated = {
      ...managingSection,
      students: managingSection.students.filter(s => s.id !== studentId)
    };
    storageService.saveSection(updated);
    setManagingSection(updated);
    refreshData();
  };

  const handleBulkImportStudents = () => {
    if (!managingSection || !bulkRosterText.trim()) return;

    const lines = bulkRosterText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsed: MasterStudent[] = [];
    let counter = (managingSection.students?.length || 0) + 1;

    for (const line of lines) {
      if (line.includes('\t') || line.includes(',')) {
        const delimiter = line.includes('\t') ? '\t' : ',';
        const parts = line.split(delimiter).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          const firstIsId = /^[A-Za-z0-9-_/]+$/.test(parts[0]) && parts[0].length <= 20;
          const sId = firstIsId ? parts[0] : `2024-${String(counter++).padStart(5, '0')}`;
          const sName = firstIsId ? parts[1] : parts[0];
          const sEmail = parts[2] || undefined;
          if (sName) {
            parsed.push({
              id: `mstu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              studentId: sId,
              name: sName,
              email: sEmail
            });
          }
        }
      } else {
        const parts = line.split(/\s{2,}|\s+-+\s+/).map(p => p.trim());
        if (parts.length >= 2) {
          parsed.push({
            id: `mstu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            studentId: parts[0],
            name: parts[1]
          });
        } else {
          parsed.push({
            id: `mstu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            studentId: `2024-${String(counter++).padStart(5, '0')}`,
            name: line
          });
        }
      }
    }

    if (parsed.length === 0) {
      alert('Could not parse student names. Please check format.');
      return;
    }

    const updatedSection: CurriculumSection = {
      ...managingSection,
      students: [...(managingSection.students || []), ...parsed]
    };

    storageService.saveSection(updatedSection);
    setManagingSection(updatedSection);
    refreshData();
    setIsBulkRosterOpen(false);
    setBulkRosterText('');
  };

  // --- FILTERED DATA ---
  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => {
      const matchesProg = selectedProgramFilter === 'all' || s.programId === selectedProgramFilter;
      const matchesSearch =
        s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesProg && matchesSearch;
    });
  }, [subjects, selectedProgramFilter, searchQuery]);

  const filteredSections = useMemo(() => {
    return sections.filter(sec => {
      const matchesProg = selectedProgramFilter === 'all' || sec.programId === selectedProgramFilter;
      const matchesSearch = sec.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesProg && matchesSearch;
    });
  }, [sections, selectedProgramFilter, searchQuery]);

  // If checking authentication, show simple loader
  if (authChecking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Lock size={32} color="var(--primary)" className="spin-animate" style={{ margin: '0 auto 1rem' }} />
          <p>Verifying Admin Authentication...</p>
        </div>
      </div>
    );
  }

  // --- AUTHENTICATION REQUIRED SCREEN ---
  if (!adminUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'var(--bg-main)' }}>
        <div style={{ width: '100%', maxWidth: '420px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', padding: '2rem 1.5rem', textAlign: 'center' }}>
          
          <div style={{ width: '56px', height: '56px', background: '#7c3aed', borderRadius: 'var(--radius-md)', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.35)' }}>
            <Lock size={28} />
          </div>

          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.35rem', fontWeight: 700, margin: '0 0 0.25rem' }}>
            Admin Portal Access
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Sign in with your Firebase Administrator credentials to manage curriculum, degrees, and rosters.
          </p>

          {authError && (
            <div style={{ padding: '0.85rem', borderRadius: 'var(--radius-sm)', background: 'var(--status-absent-bg)', border: '1px solid rgba(220, 38, 38, 0.2)', color: 'var(--status-absent)', fontSize: '0.8rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '1.25rem', textAlign: 'left' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAdminAuth} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', textAlign: 'left' }}>
            <div className="form-group">
              <label className="form-label">Administrator Email *</label>
              <input
                type="email"
                className="form-input"
                placeholder="admin@university.edu"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Admin Password *</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={authLoading}
              style={{ width: '100%', padding: '0.65rem', marginTop: '0.5rem', background: '#7c3aed', borderColor: '#7c3aed' }}
            >
              <KeyRound size={15} />
              {authLoading ? 'Authenticating...' : authMode === 'login' ? 'Sign In to Admin Portal' : 'Register Admin Account'}
            </button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '1rem', gap: '0.4rem', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {authMode === 'login' ? 'First time admin?' : 'Already registered?'}
            </span>
            <button
              type="button"
              className="btn-ghost"
              style={{ padding: 0, color: 'var(--primary)', height: 'auto', fontWeight: 600 }}
              onClick={() => {
                setAuthError(null);
                setAuthMode(authMode === 'login' ? 'register' : 'login');
              }}
            >
              {authMode === 'login' ? 'Create Admin Account' : 'Sign In'}
            </button>
          </div>

          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: '100%', fontSize: '0.8rem', color: 'var(--text-secondary)' }}
              onClick={onBackToTeacherPortal}
            >
              <ArrowLeft size={14} /> Exit to Teacher Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- AUTHENTICATED ADMIN DASHBOARD ---
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', display: 'flex', flexDirection: 'column' }}>
      {/* Admin Top Navbar */}
      <header className="google-header" style={{ borderBottom: '2px solid #7c3aed' }}>
        <div className="header-left">
          <button
            className="btn btn-sm btn-secondary"
            onClick={onBackToTeacherPortal}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
          >
            <ArrowLeft size={15} />
            Teacher Portal
          </button>

          <div style={{ height: '24px', width: '1px', background: 'var(--border-color)', margin: '0 0.5rem' }} />

          <div className="header-title-group">
            <div className="app-logo-icon" style={{ background: 'transparent', padding: 0, overflow: 'hidden' }}>
              <img src="/logo.webp" alt="Class Check Logo" style={{ width: '26px', height: '26px', objectFit: 'contain' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="header-app-name" style={{ fontSize: '1.1rem' }}>Class Check Admin</span>
                <span className="badge badge-present" style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem', textTransform: 'uppercase' }}>
                  Firebase Authenticated
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="header-right">
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }} className="hide-on-mobile">
              <ShieldCheck size={14} color="var(--google-green)" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
              {adminUser.email}
            </span>

            <button
              className="btn btn-sm btn-secondary"
              onClick={handleAdminSignOut}
              style={{ color: 'var(--status-absent)', fontSize: '0.8rem' }}
            >
              <LogOut size={13} />
              Sign Out (Admin)
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-container" style={{ padding: '1.5rem 1rem', flex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
          <button
            className={`btn ${activeTab === 'programs' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', padding: '0.65rem 1.25rem', background: activeTab === 'programs' ? '#7c3aed' : undefined }}
            onClick={() => setActiveTab('programs')}
          >
            <GraduationCap size={16} />
            College Degree Programs ({programs.length})
          </button>

          <button
            className={`btn ${activeTab === 'subjects' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', padding: '0.65rem 1.25rem', background: activeTab === 'subjects' ? '#7c3aed' : undefined }}
            onClick={() => setActiveTab('subjects')}
          >
            <BookOpen size={16} />
            Curriculum Subjects ({subjects.length})
          </button>

          <button
            className={`btn ${activeTab === 'sections' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', padding: '0.65rem 1.25rem', background: activeTab === 'sections' ? '#7c3aed' : undefined }}
            onClick={() => setActiveTab('sections')}
          >
            <Users size={16} />
            Block Sections & Rosters ({sections.length})
          </button>
        </div>

        {/* TAB 1: PROGRAMS */}
        {activeTab === 'programs' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>College Degree Programs</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>
                  Define degrees/courses (e.g. BSIT, BSCS). Teachers choose their degree program during sign-up.
                </p>
              </div>

              <button className="btn btn-primary btn-sm" onClick={() => handleOpenProgramModal()} style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
                <Plus size={15} />
                Add College Degree / Program
              </button>
            </div>

            {programs.length === 0 ? (
              <div style={{ padding: '3rem 1rem', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
                <GraduationCap size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
                <h4 style={{ margin: 0, fontWeight: 600 }}>No College Programs Defined</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Click "Add College Degree / Program" to register BSIT, BSCS, or other departments.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                {programs.map(prog => {
                  const progSubjs = subjects.filter(s => s.programId === prog.id);
                  const progSecs = sections.filter(sec => sec.programId === prog.id);
                  const studentCount = progSecs.reduce((acc, s) => acc + (s.students?.length || 0), 0);

                  return (
                    <div
                      key={prog.id}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1.25rem',
                        boxShadow: 'var(--shadow-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '1rem'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span className="badge badge-present" style={{ fontSize: '0.85rem', fontWeight: 800, padding: '0.2rem 0.6rem' }}>
                            {prog.code}
                          </span>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                              className="btn-icon"
                              style={{ width: '28px', height: '28px' }}
                              onClick={() => handleOpenProgramModal(prog)}
                              title="Edit Program"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              className="btn-icon"
                              style={{ width: '28px', height: '28px', color: 'var(--status-absent)' }}
                              onClick={() => handleDeleteProgram(prog.id, prog.code)}
                              title="Delete Program"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.25rem' }}>
                          {prog.name}
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                          {prog.department || 'General College Department'}
                        </p>
                      </div>

                      <div
                        style={{
                          paddingTop: '0.75rem',
                          borderTop: '1px solid var(--border-color)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)'
                        }}
                      >
                        <span><strong>{progSubjs.length}</strong> Subjects</span>
                        <span><strong>{progSecs.length}</strong> Sections ({studentCount} Students)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CURRICULUM SUBJECTS */}
        {activeTab === 'subjects' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Curriculum Master Subjects</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>
                  Master catalog of subject codes and titles. Automatically fills titles on the teacher side.
                </p>
              </div>

              <button className="btn btn-primary btn-sm" onClick={() => handleOpenSubjectModal()} style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
                <Plus size={15} />
                Add Subject
              </button>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '220px' }}>
                <select
                  className="form-select"
                  value={selectedProgramFilter}
                  onChange={e => setSelectedProgramFilter(e.target.value)}
                  style={{ height: '36px', fontSize: '0.85rem' }}
                >
                  <option value="all">All Degree Programs ({subjects.length})</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search subject code or title..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '2rem', height: '36px', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* Subjects Table */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Subject Code</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Subject Title / Description</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Degree Program</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Year & Sem</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Units</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No subjects match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredSubjects.map(s => {
                      const prog = programs.find(p => p.id === s.programId);
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                            {s.code}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                            {s.name}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className="badge badge-excused" style={{ fontSize: '0.75rem' }}>
                              {prog?.code || 'General'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                            {s.yearLevel || '—'} &bull; {s.semester || '—'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                            {s.units || 3} units
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            <button
                              className="btn-icon"
                              style={{ width: '28px', height: '28px', marginRight: '0.25rem' }}
                              onClick={() => handleOpenSubjectModal(s)}
                              title="Edit Subject"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              className="btn-icon"
                              style={{ width: '28px', height: '28px', color: 'var(--status-absent)' }}
                              onClick={() => handleDeleteSubject(s.id, s.code)}
                              title="Delete Subject"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SECTIONS & STUDENT ROSTERS */}
        {activeTab === 'sections' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Block Sections & Student Master Lists</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>
                  Create block sections with pre-enrolled students. When teachers select a section, its student roster automatically imports.
                </p>
              </div>

              <button className="btn btn-primary btn-sm" onClick={() => handleOpenSectionModal()} style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
                <Plus size={15} />
                Create Block Section
              </button>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '220px' }}>
                <select
                  className="form-select"
                  value={selectedProgramFilter}
                  onChange={e => setSelectedProgramFilter(e.target.value)}
                  style={{ height: '36px', fontSize: '0.85rem' }}
                >
                  <option value="all">All Degree Programs ({sections.length} sections)</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search section name (e.g. BSIT 3-A)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '2rem', height: '36px', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* Sections Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
              {filteredSections.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
                  No block sections found. Click "Create Block Section" to add one.
                </div>
              ) : (
                filteredSections.map(sec => {
                  const prog = programs.find(p => p.id === sec.programId);
                  const studentCount = sec.students?.length || 0;

                  return (
                    <div
                      key={sec.id}
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1.25rem',
                        boxShadow: 'var(--shadow-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '1rem'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span className="badge badge-excused" style={{ fontSize: '0.75rem' }}>
                            {prog?.code || 'General Program'}
                          </span>
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button
                              className="btn-icon"
                              style={{ width: '28px', height: '28px' }}
                              onClick={() => handleOpenSectionModal(sec)}
                              title="Edit Section Details"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              className="btn-icon"
                              style={{ width: '28px', height: '28px', color: 'var(--status-absent)' }}
                              onClick={() => handleDeleteSection(sec.id, sec.name)}
                              title="Delete Section"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.25rem' }}>
                          {sec.name}
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                          {sec.yearLevel} &bull; {sec.semester || '1st Semester'}
                        </p>
                      </div>

                      <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: studentCount > 0 ? 'var(--status-present)' : 'var(--text-muted)' }}>
                          👥 {studentCount} Enrolled Student{studentCount === 1 ? '' : 's'}
                        </span>

                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleOpenStudentManager(sec)}
                          style={{ fontSize: '0.8rem' }}
                        >
                          Manage Roster
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: ADD / EDIT DEGREE PROGRAM */}
      {isProgramModalOpen && (
        <div className="modal-overlay" onClick={() => setIsProgramModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="modal-icon-badge" style={{ background: '#7c3aed20', color: '#7c3aed' }}>
                  <GraduationCap size={20} />
                </div>
                <div>
                  <h3 className="modal-title">{editingProgram ? 'Edit College Program' : 'Add College Degree / Program'}</h3>
                  <p className="modal-subtitle">Degree code and full academic program title</p>
                </div>
              </div>
              <button className="btn-icon" onClick={() => setIsProgramModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProgram}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Degree / Course Code *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. BSIT, BSCS, BSIS, BSCpE"
                    value={progCode}
                    onChange={e => setProgCode(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Full Degree Program Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Bachelor of Science in Information Technology"
                    value={progName}
                    onChange={e => setProgName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">College / Department</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. College of Computer Studies & Engineering"
                    value={progDept}
                    onChange={e => setProgDept(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsProgramModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
                  <Save size={15} />
                  {editingProgram ? 'Save Changes' : 'Create Program'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT SUBJECT */}
      {isSubjectModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSubjectModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="modal-icon-badge" style={{ background: '#0284c720', color: '#0284c7' }}>
                  <BookOpen size={20} />
                </div>
                <div>
                  <h3 className="modal-title">{editingSubject ? 'Edit Curriculum Subject' : 'Add Subject to Curriculum'}</h3>
                  <p className="modal-subtitle">Subject code and official course title</p>
                </div>
              </div>
              <button className="btn-icon" onClick={() => setIsSubjectModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSubject}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Degree Program *</label>
                  <select
                    className="form-select"
                    value={subjProgramId}
                    onChange={e => setSubjProgramId(e.target.value)}
                    required
                  >
                    <option value="" disabled>Select College Program...</option>
                    {programs.map(p => (
                      <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Subject Code *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. IT 204, CS 301"
                      value={subjCode}
                      onChange={e => setSubjCode(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Academic Units</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      className="form-input"
                      value={subjUnits}
                      onChange={e => setSubjUnits(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Subject Title / Course Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Database Management Systems"
                    value={subjName}
                    onChange={e => setSubjName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Year Level</label>
                    <select
                      className="form-select"
                      value={subjYear}
                      onChange={e => setSubjYear(e.target.value)}
                    >
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Semester / Term</label>
                    <select
                      className="form-select"
                      value={subjSemester}
                      onChange={e => setSubjSemester(e.target.value)}
                    >
                      <option value="1st Semester">1st Semester</option>
                      <option value="2nd Semester">2nd Semester</option>
                      <option value="Summer / Midyear">Summer / Midyear</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsSubjectModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
                  <Save size={15} />
                  {editingSubject ? 'Save Changes' : 'Save Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD / EDIT BLOCK SECTION */}
      {isSectionModalOpen && (
        <div className="modal-overlay" onClick={() => setIsSectionModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="modal-icon-badge" style={{ background: '#05966920', color: '#059669' }}>
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="modal-title">{editingSection ? 'Edit Block Section' : 'Create Block Section'}</h3>
                  <p className="modal-subtitle">Define section block name for auto-selection</p>
                </div>
              </div>
              <button className="btn-icon" onClick={() => setIsSectionModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSection}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Degree Program *</label>
                  <select
                    className="form-select"
                    value={secProgramId}
                    onChange={e => setSecProgramId(e.target.value)}
                    required
                  >
                    <option value="" disabled>Select College Program...</option>
                    {programs.map(p => (
                      <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Block Section Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. BSIT 3-A, BSCS 2-B, Block 1"
                    value={secName}
                    onChange={e => setSecName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Year Level</label>
                    <select
                      className="form-select"
                      value={secYear}
                      onChange={e => setSecYear(e.target.value)}
                    >
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Semester</label>
                    <select
                      className="form-select"
                      value={secSemester}
                      onChange={e => setSecSemester(e.target.value)}
                    >
                      <option value="1st Semester">1st Semester</option>
                      <option value="2nd Semester">2nd Semester</option>
                      <option value="Summer Term">Summer Term</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsSectionModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
                  <Save size={15} />
                  {editingSection ? 'Save Section' : 'Create Section'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: MANAGE STUDENTS IN A SECTION */}
      {managingSection && (
        <div className="modal-overlay" onClick={() => setManagingSection(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '720px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="modal-icon-badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="modal-title">Student Roster: {managingSection.name}</h3>
                  <p className="modal-subtitle">
                    {managingSection.students?.length || 0} student{managingSection.students?.length === 1 ? '' : 's'} enrolled in this section
                  </p>
                </div>
              </div>
              <button className="btn-icon" onClick={() => setManagingSection(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {!isBulkRosterOpen ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Add Student to Section</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => setIsBulkRosterOpen(true)}
                    >
                      <FileSpreadsheet size={14} />
                      Bulk Paste Roster (Excel/CSV)
                    </button>
                  </div>

                  <form onSubmit={handleAddSingleStudentToSection} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr auto', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>ID No.</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="2024-00101"
                        value={newStudentId}
                        onChange={e => setNewStudentId(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Full Name (Last, First) *</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Wright, Alexander"
                        value={newStudentName}
                        onChange={e => setNewStudentName(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Email (Optional)</label>
                      <input
                        type="email"
                        className="form-input"
                        placeholder="student@univ.edu"
                        value={newStudentEmail}
                        onChange={e => setNewStudentEmail(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm" style={{ height: '36px', background: '#7c3aed', borderColor: '#7c3aed' }}>
                      <Plus size={14} /> Add
                    </button>
                  </form>
                </div>
              ) : (
                <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.9rem' }}>Paste Excel or CSV Roster</strong>
                    <button className="btn-ghost btn-sm" onClick={() => setIsBulkRosterOpen(false)}>
                      Cancel Bulk
                    </button>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    Copy-paste rows directly from Excel or Google Sheets (Format: <code>Student ID &bull; Full Name &bull; Email</code> or just names).
                  </p>
                  <textarea
                    className="form-input"
                    rows={6}
                    placeholder={`2024-00101\tAlexander Wright\ta.wright@univ.edu\n2024-00102\tBrianna Chen\tb.chen@univ.edu\n2024-00103\tCarlos Morales`}
                    value={bulkRosterText}
                    onChange={e => setBulkRosterText(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                  />
                  <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => setIsBulkRosterOpen(false)}>
                      Back
                    </button>
                    <button className="btn btn-sm btn-primary" onClick={handleBulkImportStudents} style={{ background: '#7c3aed', borderColor: '#7c3aed' }}>
                      <Upload size={14} />
                      Import Students to {managingSection.name}
                    </button>
                  </div>
                </div>
              )}

              {/* Students List in Section */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', maxHeight: '340px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.5rem 0.75rem', width: '36px' }}>#</th>
                      <th style={{ padding: '0.5rem 0.75rem', width: '110px' }}>ID No.</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Full Name</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Email</th>
                      <th style={{ padding: '0.5rem 0.75rem', width: '40px', textAlign: 'right' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!managingSection.students || managingSection.students.length === 0) ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No students in this block section yet. Add students above.
                        </td>
                      </tr>
                    ) : (
                      managingSection.students.map((stu, idx) => (
                        <tr key={stu.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>
                            {stu.studentId}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>{stu.name}</td>
                          <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-secondary)' }}>
                            {stu.email || '—'}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                            <button
                              className="btn-icon"
                              style={{ width: '24px', height: '24px', color: 'var(--status-absent)' }}
                              onClick={() => handleDeleteStudentFromSection(stu.id)}
                              title="Remove Student"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={() => setManagingSection(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
