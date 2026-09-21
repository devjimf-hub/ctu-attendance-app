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
  Search
} from 'lucide-react';
import {
  Course,
  Student,
  AttendanceSession,
  AttendanceStatus,
  StudentAttendanceSummary,
  TeacherUser
} from '../types';
import { PrintableSummary } from './PrintableSummary';
import { AttendanceSheet } from './AttendanceSheet';
import { sortStudentsByLastName, parseNameParts } from '../utils/collegeUtils';

interface SubjectDetailProps {
  course: Course;
  students: Student[];
  session: AttendanceSession;
  sessions: AttendanceSession[];
  summaries: StudentAttendanceSummary[];
  teacher: TeacherUser | null;
  onBackToDashboard: () => void;
  onUpdateRecord: (studentId: string, status: AttendanceStatus | null) => void;
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
  const [studentSearch, setStudentSearch] = useState('');

  const filteredStudents = sortStudentsByLastName(
    students.filter(s =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.studentId.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.major && s.major.toLowerCase().includes(studentSearch.toLowerCase()))
    )
  );

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
            <span>All Classes</span>
          </button>

          <button
            className="subject-banner-settings-btn"
            onClick={() => onOpenEditCourse(course)}
            title="Class Settings & Edit Info"
          >
            <Settings size={14} />
            <span>Class Settings</span>
          </button>
        </div>

        <h1 className="subject-banner-title">{course.name}</h1>
        
        {/* Clean, formatted metadata badges instead of crammed text */}
        <div className="subject-banner-badges">
          {course.code && (
            <div className="subject-meta-badge">
              <span className="subject-meta-badge-label">Code</span>
              <strong>{course.code}</strong>
            </div>
          )}
          <div className="subject-meta-badge">
            <span className="subject-meta-badge-label">Section</span>
            <strong>{course.section}</strong>
          </div>
          <div className="subject-meta-badge">
            <span className="subject-meta-badge-label">Term</span>
            <strong>{course.semester}</strong>
          </div>
          {course.room && (
            <div className="subject-meta-badge">
              <span className="subject-meta-badge-label">Room</span>
              <strong>{course.room}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Classroom Navigation Tabs */}
      <div className="classroom-tabs no-print">
        <button
          className={`classroom-tab ${activeTab === 'rollcall' ? 'active' : ''}`}
          onClick={() => setActiveTab('rollcall')}
        >
          <CalendarDays size={17} />
          <span>Roll Call</span>
        </button>

        <button
          className={`classroom-tab ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveTab('students')}
        >
          <Users size={17} />
          <span>Students <span className="tab-badge">({students.length})</span></span>
        </button>

        <button
          className={`classroom-tab ${activeTab === 'print' ? 'active' : ''}`}
          onClick={() => setActiveTab('print')}
        >
          <Printer size={17} />
          <span>Summary<span className="hide-on-mobile"> & Print</span></span>
        </button>
      </div>

      {/* TAB 1: ROLL CALL (With 🎛️ Segmented Multi-Mode Switcher: List, Speed Cards, Seating Grid) */}
      {activeTab === 'rollcall' && (
        <AttendanceSheet
          course={course}
          students={students}
          session={session}
          summaries={summaries}
          onUpdateRecord={onUpdateRecord}
          onBulkUpdateStatus={onBulkUpdateStatus}
          onUpdateSessionDate={onUpdateSessionDate}
          onUpdateSessionType={onUpdateSessionType}
          onUpdateSessionTopic={onUpdateSessionTopic}
          onOpenRemarkModal={onOpenRemarkModal}
          onOpenAddStudents={onOpenAddStudents}
        />
      )}

      {/* TAB 2: STUDENTS ROSTER */}
      {activeTab === 'students' && (
        <div className="student-roster-container">
          <div className="student-roster-toolbar">
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>
              Enrolled Students ({students.length})
            </h3>

            <div className="student-roster-toolbar-controls">
              <div className="search-box" style={{ height: '36px', minWidth: '160px' }}>
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search roster..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                />
              </div>

              <button className="btn btn-primary btn-sm" onClick={onOpenAddStudents} style={{ whiteSpace: 'nowrap' }}>
                <Plus size={15} /> Add Students
              </button>
            </div>
          </div>

          {filteredStudents.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {students.length === 0 ? 'No students enrolled yet. Click "Add Students" to get started.' : 'No students found matching your search.'}
            </div>
          ) : (
            <>
              {/* Mobile Card List View (< 640px) */}
              <div className="student-roster-mobile-list">
                {filteredStudents.map((s, idx) => {
                  const sm = summaries.find(item => item.student.id === s.id);
                  const rate = sm ? sm.attendancePercentage : 100;
                  const nameParts = parseNameParts(s.name);

                  return (
                    <div key={s.id} className="student-roster-card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: 'var(--radius-full)',
                            background: 'var(--primary-light)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            flexShrink: 0
                          }}
                        >
                          {idx + 1}
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {nameParts.displayName}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>{s.studentId}</span>
                            <span>•</span>
                            <span>{s.major || s.yearLevel || course.section}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.45rem',
                            borderRadius: 'var(--radius-xs)',
                            background: rate >= 80 ? 'var(--status-present-bg)' : 'var(--status-absent-bg)',
                            color: rate >= 80 ? 'var(--status-present)' : 'var(--status-absent)'
                          }}
                        >
                          {rate}%
                        </span>

                        <button
                          type="button"
                          className="btn-icon"
                          style={{ width: '30px', height: '30px' }}
                          onClick={() => onEditStudent(s)}
                          title="Edit Student"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon"
                          style={{ width: '30px', height: '30px', color: 'var(--google-red)' }}
                          onClick={() => {
                            if (confirm(`Remove student "${s.name}"?`)) onDeleteStudent(s.id);
                          }}
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop / Tablet Table View (>= 640px) */}
              <div className="student-roster-desktop-table-wrapper">
                <table className="student-roster-desktop-table" style={{ borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.6rem 0.5rem', width: '40px' }}>#</th>
                      <th style={{ padding: '0.6rem 0.5rem' }}>ID</th>
                      <th style={{ padding: '0.6rem 0.5rem' }}>Student Name (Last, First)</th>
                      <th style={{ padding: '0.6rem 0.5rem' }}>Major / Section</th>
                      <th style={{ padding: '0.6rem 0.5rem' }}>Attendance Rate</th>
                      <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s, idx) => {
                      const sm = summaries.find(item => item.student.id === s.id);
                      const rate = sm ? sm.attendancePercentage : 100;
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ padding: '0.6rem 0.5rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)' }}>
                            {s.studentId}
                          </td>
                          <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>{parseNameParts(s.name).displayName}</td>
                          <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-secondary)' }}>
                            {s.major || s.yearLevel || course.section}
                          </td>
                          <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700 }}>
                            <span style={{ color: rate >= 80 ? 'var(--status-present)' : 'var(--status-absent)' }}>
                              {rate}%
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn-icon"
                              style={{ width: '28px', height: '28px', marginRight: '0.25rem' }}
                              onClick={() => onEditStudent(s)}
                              title="Edit Student"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
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
            </>
          )}
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
