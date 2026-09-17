import React, { useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Users,
  Printer,
  Settings,
  Plus,
  Edit2,
  Trash2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  AlertTriangle,
  Search
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  Course,
  Student,
  AttendanceSession,
  AttendanceStatus,
  StudentAttendanceSummary,
  TeacherUser
} from '../types';
import { PrintableSummary } from './PrintableSummary';
import { sortStudentsByLastName, parseNameParts } from '../utils/collegeUtils';

interface SubjectDetailProps {
  course: Course;
  students: Student[];
  session: AttendanceSession;
  sessions: AttendanceSession[];
  summaries: StudentAttendanceSummary[];
  teacher: TeacherUser | null;
  onBackToDashboard: () => void;
  onUpdateRecord: (studentId: string, status: AttendanceStatus) => void;
  onBulkUpdateStatus: (status: AttendanceStatus, targetStudents?: Student[]) => void;
  onUpdateSessionDate: (date: string) => void;
  onUpdateSessionType: (type: 'lecture' | 'lab' | 'tutorial' | 'exam') => void;
  onUpdateSessionTopic: (topic: string) => void;
  onOpenRemarkModal: (student: Student) => void;
  onOpenAddStudents: () => void;
  onOpenEditCourse: (course: Course) => void;
  onDeleteStudent: (studentId: string) => void;
  onEditStudent: (student: Student) => void;
}

export const SubjectDetail: React.FC<SubjectDetailProps> = ({
  course,
  students,
  session,
  sessions,
  summaries,
  teacher,
  onBackToDashboard,
  onUpdateRecord,
  onBulkUpdateStatus,
  onUpdateSessionDate,
  onUpdateSessionType,
  onUpdateSessionTopic,
  onOpenRemarkModal,
  onOpenAddStudents,
  onOpenEditCourse,
  onDeleteStudent,
  onEditStudent
}) => {
  const [activeTab, setActiveTab] = useState<'rollcall' | 'students' | 'print'>('rollcall');
  const [searchTerm, setSearchTerm] = useState('');

  // Headcount
  const totalStudents = students.length;
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let excusedCount = 0;

  students.forEach(student => {
    const record = session.records[student.id];
    if (record) {
      if (record.status === 'present') presentCount++;
      else if (record.status === 'absent') absentCount++;
      else if (record.status === 'late') lateCount++;
      else if (record.status === 'excused') excusedCount++;
    }
  });

  // Filtered and alphabetically sorted by LAST NAME (A to Z)
  const filteredStudents = sortStudentsByLastName(
    students.filter(
      s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.major && s.major.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  );

  const handleStepDate = (days: number) => {
    const d = new Date(session.date);
    d.setDate(d.getDate() + days);
    onUpdateSessionDate(d.toISOString().slice(0, 10));
  };

  const handleMarkAllPresent = () => {
    onBulkUpdateStatus('present');
    try {
      confetti({
        particleCount: 35,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#137333', '#1a73e8', '#f9ab00']
      });
    } catch {
      // safe fallback
    }
  };

  return (
    <div>
      {/* Subject Header Banner (Google Classroom Style) */}
      <div
        className="subject-header-banner no-print"
        style={{
          backgroundColor: course.color || '#1a73e8',
          backgroundImage: `linear-gradient(135deg, ${course.color || '#1a73e8'} 0%, rgba(0,0,0,0.35) 100%)`
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="back-to-dashboard-btn" onClick={onBackToDashboard}>
            <ArrowLeft size={14} />
            <span>All Subjects</span>
          </button>

          <button
            className="subject-banner-settings-btn"
            onClick={() => onOpenEditCourse(course)}
            title="Subject Settings & Edit Info"
          >
            <Settings size={14} />
            <span>Subject Settings</span>
          </button>
        </div>

        <h1 className="subject-banner-title">{course.name}</h1>
        <div className="subject-banner-subtitle">
          {course.code} • Section: <strong>{course.section}</strong> • {course.semester}
          {course.room && ` • Room: ${course.room}`}
        </div>
      </div>

      {/* Classroom Navigation Tabs */}
      <div className="classroom-tabs no-print">
        <button
          className={`classroom-tab ${activeTab === 'rollcall' ? 'active' : ''}`}
          onClick={() => setActiveTab('rollcall')}
        >
          <CalendarDays size={18} />
          Roll Call
        </button>

        <button
          className={`classroom-tab ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          <Users size={18} />
          Students ({students.length})
        </button>

        <button
          className={`classroom-tab ${activeTab === 'print' ? 'active' : ''}`}
          onClick={() => setActiveTab('print')}
        >
          <Printer size={18} />
          Summary & Print
        </button>
      </div>

      {/* TAB 1: ROLL CALL */}
      {activeTab === 'rollcall' && (
        <div>
          {/* Roll Call Control Bar */}
          <div className="rollcall-control-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* Date Selector */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  className="btn-icon"
                  style={{ width: '32px', height: '32px' }}
                  onClick={() => handleStepDate(-1)}
                  title="Previous Day"
                >
                  <ChevronLeft size={16} />
                </button>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: '140px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                  value={session.date}
                  onChange={e => onUpdateSessionDate(e.target.value)}
                />
                <button
                  className="btn-icon"
                  style={{ width: '32px', height: '32px' }}
                  onClick={() => handleStepDate(1)}
                  title="Next Day"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Session Type */}
              <select
                className="form-select"
                style={{ width: 'auto', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                value={session.sessionType}
                onChange={e => onUpdateSessionType(e.target.value as any)}
              >
                <option value="lecture">📖 Lecture</option>
                <option value="lab">🔬 Laboratory</option>
                <option value="tutorial">💡 Tutorial</option>
                <option value="exam">📝 Examination</option>
              </select>

              {/* Lesson Topic */}
              <input
                type="text"
                className="form-input"
                style={{ width: '180px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                placeholder="Topic / Lesson name"
                value={session.topic || ''}
                onChange={e => onUpdateSessionTopic(e.target.value)}
              />
            </div>

            {/* Quick Batch Actions */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-sm btn-primary" onClick={handleMarkAllPresent}>
                <Sparkles size={14} />
                Mark All Present
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  const unmarked = students.filter(s => !session.records[s.id]);
                  if (unmarked.length > 0) {
                    onBulkUpdateStatus('absent', unmarked);
                  }
                }}
              >
                Mark Unmarked Absent
              </button>
            </div>
          </div>

          {/* Headcount Stat Chips */}
          <div className="rollcall-chips">
            <div className="rollcall-chip present">
              <div className="rollcall-chip-val" style={{ color: 'var(--google-green)' }}>
                {presentCount}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/{totalStudents}</span>
              </div>
              <div className="rollcall-chip-lbl">Present</div>
            </div>

            <div className="rollcall-chip absent">
              <div className="rollcall-chip-val" style={{ color: 'var(--google-red)' }}>
                {absentCount}
              </div>
              <div className="rollcall-chip-lbl">Absent</div>
            </div>

            <div className="rollcall-chip late">
              <div className="rollcall-chip-val" style={{ color: 'var(--google-yellow)' }}>
                {lateCount}
              </div>
              <div className="rollcall-chip-lbl">Late</div>
            </div>

            <div className="rollcall-chip excused">
              <div className="rollcall-chip-val" style={{ color: 'var(--google-blue)' }}>
                {excusedCount}
              </div>
              <div className="rollcall-chip-lbl">Excused</div>
            </div>
          </div>

          {/* Search Bar */}
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.2rem' }}
              placeholder="Search student by name or ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Student Roll Call List */}
          {students.length === 0 ? (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '3rem 1.5rem', textAlign: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', marginBottom: '0.35rem' }}>No Students in this Subject</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                Add your students or paste a list from Excel to start taking attendance.
              </p>
              <button className="btn btn-primary" onClick={onOpenAddStudents}>
                <Plus size={16} /> Add Students / Paste List
              </button>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No students match "{searchTerm}".
            </div>
          ) : (
            <div>
              {filteredStudents.map(student => {
                const record = session.records[student.id];
                const currentStatus = record?.status;
                const summary = summaries.find(sm => sm.student.id === student.id);
                const nameInfo = parseNameParts(student.name);

                return (
                  <div key={student.id} className="student-rollcall-card">
                    {/* Student Meta */}
                    <div className="student-meta">
                      <div
                        className="student-initial-circle"
                        style={{ background: (course.color || '#1a73e8') + '20', color: course.color || '#1a73e8' }}
                      >
                        {nameInfo.lastName.charAt(0) || student.name.charAt(0)}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '0.95rem' }}>{nameInfo.displayName}</strong>
                          {summary?.statusCategory === 'critical' && (
                            <span className="badge-warning-critical">
                              <AlertTriangle size={10} /> FDA Dropped Risk
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem' }}>
                          <span style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>
                            {student.studentId}
                          </span>
                          {student.major && <span>• {student.major}</span>}
                          {summary && (
                            <span style={{ fontWeight: 600, color: summary.attendancePercentage < 75 ? 'var(--status-absent)' : 'var(--text-muted)' }}>
                              ({summary.attendancePercentage}% overall)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 4-Way Mobile Status Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <div className="mobile-status-bar" style={{ flex: 1, minWidth: '220px' }}>
                        <button
                          type="button"
                          className={`mobile-status-btn ${currentStatus === 'present' ? 'active present' : ''}`}
                          onClick={() => onUpdateRecord(student.id, 'present')}
                        >
                          P
                        </button>
                        <button
                          type="button"
                          className={`mobile-status-btn ${currentStatus === 'absent' ? 'active absent' : ''}`}
                          onClick={() => onUpdateRecord(student.id, 'absent')}
                        >
                          A
                        </button>
                        <button
                          type="button"
                          className={`mobile-status-btn ${currentStatus === 'late' ? 'active late' : ''}`}
                          onClick={() => onUpdateRecord(student.id, 'late')}
                        >
                          L
                        </button>
                        <button
                          type="button"
                          className={`mobile-status-btn ${currentStatus === 'excused' ? 'active excused' : ''}`}
                          onClick={() => onUpdateRecord(student.id, 'excused')}
                        >
                          E
                        </button>
                      </div>

                      {/* Note / Remarks */}
                      <button
                        type="button"
                        className="btn-icon"
                        style={{ color: record?.remarks ? '#1a73e8' : 'var(--text-muted)' }}
                        onClick={() => onOpenRemarkModal(student)}
                        title={record?.remarks ? `Remark: "${record.remarks}"` : 'Add note'}
                      >
                        <MessageSquare size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STUDENTS ROSTER */}
      {activeTab === 'students' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem' }}>
              Enrolled Students ({students.length})
            </h3>
            <button className="btn btn-primary btn-sm" onClick={onOpenAddStudents}>
              <Plus size={16} /> Add / Paste Students
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.6rem 0.5rem' }}>ID</th>
                  <th style={{ padding: '0.6rem 0.5rem' }}>Student Name (Last, First)</th>
                  <th style={{ padding: '0.6rem 0.5rem' }}>Major / Year</th>
                  <th style={{ padding: '0.6rem 0.5rem' }}>Attendance</th>
                  <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortStudentsByLastName(students).map(s => {
                  const sm = summaries.find(item => item.student.id === s.id);
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.6rem 0.5rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>
                        {s.studentId}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>{parseNameParts(s.name).displayName}</td>
                      <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-secondary)' }}>
                        {s.major || s.yearLevel || '—'}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700 }}>
                        {sm ? `${sm.attendancePercentage}%` : '100%'}
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                        <button
                          className="btn-icon"
                          style={{ width: '28px', height: '28px', marginRight: '0.25rem' }}
                          onClick={() => onEditStudent(s)}
                          title="Edit Student"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          className="btn-icon"
                          style={{ width: '28px', height: '28px', color: 'var(--google-red)' }}
                          onClick={() => {
                            if (confirm(`Remove student "${s.name}"?`)) onDeleteStudent(s.id);
                          }}
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PRINT SUMMARY / MATRIX */}
      {activeTab === 'print' && (
        <PrintableSummary
          course={course}
          students={students}
          sessions={sessions}
          summaries={summaries}
          teacher={teacher}
          onBack={() => setActiveTab('rollcall')}
        />
      )}
    </div>
  );
};
