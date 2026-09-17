import React from 'react';
import {
  Download,
  AlertTriangle,
  CheckCircle2,
  Award,
  TrendingDown
} from 'lucide-react';
import { Course, Student, AttendanceSession, StudentAttendanceSummary } from '../types';
import { exportAttendanceToCSV } from '../utils/collegeUtils';

interface AnalyticsViewProps {
  course: Course;
  students: Student[];
  sessions: AttendanceSession[];
  summaries: StudentAttendanceSummary[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  course,
  students,
  sessions,
  summaries
}) => {
  const totalSessions = sessions.length;

  // Calculate course-level overall attendance percentage
  let overallPercentage = 0;
  if (summaries.length > 0) {
    const sum = summaries.reduce((acc, curr) => acc + curr.attendancePercentage, 0);
    overallPercentage = Math.round(sum / summaries.length);
  }

  const criticalStudents = summaries.filter(s => s.statusCategory === 'critical');
  const warningStudents = summaries.filter(s => s.statusCategory === 'warning');
  const goodStudents = summaries.filter(s => s.statusCategory === 'good');

  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const handleExport = () => {
    exportAttendanceToCSV(course, students, sessions);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Course Average
            </span>
            <Award size={18} color="var(--primary)" />
          </div>
          <div style={{ fontSize: '2rem', fontFamily: 'var(--font-heading)', fontWeight: 800, marginTop: '0.5rem', color: overallPercentage >= 80 ? 'var(--status-present)' : 'var(--status-absent)' }}>
            {overallPercentage}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Across {totalSessions} recorded sessions
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Exam Eligible (&ge; 80%)
            </span>
            <CheckCircle2 size={18} color="var(--status-present)" />
          </div>
          <div style={{ fontSize: '2rem', fontFamily: 'var(--font-heading)', fontWeight: 800, marginTop: '0.5rem', color: 'var(--status-present)' }}>
            {goodStudents.length}
            <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              /{students.length}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Qualified for semester finals
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Absence Warning (&lt; 80%)
            </span>
            <AlertTriangle size={18} color="var(--accent-amber)" />
          </div>
          <div style={{ fontSize: '2rem', fontFamily: 'var(--font-heading)', fontWeight: 800, marginTop: '0.5rem', color: 'var(--status-late)' }}>
            {warningStudents.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Approaching maximum allowed cuts
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Critical / FDA Risk (&lt; 75%)
            </span>
            <TrendingDown size={18} color="var(--status-absent)" />
          </div>
          <div style={{ fontSize: '2rem', fontFamily: 'var(--font-heading)', fontWeight: 800, marginTop: '0.5rem', color: 'var(--status-absent)' }}>
            {criticalStudents.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Subject to debarment or failing grade
          </div>
        </div>
      </div>

      {/* College Absence Risk Notice if any */}
      {criticalStudents.length > 0 && (
        <div style={{ padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', background: 'var(--status-absent-bg)', border: '1px solid var(--status-absent-border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertTriangle size={20} color="var(--status-absent)" />
          <div>
            <strong style={{ color: 'var(--status-absent)' }}>Dean's Warning Alert:</strong>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              {criticalStudents.length} student(s) currently exceed college absence limits (&lt;75% attendance). Notice required before midterm/final exams.
            </div>
          </div>
        </div>
      )}

      {/* Attendance Matrix / History */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 700 }}>
              Semester Attendance Matrix
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Full student attendance history across all recorded classes
            </p>
          </div>

          <button className="btn btn-primary" onClick={handleExport}>
            <Download size={16} />
            Export CSV for Registrar
          </button>
        </div>

        {totalSessions === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No attendance sessions recorded for {course.code} yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.6rem 0.5rem' }}>Student</th>
                  <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>%</th>
                  {sortedSessions.map(session => (
                    <th key={session.id} style={{ padding: '0.6rem 0.5rem', textAlign: 'center', minWidth: '45px' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 600 }}>{session.date.slice(5)}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--primary)', textTransform: 'uppercase' }}>
                        {session.sessionType.slice(0, 3)}
                      </div>
                    </th>
                  ))}
                  <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map(summary => (
                  <tr key={summary.student.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.6rem 0.5rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{summary.student.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {summary.student.studentId}
                      </div>
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 700 }}>
                      {summary.attendancePercentage}%
                    </td>
                    {sortedSessions.map(session => {
                      const record = session.records[summary.student.id];
                      const status = record?.status;

                      let pillColor = 'var(--text-muted)';
                      let bg = 'transparent';
                      let letter = '-';

                      if (status === 'present') {
                        pillColor = 'var(--status-present)';
                        bg = 'var(--status-present-bg)';
                        letter = 'P';
                      } else if (status === 'absent') {
                        pillColor = 'var(--status-absent)';
                        bg = 'var(--status-absent-bg)';
                        letter = 'A';
                      } else if (status === 'late') {
                        pillColor = 'var(--status-late)';
                        bg = 'var(--status-late-bg)';
                        letter = 'L';
                      } else if (status === 'excused') {
                        pillColor = 'var(--status-excused)';
                        bg = 'var(--status-excused-bg)';
                        letter = 'E';
                      }

                      return (
                        <td key={session.id} style={{ padding: '0.6rem 0.3rem', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              width: '24px',
                              height: '24px',
                              lineHeight: '24px',
                              borderRadius: '4px',
                              backgroundColor: bg,
                              color: pillColor,
                              fontWeight: 700,
                              fontSize: '0.75rem'
                            }}
                            title={record?.remarks ? `Status: ${status} | Note: ${record.remarks}` : `Status: ${status || 'Unmarked'}`}
                          >
                            {letter}
                          </span>
                        </td>
                      );
                    })}
                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                      {summary.statusCategory === 'critical' ? (
                        <span className="warning-pill critical">Ineligible</span>
                      ) : summary.statusCategory === 'warning' ? (
                        <span className="warning-pill warning">At Risk</span>
                      ) : (
                        <span className="warning-pill good">Eligible</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
