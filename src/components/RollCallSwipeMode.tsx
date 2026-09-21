import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  X,
  Clock,
  ShieldAlert,
  RotateCcw,
  SkipForward,
  MessageSquare,
  Trophy,
  ChevronLeft,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  Student,
  AttendanceSession,
  AttendanceStatus,
  StudentAttendanceSummary
} from '../types';
import { parseNameParts } from '../utils/collegeUtils';

interface RollCallSwipeModeProps {
  students: Student[];
  session: AttendanceSession;
  summaries: StudentAttendanceSummary[];
  onUpdateRecord: (studentId: string, status: AttendanceStatus | null) => void;
  onOpenRemarkModal: (student: Student) => void;
  onSwitchToListMode: () => void;
}

interface SwipeHistoryEntry {
  studentIndex: number;
  studentId: string;
  wasMarked: boolean;
  previousStatus: AttendanceStatus | null;
}

export const RollCallSwipeMode: React.FC<RollCallSwipeModeProps> = ({
  students,
  session,
  summaries,
  onUpdateRecord,
  onOpenRemarkModal,
  onSwitchToListMode
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cardExitDirection, setCardExitDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null);
  const [historyStack, setHistoryStack] = useState<SwipeHistoryEntry[]>([]);

  const cardRef = useRef<HTMLDivElement>(null);

  // Find first unmarked student on initial load
  useEffect(() => {
    const firstUnmarkedIdx = students.findIndex(s => !session.records[s.id]);
    if (firstUnmarkedIdx >= 0) {
      setCurrentIndex(firstUnmarkedIdx);
    }
  }, [students.length]);

  const currentStudent = students[currentIndex] || null;
  const currentRecord = currentStudent ? session.records[currentStudent.id] : null;

  const getSummary = (studentId: string) => {
    return summaries.find(s => s.student.id === studentId);
  };

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(20);
      } catch {
        // Safe fallback
      }
    }
  };

  const markStudent = (status: AttendanceStatus) => {
    if (!currentStudent) return;

    const prevRecord = session.records[currentStudent.id];
    const historyEntry: SwipeHistoryEntry = {
      studentIndex: currentIndex,
      studentId: currentStudent.id,
      wasMarked: !!prevRecord,
      previousStatus: prevRecord ? prevRecord.status : null
    };

    triggerHaptic();
    onUpdateRecord(currentStudent.id, status);

    // Set exit animation
    if (status === 'present') setCardExitDirection('right');
    else if (status === 'absent') setCardExitDirection('left');
    else if (status === 'late') setCardExitDirection('up');
    else if (status === 'excused') setCardExitDirection('down');

    setTimeout(() => {
      setHistoryStack(prev => [...prev, historyEntry]);
      setCardExitDirection(null);
      setDragOffset({ x: 0, y: 0 });

      // Move to next student
      setCurrentIndex(prev => prev + 1);

      if (currentIndex === students.length - 1) {
        // Completed roll call!
        try {
          confetti({
            particleCount: 50,
            spread: 70,
            origin: { y: 0.7 }
          });
        } catch {
          // ignore
        }
      }
    }, 180);
  };

  const handleUndo = () => {
    if (historyStack.length === 0) {
      if (currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
        setCardExitDirection(null);
        setDragOffset({ x: 0, y: 0 });
        triggerHaptic();
      }
      return;
    }

    const lastEntry = historyStack[historyStack.length - 1];
    setHistoryStack(prev => prev.slice(0, prev.length - 1));
    setCurrentIndex(lastEntry.studentIndex);
    setCardExitDirection(null);
    setDragOffset({ x: 0, y: 0 });
    triggerHaptic();

    // Revert attendance record in session state
    if (lastEntry.wasMarked && lastEntry.previousStatus) {
      onUpdateRecord(lastEntry.studentId, lastEntry.previousStatus);
    } else {
      onUpdateRecord(lastEntry.studentId, null);
    }
  };

  const handleSkip = () => {
    if (currentIndex < students.length) {
      if (currentStudent) {
        const prevRecord = session.records[currentStudent.id];
        setHistoryStack(prev => [
          ...prev,
          {
            studentIndex: currentIndex,
            studentId: currentStudent.id,
            wasMarked: !!prevRecord,
            previousStatus: prevRecord ? prevRecord.status : null
          }
        ]);
      }
      setCurrentIndex(prev => prev + 1);
      setDragOffset({ x: 0, y: 0 });
      triggerHaptic();
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'p') {
        e.preventDefault();
        markStudent('present');
      } else if (key === 'a') {
        e.preventDefault();
        markStudent('absent');
      } else if (key === 'l') {
        e.preventDefault();
        markStudent('late');
      } else if (key === 'e') {
        e.preventDefault();
        markStudent('excused');
      } else if (key === 'arrowright' || key === ' ') {
        e.preventDefault();
        handleSkip();
      } else if (key === 'arrowleft' || key === 'backspace') {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, currentStudent, historyStack]);

  // Touch / Mouse Drag Gestures
  const handlePointerDown = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({ x: clientX, y: clientY });
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const dx = clientX - dragStart.x;
    const dy = clientY - dragStart.y;
    setDragOffset({ x: dx, y: dy });
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = 75;
    if (dragOffset.x > threshold) {
      markStudent('present');
    } else if (dragOffset.x < -threshold) {
      markStudent('absent');
    } else if (dragOffset.y < -threshold) {
      markStudent('late');
    } else if (dragOffset.y > threshold) {
      markStudent('excused');
    } else {
      // Return to center
      setDragOffset({ x: 0, y: 0 });
    }
  };

  // Compute overall session stats
  const totalCount = students.length;
  const markedCount = Object.keys(session.records).length;
  const progressPercent = totalCount > 0 ? Math.round((markedCount / totalCount) * 100) : 0;
  const summary = currentStudent ? getSummary(currentStudent.id) : null;
  const parsedName = currentStudent ? parseNameParts(currentStudent.name) : null;

  // Active Swipe Indicator Glow
  let swipeFeedback: { text: string; color: string; bg: string } | null = null;
  if (dragOffset.x > 40) {
    swipeFeedback = { text: 'PRESENT', color: 'var(--google-green)', bg: 'var(--status-present-bg)' };
  } else if (dragOffset.x < -40) {
    swipeFeedback = { text: 'ABSENT', color: 'var(--status-absent)', bg: 'var(--status-absent-bg)' };
  } else if (dragOffset.y < -40) {
    swipeFeedback = { text: 'LATE', color: 'var(--status-late)', bg: 'var(--status-late-bg)' };
  } else if (dragOffset.y > 40) {
    swipeFeedback = { text: 'EXCUSED', color: 'var(--primary)', bg: 'var(--primary-light)' };
  }

  // Card transform calculations
  const rotateDeg = dragOffset.x * 0.08;
  const cardStyle: React.CSSProperties = {
    transform: cardExitDirection
      ? cardExitDirection === 'right'
        ? 'translateX(140%) rotate(25deg)'
        : cardExitDirection === 'left'
        ? 'translateX(-140%) rotate(-25deg)'
        : cardExitDirection === 'up'
        ? 'translateY(-140%) scale(0.8)'
        : 'translateY(140%) scale(0.8)'
      : `translate(${dragOffset.x}px, ${dragOffset.y}px) rotate(${rotateDeg}deg)`,
    transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease'
  };

  return (
    <div className="swipe-rollcall-wrapper">
      {/* Top Header & Progress Bar */}
      <div className="swipe-progress-container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Student {currentIndex + 1} of {totalCount}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {markedCount} Marked ({progressPercent}%)
          </span>
        </div>
        <div className="swipe-progress-track">
          <div className="swipe-progress-bar" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Main Swipe Stage */}
      <div className="swipe-stage">
        {currentStudent ? (
          <div
            ref={cardRef}
            className={`swipe-card ${isDragging ? 'dragging' : ''}`}
            style={cardStyle}
            onMouseDown={e => handlePointerDown(e.clientX, e.clientY)}
            onMouseMove={e => handlePointerMove(e.clientX, e.clientY)}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={e => handlePointerDown(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchMove={e => handlePointerMove(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchEnd={handlePointerUp}
          >
            {/* Live Swipe Stamp Overlay */}
            {swipeFeedback && (
              <div
                className="swipe-stamp-badge"
                style={{
                  color: swipeFeedback.color,
                  borderColor: swipeFeedback.color,
                  background: swipeFeedback.bg
                }}
              >
                {swipeFeedback.text}
              </div>
            )}

            {/* Student Avatar / Initials Banner */}
            <div className="swipe-card-banner">
              <div className="swipe-card-avatar">
                {currentStudent.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.78rem', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {currentStudent.major || currentStudent.yearLevel || 'Student'}
                </div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.35rem', fontWeight: 800, margin: '0.1rem 0' }}>
                  {parsedName?.displayName || currentStudent.name}
                </h2>
                <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
                  ID: <strong>{currentStudent.studentId}</strong>
                </div>
              </div>

              {currentRecord && (
                <span className={`badge badge-${currentRecord.status}`} style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}>
                  {currentRecord.status.toUpperCase()}
                </span>
              )}
            </div>

            {/* Student Historical Attendance Insight */}
            <div className="swipe-card-body">
              {summary && (
                <div className="swipe-stats-row">
                  <div className="swipe-stat-box">
                    <div className="swipe-stat-value" style={{ color: 'var(--status-absent)' }}>
                      {summary.absentCount}
                    </div>
                    <div className="swipe-stat-label">Absences</div>
                  </div>

                  <div className="swipe-stat-box">
                    <div className="swipe-stat-value" style={{ color: 'var(--status-late)' }}>
                      {summary.lateCount}
                    </div>
                    <div className="swipe-stat-label">Lates</div>
                  </div>

                  <div className="swipe-stat-box">
                    <div className="swipe-stat-value" style={{ color: 'var(--google-blue)' }}>
                      {summary.excusedCount}
                    </div>
                    <div className="swipe-stat-label">Excused</div>
                  </div>

                  <div className="swipe-stat-box">
                    <div className="swipe-stat-value" style={{ color: 'var(--google-green)' }}>
                      {summary.presentCount}
                    </div>
                    <div className="swipe-stat-label">Presents</div>
                  </div>
                </div>
              )}

              {/* Attendance Warning if rate < 75% */}
              {summary && (summary.statusCategory === 'critical' || summary.statusCategory === 'warning') && (
                <div className="swipe-warning-box">
                  <AlertTriangle size={15} color="var(--status-absent)" />
                  <span><strong>75% Drop Warning:</strong> {summary.attendancePercentage}% attendance this semester.</span>
                </div>
              )}

              {/* Note / Remark Preview */}
              {currentRecord?.remarks && (
                <div className="swipe-note-preview">
                  <MessageSquare size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{currentRecord.remarks}</span>
                </div>
              )}

              <button
                type="button"
                className="btn-ghost btn-sm"
                style={{ alignSelf: 'center', marginTop: 'auto', display: 'inline-flex', gap: '0.35rem', color: 'var(--primary)' }}
                onClick={e => {
                  e.stopPropagation();
                  onOpenRemarkModal(currentStudent);
                }}
              >
                <MessageSquare size={14} />
                {currentRecord?.remarks ? 'Edit Student Note' : '+ Add Roll Call Remark'}
              </button>
            </div>
          </div>
        ) : (
          /* Empty / Completed State */
          <div className="swipe-completed-card">
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--status-present-bg)', color: 'var(--status-present)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Trophy size={32} />
            </div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.35rem', fontWeight: 800 }}>
              Roll Call Complete! 🎉
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.4rem', marginBottom: '1.5rem' }}>
              All {totalCount} students have been checked and recorded for this session.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {historyStack.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleUndo}
                  title="Undo the last marked student"
                >
                  <RotateCcw size={14} /> Undo Last Card
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setCurrentIndex(0);
                  setHistoryStack([]);
                }}
              >
                Review from Start
              </button>
              <button type="button" className="btn btn-primary" onClick={onSwitchToListMode}>
                View Full Roster
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tactile Roll Call Action Keypad */}
      {currentStudent && (
        <div className="swipe-keypad-container">
          <button
            type="button"
            className="swipe-btn swipe-btn-absent"
            onClick={() => markStudent('absent')}
            title="Mark Absent (Hotkey: A / Swipe Left)"
          >
            <X size={24} />
            <span className="swipe-btn-label">Absent</span>
            <span className="swipe-btn-hint">A</span>
          </button>

          <button
            type="button"
            className="swipe-btn swipe-btn-late"
            onClick={() => markStudent('late')}
            title="Mark Late (Hotkey: L / Swipe Up)"
          >
            <Clock size={22} />
            <span className="swipe-btn-label">Late</span>
            <span className="swipe-btn-hint">L</span>
          </button>

          <button
            type="button"
            className="swipe-btn swipe-btn-excused"
            onClick={() => markStudent('excused')}
            title="Mark Excused (Hotkey: E / Swipe Down)"
          >
            <ShieldAlert size={22} />
            <span className="swipe-btn-label">Excused</span>
            <span className="swipe-btn-hint">E</span>
          </button>

          <button
            type="button"
            className="swipe-btn swipe-btn-present"
            onClick={() => markStudent('present')}
            title="Mark Present (Hotkey: P / Swipe Right)"
          >
            <Check size={26} />
            <span className="swipe-btn-label">Present</span>
            <span className="swipe-btn-hint">P</span>
          </button>
        </div>
      )}

      {/* Auxiliary Navigation Bar (Undo / Prev / Skip / Next) */}
      {currentStudent && (
        <div className="swipe-aux-bar">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={historyStack.length === 0 && currentIndex === 0}
            onClick={handleUndo}
            title="Undo previous action (Hotkey: Backspace)"
          >
            <RotateCcw size={14} /> Undo
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              type="button"
              className="btn-icon"
              style={{ width: '30px', height: '30px' }}
              disabled={currentIndex === 0}
              onClick={() => {
                if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
              }}
              title="Previous Student"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {Math.min(currentIndex + 1, totalCount)} / {totalCount}
            </span>
            <button
              type="button"
              className="btn-icon"
              style={{ width: '30px', height: '30px' }}
              disabled={currentIndex >= totalCount - 1}
              onClick={() => {
                if (currentIndex < totalCount - 1) setCurrentIndex(prev => prev + 1);
              }}
              title="Next Student"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={currentIndex >= totalCount - 1}
            onClick={handleSkip}
            title="Skip to next student (Hotkey: Space)"
          >
            Skip <SkipForward size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
