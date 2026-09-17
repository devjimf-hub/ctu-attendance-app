import React, { useState } from 'react';
import { Search, Plus, Trash2, Edit2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Course, Student, StudentAttendanceSummary } from '../types';
import { sortStudentsByLastName, parseNameParts } from '../utils/collegeUtils';

interface RosterViewProps {
  course: Course;
  students: Student[];
  summaries: StudentAttendanceSummary[];
  onOpenAddModal: () => void;
  onDeleteStudent: (studentId: string) => void;
  onEditStudent: (student: Student) => void;
}

export const RosterView: React.FC<RosterViewProps> = ({
  course,
  students,
  summaries,
  onOpenAddModal,
  onDeleteStudent,
  onEditStudent
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredStudents = sortStudentsByLastName(
    students.filter(
      s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.major && s.major.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  );

  const getSummary = (studentId: string) => summaries.find(sm => sm.student.id === studentId);

  return (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      {/* Roster Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 700 }}>
            {course.code} Student Roster ({students.length} Enrolled)
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Section: <strong>{course.section}</strong> • {course.semester}
          </p>
        </div>

        <button className="btn btn-primary btn-sm" onClick={onOpenAddModal}>
          <Plus size={16} />
          Add / Import Students
        </button>
      </div>

      {/* Search Filter */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search enrolled students..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table of Students */}
      {filteredStudents.length === 0 ? (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {students.length === 0
            ? 'No students enrolled in this course yet. Click "Add / Import Students" to get started!'
            : 'No students match the search criteria.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem 0.5rem' }}>#</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Student ID</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Full Name</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Program / Major</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Year Level</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Attendance Rate</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student, idx) => {
                const summary = getSummary(student.id);
                return (
                  <tr key={student.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>
                      {student.studentId}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {parseNameParts(student.name).displayName}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>
                      {student.major || '—'}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>
                      {student.yearLevel || '—'}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontWeight: 700 }}>{summary ? `${summary.attendancePercentage}%` : '100%'}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          ({summary?.presentCount || 0}P / {summary?.absentCount || 0}A)
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      {summary?.statusCategory === 'critical' ? (
                        <span className="warning-pill critical">
                          <AlertTriangle size={12} /> FDA / Dropped
                        </span>
                      ) : summary?.statusCategory === 'warning' ? (
                        <span className="warning-pill warning">
                          <AlertTriangle size={12} /> At Risk
                        </span>
                      ) : (
                        <span className="warning-pill good">
                          <CheckCircle2 size={12} /> Good
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                      <button
                        className="btn-icon"
                        style={{ width: '30px', height: '30px', marginRight: '0.35rem' }}
                        onClick={() => onEditStudent(student)}
                        title="Edit Student Info"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="btn-icon"
                        style={{ width: '30px', height: '30px', color: 'var(--status-absent)' }}
                        onClick={() => {
                          if (confirm(`Remove "${student.name}" from ${course.code}?`)) {
                            onDeleteStudent(student.id);
                          }
                        }}
                        title="Delete Student"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
