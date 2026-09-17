import React, { useState } from 'react';
import {
  Search,
  MessageSquare,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Sparkles
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

interface AttendanceSheetProps {
  course: Course;
  students: Student[];
  session: AttendanceSession;
  summaries: StudentAttendanceSummary[];
  onUpdateRecord: (studentId: string, status: AttendanceStatus) => void;
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

  // Date stepper handlers
  const handleStepDate = (days: number) => {
    const d = new Date(session.date);
    d.setDate(d.getDate() + days);
    onUpdateSessionDate(d.toISOString().slice(0, 10));
  };

  const getStudentSummary = (studentId: string) => {
    return summaries.find(s => s.student.id === studentId);
  };

  return (
    <div>
      {/* Attendance Control & Date Bar */}
      <div className="attendance-toolbar glass-panel">
        <div className="session-config-row">
          {/* Date Picker with stepper */}
          <div className="date-input-wrapper">
            <button
              className="btn-icon"
              style={{ width: '34px', height: '34px', borderRadius: 'var(--radius-md) 0 0 var(--radius-md)' }}
              onClick={() => handleStepDate(-1)}
              title="Previous Day"
            >
              <ChevronLeft size={16} />
            </button>
            <input
              type="date"
              className="date-input"
              style={{ borderRadius: 0 }}
              value={session.date}
              onChange={e => onUpdateSessionDate(e.target.value)}
            />
            <button
              className="btn-icon"
              style={{ width: '34px', height: '34px', borderRadius: '0 var(--radius-md) var(--radius-md) 0' }}
              onClick={() => handleStepDate(1)}
              title="Next Day"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Session Type Select */}
          <select
            className="custom-select"
            value={session.sessionType}
            onChange={e => onUpdateSessionType(e.target.value as any)}
          >
            <option value="lecture">📖 Lecture Session</option>
            <option value="lab">🔬 Laboratory Session</option>
            <option value="tutorial">💡 Tutorial / Discussion</option>
            <option value="exam">📝 Examination / Midterm</option>
          </select>

          {/* Optional Topic Input */}
          <input
            type="text"
            className="form-input"
            style={{ width: '220px', padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
            placeholder="Topic (e.g. Trees, SQL)"
            value={session.topic || ''}
            onChange={e => onUpdateSessionTopic(e.target.value)}
          />
        </div>

        {/* Quick Batch Actions */}
        <div className="quick-actions-row">
          <button
            className="btn btn-sm btn-primary"
            onClick={handleMarkAllPresent}
            title="Mark all students as present"
          >
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
            title="Mark unmarked students as absent"
          >
            Mark Unmarked Absent
          </button>
        </div>
      </div>

      {/* Headcount Stat Badges */}
      <div className="headcount-bar">
        <div
          className="stat-pill-card present"
          style={{ cursor: 'pointer' }}
          onClick={() => setStatusFilter(statusFilter === 'present' ? 'all' : 'present')}
        >
          <div>
            <div className="stat-label">Present</div>
            <div className="stat-value" style={{ color: 'var(--status-present)' }}>
              {presentCount}
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                /{totalStudents}
              </span>
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--status-present)', fontWeight: 700 }}>
            {totalStudents > 0 ? `${Math.round((presentCount / totalStudents) * 100)}%` : '0%'}
          </div>
        </div>

        <div
          className="stat-pill-card absent"
          style={{ cursor: 'pointer' }}
          onClick={() => setStatusFilter(statusFilter === 'absent' ? 'all' : 'absent')}
        >
          <div>
            <div className="stat-label">Absent</div>
            <div className="stat-value" style={{ color: 'var(--status-absent)' }}>
              {absentCount}
            </div>
          </div>
        </div>

        <div
          className="stat-pill-card late"
          style={{ cursor: 'pointer' }}
          onClick={() => setStatusFilter(statusFilter === 'late' ? 'all' : 'late')}
        >
          <div>
            <div className="stat-label">Late / Tardy</div>
            <div className="stat-value" style={{ color: 'var(--status-late)' }}>
              {lateCount}
            </div>
          </div>
        </div>

        <div
          className="stat-pill-card excused"
          style={{ cursor: 'pointer' }}
          onClick={() => setStatusFilter(statusFilter === 'excused' ? 'all' : 'excused')}
        >
          <div>
            <div className="stat-label">Excused</div>
            <div className="stat-value" style={{ color: 'var(--status-excused)' }}>
              {excusedCount}
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: '220px' }}>
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
            className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStatusFilter('all')}
          >
            All ({totalStudents})
          </button>
          {unmarkedCount > 0 && (
            <button
              className={`btn btn-sm ${statusFilter === 'unmarked' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter('unmarked')}
              style={{ color: 'var(--accent-amber)' }}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                        <span style={{ marginLeft: 'auto', fontWeight: 600, color: summary.attendancePercentage < 75 ? 'var(--status-absent)' : 'var(--text-muted)' }}>
                          {summary.attendancePercentage}% overall
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tactile 4-way Status Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <div className="status-selector-group">
                    <button
                      type="button"
                      className={`status-btn ${currentStatus === 'present' ? 'active present' : ''}`}
                      onClick={() => onUpdateRecord(student.id, 'present')}
                      title="Mark Present"
                    >
                      <span>P</span>
                      <span className="hide-on-mobile">Present</span>
                    </button>

                    <button
                      type="button"
                      className={`status-btn ${currentStatus === 'absent' ? 'active absent' : ''}`}
                      onClick={() => onUpdateRecord(student.id, 'absent')}
                      title="Mark Absent"
                    >
                      <span>A</span>
                      <span className="hide-on-mobile">Absent</span>
                    </button>

                    <button
                      type="button"
                      className={`status-btn ${currentStatus === 'late' ? 'active late' : ''}`}
                      onClick={() => onUpdateRecord(student.id, 'late')}
                      title="Mark Late"
                    >
                      <span>L</span>
                      <span className="hide-on-mobile">Late</span>
                    </button>

                    <button
                      type="button"
                      className={`status-btn ${currentStatus === 'excused' ? 'active excused' : ''}`}
                      onClick={() => onUpdateRecord(student.id, 'excused')}
                      title="Mark Excused"
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
    </div>
  );
};
