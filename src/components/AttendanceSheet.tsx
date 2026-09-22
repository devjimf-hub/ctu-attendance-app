import React, { useState } from 'react';
import {
  Search,
  MessageSquare,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  List,
  Layers,
  LayoutGrid,
  X,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  Course,
  Student,
  AttendanceSession,
  AttendanceStatus,
  StudentAttendanceSummary
} from '../types';
import { sortStudentsByLastName, parseNameParts } from '../utils/collegeUtils';
import { RollCallSwipeMode } from './RollCallSwipeMode';
import { RollCallSeatingGrid } from './RollCallSeatingGrid';

interface AttendanceSheetProps {
  course: Course;
  students: Student[];
  session: AttendanceSession;
  summaries: StudentAttendanceSummary[];
  onUpdateRecord: (studentId: string, status: AttendanceStatus | null) => void;
  onBulkUpdateStatus: (status: AttendanceStatus, targetStudents?: Student[]) => void;
  onUpdateSessionDate: (date: string) => void;
  onUpdateSessionType: (type: 'lecture' | 'lab' | 'tutorial' | 'exam') => void;
  onUpdateSessionTopic: (topic: string) => void;
  onOpenRemarkModal: (student: Student) => void;
  onOpenAddStudents: () => void;
}

export const AttendanceSheet: React.FC<AttendanceSheetProps> = ({
  course,
  students,
  session,
  summaries,
  onUpdateRecord,
  onBulkUpdateStatus,
  onUpdateSessionDate,
  onUpdateSessionType,
  onUpdateSessionTopic,
  onOpenRemarkModal,
  onOpenAddStudents
}) => {
  // Modal state for full roll call modes: 'list' | 'swipe' | 'grid' | null
  const [activeModalMode, setActiveModalMode] = useState<'list' | 'swipe' | 'grid' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unmarked' | AttendanceStatus>('all');

  // Compute Headcount metrics for the active session
  const totalStudents = students.length;
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let excusedCount = 0;
  let unmarkedCount = 0;

  students.forEach(student => {
    const record = session.records[student.id];
    if (!record) {
      unmarkedCount++;
    } else {
      if (record.status === 'present') presentCount++;
      else if (record.status === 'absent') absentCount++;
      else if (record.status === 'late') lateCount++;
      else if (record.status === 'excused') excusedCount++;
    }
  });

  // Filtered and sorted student list by LAST NAME (A to Z)
  const filteredStudents = sortStudentsByLastName(
    students.filter(student => {
      const matchesSearch =
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.major && student.major.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      const record = session.records[student.id];
      if (statusFilter === 'all') return true;
      if (statusFilter === 'unmarked') return !record;
      return record?.status === statusFilter;
    })
  );

  // Handle Mark All Present with celebratory micro-confetti
  const handleMarkAllPresent = () => {
    onBulkUpdateStatus('present');
    try {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#10b981', '#6366f1', '#38bdf8']
      });
    } catch {
      // Ignore if canvas-confetti is not loaded
    }
  };

  // Date stepper handlers (Timezone-safe)
  const handleStepDate = (days: number) => {
    const parts = session.date.split('-').map(Number);
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2] + days);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      onUpdateSessionDate(`${year}-${month}-${day}`);
    }
  };

  const getStudentSummary = (studentId: string) => {
    return summaries.find(s => s.student.id === studentId);
  };

  return (
    <div>
      {/* 1. TOP SESSION CONFIG TOOLBAR (Date, Session Type, Topic) */}
      <div className="attendance-toolbar glass-panel">
        <div className="session-config-row">
          {/* Date Picker with stepper */}
          <div className="date-input-wrapper">
            <button
              type="button"
              className="btn-icon date-step-btn"
              onClick={() => handleStepDate(-1)}
              title="Previous Day"
              aria-label="Previous Day"
            >
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              className="date-input"
              value={session.date}
              onChange={e => onUpdateSessionDate(e.target.value)}
            />
            <button
              type="button"
              className="btn-icon date-step-btn"
              onClick={() => handleStepDate(1)}
              title="Next Day"
              aria-label="Next Day"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Session Type Select */}
          <select
            className="custom-select session-type-select"
            value={session.sessionType}
            onChange={e => onUpdateSessionType(e.target.value as any)}
          >
            <option value="lecture">📖 Lecture</option>
            <option value="lab">🔬 Laboratory</option>
            <option value="tutorial">💡 Tutorial</option>
            <option value="exam">📝 Examination</option>
          </select>

          {/* Optional Topic Input */}
          <input
            type="text"
            className="form-input session-topic-input"
            placeholder="Topic (e.g. Trees, SQL, Midterms)..."
            value={session.topic || ''}
            onChange={e => onUpdateSessionTopic(e.target.value)}
          />
        </div>
      </div>

      {/* THE 3 COLORFUL ROLL CALL MODES */}
      <div className="rollcall-modes-grid" style={{ marginTop: '0.85rem' }}>
        {/* 🟩 MODE 1: SPEED FLASHCARDS (SWIPE & HOTKEYS) */}
        <div
          className="rollcall-mode-card mode-swipe"
          onClick={() => setActiveModalMode('swipe')}
          role="button"
          tabIndex={0}
        >
          <div className="mode-card-top">
            <div className="mode-card-header-main">
              <div className="mode-card-icon-wrap">
                <Layers size={22} />
              </div>
              <h4 className="mode-card-title">Speed Flashcards</h4>
            </div>
            <span className="mode-card-badge">Swipe & Hotkeys</span>
          </div>

          <button type="button" className="mode-card-btn">
            Start Speed Cards <ArrowRight size={15} />
          </button>
        </div>

        {/* 🟦 MODE 2: CLASSIC ROSTER LIST */}
        <div
          className="rollcall-mode-card mode-roster"
          onClick={() => setActiveModalMode('list')}
          role="button"
          tabIndex={0}
        >
          <div className="mode-card-top">
            <div className="mode-card-header-main">
              <div className="mode-card-icon-wrap">
                <List size={22} />
              </div>
              <h4 className="mode-card-title">Classic Roster List</h4>
            </div>
            <span className="mode-card-badge">Standard Roster</span>
          </div>

          <button type="button" className="mode-card-btn">
            Open Roster List <ArrowRight size={15} />
          </button>
        </div>

        {/* 🟪 MODE 3: VISUAL SEATING GRID */}
        <div
          className="rollcall-mode-card mode-grid"
          onClick={() => setActiveModalMode('grid')}
          role="button"
          tabIndex={0}
        >
          <div className="mode-card-top">
            <div className="mode-card-header-main">
              <div className="mode-card-icon-wrap">
                <LayoutGrid size={22} />
              </div>
              <h4 className="mode-card-title">Visual Seating Grid</h4>
            </div>
            <span className="mode-card-badge">Classroom Map</span>
          </div>

          <button type="button" className="mode-card-btn">
            Open Seating Grid <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* 4. DEDICATED ROLL CALL MODAL */}
      {activeModalMode && (
        <div className="modal-overlay" onClick={() => setActiveModalMode(null)}>
          <div
            className={`modal-content modal-rollcall modal-rollcall-${activeModalMode}`}
            style={{
              maxWidth:
                activeModalMode === 'swipe'
                  ? '680px'
                  : activeModalMode === 'grid'
                  ? '1180px'
                  : '980px',
              width: '95vw',
              height: '90vh',
              maxHeight: '92vh'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-rollcall-header">
              <div className="modal-rollcall-title-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    className="modal-icon-badge"
                    style={{
                      backgroundColor:
                        activeModalMode === 'list'
                          ? '#2563eb22'
                          : activeModalMode === 'swipe'
                          ? '#05966922'
                          : '#7c3aed22',
                      color:
                        activeModalMode === 'list'
                          ? '#2563eb'
                          : activeModalMode === 'swipe'
                          ? '#059669'
                          : '#7c3aed'
                    }}
                  >
                    {activeModalMode === 'list' ? (
                      <List size={20} />
                    ) : activeModalMode === 'swipe' ? (
                      <Layers size={20} />
                    ) : (
                      <LayoutGrid size={20} />
                    )}
                  </div>

                  <div>
                    <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>
                      {activeModalMode === 'list'
                        ? 'Classic Roster List'
                        : activeModalMode === 'swipe'
                        ? 'Speed Flashcards'
                        : 'Visual Seating Grid'}
                    </h3>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <span>{course.code}</span>
                      <span>•</span>
                      <span>{session.date}</span>
                      <span>•</span>
                      <span style={{ textTransform: 'capitalize' }}>{session.sessionType}</span>
                    </div>
                  </div>
                </div>

                {/* Close Button at top-right corner */}
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setActiveModalMode(null)}
                  title="Close Roll Call Window"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Quick Batch Actions Row */}
              <div className="modal-rollcall-actions-row">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleMarkAllPresent}
                  title="Mark all students as present"
                >
                  <Sparkles size={14} />
                  <span>Mark All Present</span>
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => {
                    const unmarked = students.filter(s => !session.records[s.id]);
                    if (unmarked.length > 0) {
                      onBulkUpdateStatus('absent', unmarked);
                    }
                  }}
                  title="Mark unmarked students as absent"
                >
                  <span>Mark Unmarked Absent</span>
                </button>
              </div>
            </div>

            {/* Modal Body: Active Roll Call View */}
            <div className="modal-rollcall-body">
              {activeModalMode === 'swipe' ? (
                <RollCallSwipeMode
                  students={students}
                  session={session}
                  summaries={summaries}
                  onUpdateRecord={onUpdateRecord}
                  onOpenRemarkModal={onOpenRemarkModal}
                  onSwitchToListMode={() => setActiveModalMode('list')}
                />
              ) : activeModalMode === 'grid' ? (
                <RollCallSeatingGrid
                  students={students}
                  session={session}
                  summaries={summaries}
                  onUpdateRecord={onUpdateRecord}
                  onBulkUpdateStatus={onBulkUpdateStatus}
                  onOpenRemarkModal={onOpenRemarkModal}
                />
              ) : (
                /* MODE 1: CLASSIC ROSTER LIST */
                <>
                  {/* Search & Filter Bar */}
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="search-box" style={{ flex: 1, minWidth: '200px' }}>
                      <Search size={16} className="search-icon" />
                      <input
                        type="text"
                        className="search-input"
                        placeholder="Search student by name or ID..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setStatusFilter('all')}
                      >
                        All ({totalStudents})
                      </button>
                      {unmarkedCount > 0 && (
                        <button
                          type="button"
                          className={`btn btn-sm ${statusFilter === 'unmarked' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setStatusFilter('unmarked')}
                          style={{ color: statusFilter === 'unmarked' ? '#ffffff' : 'var(--accent-amber)' }}
                        >
                          Unmarked ({unmarkedCount})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Student Attendance List */}
                  {totalStudents === 0 ? (
                    <div className="glass-panel" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                      <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '0.5rem' }}>No Students in this Course</h3>
                      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                        Add your college student roster to start taking attendance.
                      </p>
                      <button className="btn btn-primary" onClick={onOpenAddStudents}>
                        + Add Students / Bulk Paste Roster
                      </button>
                    </div>
                  ) : filteredStudents.length === 0 ? (
                    <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No students match the current search or filter.
                    </div>
                  ) : (
                    <div className="students-list-container">
                      {filteredStudents.map((student) => {
                        const record = session.records[student.id];
                        const currentStatus = record?.status;
                        const summary = getStudentSummary(student.id);
                        const nameInfo = parseNameParts(student.name);

                        return (
                          <div key={student.id} className="student-card">
                            {/* Student Info */}
                            <div className="student-card-info">
                              <div className="student-avatar" style={{ backgroundColor: course.color + '22', color: course.color }}>
                                {nameInfo.lastName.charAt(0) || student.name.charAt(0)}
                              </div>
                              <div className="student-name-group">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <span className="student-name">{nameInfo.displayName}</span>
                                  {summary && summary.statusCategory === 'critical' && (
                                    <span className="warning-pill critical" title={`Critical: ${summary.attendancePercentage}% Attendance (${summary.absentCount} Absences)`}>
                                      <AlertTriangle size={11} /> Dropped Risk
                                    </span>
                                  )}
                                  {summary && summary.statusCategory === 'warning' && (
                                    <span className="warning-pill warning" title={`Warning: ${summary.attendancePercentage}% Attendance`}>
                                      Warning
                                    </span>
                                  )}
                                </div>
                                <div className="student-subinfo">
                                  <span className="student-id-code">{student.studentId}</span>
                                  {student.major && <span>• {student.major}</span>}
                                  {student.yearLevel && <span>• {student.yearLevel}</span>}
                                  {summary && (
                                    <span style={{ fontWeight: 600, color: summary.attendancePercentage < 75 ? 'var(--google-red)' : 'var(--text-muted)' }}>
                                      • {summary.attendancePercentage}% overall
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Tactile 4-way Status Selector & Note Button */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', flexShrink: 0 }}>
                              <div className="status-selector-group">
                                <button
                                  type="button"
                                  className={`status-btn ${currentStatus === 'present' ? 'active present' : ''}`}
                                  onClick={() => onUpdateRecord(student.id, currentStatus === 'present' ? null : 'present')}
                                  title={currentStatus === 'present' ? "Click to clear / unmark" : "Mark Present"}
                                >
                                  <span>P</span>
                                  <span className="hide-on-mobile">Present</span>
                                </button>

                                <button
                                  type="button"
                                  className={`status-btn ${currentStatus === 'absent' ? 'active absent' : ''}`}
                                  onClick={() => onUpdateRecord(student.id, currentStatus === 'absent' ? null : 'absent')}
                                  title={currentStatus === 'absent' ? "Click to clear / unmark" : "Mark Absent"}
                                >
                                  <span>A</span>
                                  <span className="hide-on-mobile">Absent</span>
                                </button>

                                <button
                                  type="button"
                                  className={`status-btn ${currentStatus === 'late' ? 'active late' : ''}`}
                                  onClick={() => onUpdateRecord(student.id, currentStatus === 'late' ? null : 'late')}
                                  title={currentStatus === 'late' ? "Click to clear / unmark" : "Mark Late"}
                                >
                                  <span>L</span>
                                  <span className="hide-on-mobile">Late</span>
                                </button>

                                <button
                                  type="button"
                                  className={`status-btn ${currentStatus === 'excused' ? 'active excused' : ''}`}
                                  onClick={() => onUpdateRecord(student.id, currentStatus === 'excused' ? null : 'excused')}
                                  title={currentStatus === 'excused' ? "Click to clear / unmark" : "Mark Excused"}
                                >
                                  <span>E</span>
                                  <span className="hide-on-mobile">Excused</span>
                                </button>
                              </div>

                              {/* Remark / Note Button */}
                              <button
                                type="button"
                                className={`remark-btn ${record?.remarks ? 'has-remark' : ''}`}
                                onClick={() => onOpenRemarkModal(student)}
                                title={record?.remarks ? `Remark: "${record.remarks}"` : 'Add note/excuse reason'}
                              >
                                <MessageSquare size={13} />
                                <span>{record?.remarks ? 'Note' : '+ Note'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
