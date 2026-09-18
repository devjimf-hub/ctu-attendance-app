import React, { useState } from 'react';
import {
  Sparkles,
  MessageSquare,
  AlertTriangle,
  Columns
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  Student,
  AttendanceSession,
  AttendanceStatus,
  StudentAttendanceSummary
} from '../types';
import { parseNameParts } from '../utils/collegeUtils';

interface RollCallSeatingGridProps {
  students: Student[];
  session: AttendanceSession;
  summaries: StudentAttendanceSummary[];
  onUpdateRecord: (studentId: string, status: AttendanceStatus) => void;
  onBulkUpdateStatus: (status: AttendanceStatus, targetStudents?: Student[]) => void;
  onOpenRemarkModal: (student: Student) => void;
}

export const RollCallSeatingGrid: React.FC<RollCallSeatingGridProps> = ({
  students,
  session,
  summaries,
  onUpdateRecord,
  onBulkUpdateStatus,
  onOpenRemarkModal
}) => {
  const [columns, setColumns] = useState<number>(4);

  const getSummary = (studentId: string) => {
    return summaries.find(s => s.student.id === studentId);
  };

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(15);
      } catch {
        // Safe fallback
      }
    }
  };

  /**
   * Cycle status on single tap:
   * None -> Present -> Late -> Absent -> Excused -> (back to Present)
   */
  const handleCycleStatus = (studentId: string) => {
    triggerHaptic();
    const currentRecord = session.records[studentId];
    if (!currentRecord) {
      onUpdateRecord(studentId, 'present');
    } else if (currentRecord.status === 'present') {
      onUpdateRecord(studentId, 'late');
    } else if (currentRecord.status === 'late') {
      onUpdateRecord(studentId, 'absent');
    } else if (currentRecord.status === 'absent') {
      onUpdateRecord(studentId, 'excused');
    } else {
      onUpdateRecord(studentId, 'present');
    }
  };

  // Quick action: Mark remaining unmarked students as Present
  const handleMarkUnmarkedPresent = () => {
    const unmarked = students.filter(s => !session.records[s.id]);
    if (unmarked.length > 0) {
      onBulkUpdateStatus('present', unmarked);
      try {
        confetti({
          particleCount: 35,
          spread: 60,
          origin: { y: 0.8 }
        });
      } catch {
        // ignore
      }
    }
  };

  // Compute stats
  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let excusedCount = 0;
  let unmarkedCount = 0;

  students.forEach(s => {
    const rec = session.records[s.id];
    if (!rec) unmarkedCount++;
    else if (rec.status === 'present') presentCount++;
    else if (rec.status === 'late') lateCount++;
    else if (rec.status === 'absent') absentCount++;
    else if (rec.status === 'excused') excusedCount++;
  });

  return (
    <div className="seating-grid-container">
      {/* Classroom Controls & Summary Header */}
      <div className="seating-toolbar glass-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            <Columns size={15} />
            <span>Desks per Row:</span>
          </div>

          <div className="segmented-control" style={{ padding: '2px' }}>
            {[2, 3, 4, 5, 6].map(col => (
              <button
                key={col}
                type="button"
                className={`segmented-btn ${columns === col ? 'active' : ''}`}
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                onClick={() => setColumns(col)}
              >
                {col}
              </button>
            ))}
          </div>

          {unmarkedCount > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleMarkUnmarkedPresent}
              style={{ marginLeft: 'auto' }}
            >
              <Sparkles size={13} />
              <span>Mark {unmarkedCount} Unmarked as Present</span>
            </button>
          )}
        </div>

        {/* Live Headcount Chips */}
        <div className="seating-headcount-row">
          <span className="badge badge-present" style={{ padding: '0.2rem 0.6rem' }}>
            🟢 {presentCount} Present
          </span>
          <span className="badge badge-late" style={{ padding: '0.2rem 0.6rem' }}>
            🟠 {lateCount} Late
          </span>
          <span className="badge badge-absent" style={{ padding: '0.2rem 0.6rem' }}>
            🔴 {absentCount} Absent
          </span>
          <span className="badge badge-excused" style={{ padding: '0.2rem 0.6rem' }}>
            🔵 {excusedCount} Excused
          </span>
          {unmarkedCount > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              ⚪ {unmarkedCount} Unmarked
            </span>
          )}
        </div>
      </div>

      {/* Classroom Podium / Front of Room Banner */}
      <div className="classroom-podium-bar">
        <span>👨‍🏫 FRONT OF ROOM / INSTRUCTOR PODIUM & WHITEBOARD</span>
      </div>

      {/* Dynamic Seating Grid */}
      <div
        className="classroom-desks-grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`
        }}
      >
        {students.map((student, idx) => {
          const record = session.records[student.id];
          const summary = getSummary(student.id);
          const parsed = parseNameParts(student.name);

          const statusClass = record ? `status-${record.status}` : 'status-unmarked';
          const isCompact = columns >= 4;

          return (
            <div
              key={student.id}
              className={`desk-seat-card ${statusClass} ${isCompact ? 'is-compact' : ''}`}
              onClick={() => handleCycleStatus(student.id)}
            >
              <div className="desk-seat-header">
                <span className="desk-seat-num">#{idx + 1}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  {summary && (summary.statusCategory === 'critical' || summary.statusCategory === 'warning') && (
                    <span title={`${summary.attendancePercentage}% Attendance Warning`}>
                      <AlertTriangle size={11} color="var(--status-absent)" />
                    </span>
                  )}
                  {record?.remarks && (
                    <span title={record.remarks}>
                      <MessageSquare size={11} color="var(--primary)" />
                    </span>
                  )}
                </div>
              </div>

              <div className="desk-avatar-row">
                <div className="desk-avatar">
                  {student.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="desk-student-name" title={parsed.displayName}>
                    {parsed.displayName}
                  </div>
                  <div className="desk-student-id">
                    {student.studentId}
                  </div>
                </div>
              </div>

              {/* Status Pill Indicator */}
              <div className="desk-status-pill">
                {record ? (
                  <>
                    <span className="full-status">{record.status.toUpperCase()}</span>
                    <span className="short-status">{record.status.charAt(0).toUpperCase()}</span>
                  </>
                ) : (
                  <>
                    <span className="full-status">UNMARKED</span>
                    <span className="short-status">--</span>
                  </>
                )}
              </div>

              {/* Quick Remark Trigger */}
              <button
                type="button"
                className="desk-remark-btn"
                onClick={e => {
                  e.stopPropagation();
                  onOpenRemarkModal(student);
                }}
                title="Add Note"
              >
                <MessageSquare size={10} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Bottom Hint */}
      <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        💡 <strong>Pro-Tip:</strong> Click any desk to cycle status (Present ➔ Late ➔ Absent ➔ Excused). Click the speech bubble icon to add custom remarks.
      </div>
    </div>
  );
};
