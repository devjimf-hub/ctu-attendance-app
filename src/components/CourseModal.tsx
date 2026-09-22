import React, { useState, useEffect } from 'react';
import { X, BookOpen, Trash2, Calendar, Clock, Sparkles } from 'lucide-react';
import { Course, CurriculumProgram, CurriculumSubject, CurriculumSection, DayCode } from '../types';
import { storageService } from '../services/storageService';
import {
  DAYS_OF_WEEK,
  TIME_DROPDOWN_OPTIONS,
  getCourseDays,
  formatDaysDisplay,
  parseTimeRange
} from '../utils/collegeUtils';

interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (course: Course, selectedSectionId?: string) => void;
  onDelete?: (courseId: string) => void;
  initialCourse?: Course | null;
  teacherProgramId?: string;
}

const COLOR_OPTIONS = [
  '#4f46e5', // Indigo
  '#7c3aed', // Violet
  '#9333ea', // Purple
  '#c026d3', // Fuchsia
  '#db2777', // Pink
  '#e11d48', // Rose
  '#ea580c', // Orange
  '#d97706', // Amber
  '#059669', // Emerald
  '#0d9488', // Teal
  '#0891b2', // Cyan
  '#0284c7', // Sky Blue
  '#2563eb', // Royal Blue
  '#475569'  // Slate
];

export const getRandomCourseColor = (): string => {
  return COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)];
};

function extractTimeFromSchedule(scheduleStr?: string): string {
  if (!scheduleStr) return '';
  return scheduleStr
    .replace(/^(M|T|W|TH|F|S|SU|MON|TUE|WED|THU|THUR|FRI|SAT|SUN|\s|-|,)+/i, '')
    .trim();
}

export const CourseModal: React.FC<CourseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialCourse,
  teacherProgramId
}) => {
  const programs: CurriculumProgram[] = storageService.getPrograms();
  const effectiveProgramId = teacherProgramId || programs[0]?.id || 'prog_bsit';

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [semester, setSemester] = useState('1st Semester 2026-2027');
  const [room, setRoom] = useState('');
  const [selectedDays, setSelectedDays] = useState<DayCode[]>(['M', 'W', 'F']);
  const [dayTimes, setDayTimes] = useState<Partial<Record<DayCode, { startTime: string; endTime: string }>>>({});
  const [color, setColor] = useState(() => getRandomCourseColor());
  const [isCustomSubject, setIsCustomSubject] = useState(false);
  const [isCustomSection, setIsCustomSection] = useState(false);

  // Available subjects and sections automatically filtered by teacher's chosen program
  const availableSubjects: CurriculumSubject[] = storageService.getSubjects(effectiveProgramId);
  const availableSections: CurriculumSection[] = storageService.getSections(effectiveProgramId);

  useEffect(() => {
    if (initialCourse) {
      setCode(initialCourse.code);
      setName(initialCourse.name);
      setSection(initialCourse.section);
      setSemester(initialCourse.semester || '1st Semester 2026-2027');
      setRoom(initialCourse.room || '');
      const parsedDays = getCourseDays(initialCourse);
      const days = parsedDays.length > 0 ? parsedDays : (['M', 'W', 'F'] as DayCode[]);
      setSelectedDays(days);

      const initialTime = initialCourse.time || extractTimeFromSchedule(initialCourse.schedule);
      const parsedRange = parseTimeRange(initialTime);

      const initialDayTimes: Partial<Record<DayCode, { startTime: string; endTime: string }>> = {};
      days.forEach(d => {
        if (initialCourse.dayTimes && initialCourse.dayTimes[d]) {
          initialDayTimes[d] = { ...initialCourse.dayTimes[d]! };
        } else {
          initialDayTimes[d] = { ...parsedRange };
        }
      });
      setDayTimes(initialDayTimes);

      setColor(initialCourse.color || getRandomCourseColor());
      setIsCustomSubject(true);
      setIsCustomSection(true);
      setSelectedSectionId('');
    } else if (isOpen) {
      const defaultSubjs = storageService.getSubjects(effectiveProgramId);
      const defaultSecs = storageService.getSections(effectiveProgramId);

      if (defaultSubjs.length > 0) {
        setCode(defaultSubjs[0].code);
        setName(defaultSubjs[0].name);
        setIsCustomSubject(false);
      } else {
        setCode('');
        setName('');
        setIsCustomSubject(true);
      }

      if (defaultSecs.length > 0) {
        setSection(defaultSecs[0].name);
        setSelectedSectionId(defaultSecs[0].id);
        setIsCustomSection(false);
      } else {
        setSection('');
        setSelectedSectionId('');
        setIsCustomSection(true);
      }

      setSemester('1st Semester 2026-2027');
      setRoom('');
      setSelectedDays(['M', 'W', 'F']);
      setDayTimes({
        M: { startTime: '8:00 AM', endTime: '9:00 AM' },
        W: { startTime: '8:00 AM', endTime: '9:00 AM' },
        F: { startTime: '8:00 AM', endTime: '9:00 AM' }
      });
      // Assign a random color when creating a new subject
      setColor(getRandomCourseColor());
    }
  }, [initialCourse, isOpen, effectiveProgramId]);

  // Handle Subject Code dropdown selection -> Auto-fills Subject Name
  const handleSubjectDropdownChange = (selectedVal: string) => {
    if (selectedVal === '__custom__') {
      setIsCustomSubject(true);
      setCode('');
      setName('');
    } else {
      setIsCustomSubject(false);
      const matched = availableSubjects.find(s => s.code === selectedVal);
      if (matched) {
        setCode(matched.code);
        setName(matched.name);
      }
    }
  };

  // Handle Section dropdown selection
  const handleSectionDropdownChange = (selectedVal: string) => {
    if (selectedVal === '__custom__') {
      setIsCustomSection(true);
      setSection('');
      setSelectedSectionId('');
    } else {
      setIsCustomSection(false);
      const matched = availableSections.find(sec => sec.id === selectedVal);
      if (matched) {
        setSection(matched.name);
        setSelectedSectionId(matched.id);
      }
    }
  };

  // Day toggle
  const toggleDay = (day: DayCode) => {
    setSelectedDays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day);
      } else {
        const firstDay = prev[0];
        const fallbackTime = (firstDay && dayTimes[firstDay]) || { startTime: '8:00 AM', endTime: '9:00 AM' };
        setDayTimes(curr => ({
          ...curr,
          [day]: curr[day] || { ...fallbackTime }
        }));
        return [...prev, day];
      }
    });
  };

  const handleDayTimeChange = (day: DayCode, field: 'startTime' | 'endTime', val: string) => {
    setDayTimes(prev => {
      const existing = prev[day] || { startTime: '8:00 AM', endTime: '9:00 AM' };
      return {
        ...prev,
        [day]: {
          ...existing,
          [field]: val
        }
      };
    });
  };

  const copyTimeToAllDays = (sourceDay: DayCode) => {
    const sourceTime = dayTimes[sourceDay] || { startTime: '8:00 AM', endTime: '9:00 AM' };
    setDayTimes(prev => {
      const updated = { ...prev };
      selectedDays.forEach(d => {
        updated[d] = { ...sourceTime };
      });
      return updated;
    });
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;

    const order: DayCode[] = ['M', 'T', 'W', 'TH', 'F', 'S', 'SU'];
    const sortedDays = [...selectedDays].sort((a, b) => order.indexOf(a) - order.indexOf(b));

    let computedTime = '';
    if (sortedDays.length > 0) {
      const firstDay = sortedDays[0];
      const firstTime = dayTimes[firstDay] || { startTime: '8:00 AM', endTime: '9:00 AM' };
      const allSame = sortedDays.every(d => {
        const dt = dayTimes[d];
        return dt && dt.startTime === firstTime.startTime && dt.endTime === firstTime.endTime;
      });

      if (allSame) {
        computedTime = `${firstTime.startTime} - ${firstTime.endTime}`;
      } else {
        computedTime = sortedDays
          .map(d => {
            const dt = dayTimes[d] || firstTime;
            return `${d} ${dt.startTime} - ${dt.endTime}`;
          })
          .join(', ');
      }
    }

    const formattedDays = formatDaysDisplay(selectedDays);
    const fullSchedule = computedTime
      ? (formattedDays && !computedTime.includes(selectedDays[0])
          ? `${formattedDays} ${computedTime}`
          : computedTime)
      : formattedDays;

    const activeDayTimes: Partial<Record<DayCode, { startTime: string; endTime: string }>> = {};
    selectedDays.forEach(d => {
      if (dayTimes[d]) {
        activeDayTimes[d] = dayTimes[d];
      }
    });

    const courseData: Course = {
      id: initialCourse ? initialCourse.id : `course_${Date.now()}`,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      section: section.trim() || 'Block A',
      semester: semester.trim(),
      room: room.trim() || undefined,
      days: selectedDays.length > 0 ? selectedDays : undefined,
      time: computedTime || undefined,
      dayTimes: Object.keys(activeDayTimes).length > 0 ? activeDayTimes : undefined,
      schedule: fullSchedule || undefined,
      color,
      createdAt: initialCourse ? initialCourse.createdAt : Date.now()
    };

    onSave(courseData, !initialCourse && !isCustomSection ? selectedSectionId : undefined);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="modal-icon-badge" style={{ background: color + '20', color: color }}>
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="modal-title">{initialCourse ? 'Edit Class' : 'Add Class'}</h3>
              <p className="modal-subtitle">Auto-filled from degree curriculum & section rosters</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', overflowY: 'auto', flex: 1 }}>
            
            {/* Row 1: Subject Code & Section */}
            <div className="form-row-2col">
              {/* Subject Code Selector */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Subject Code *</span>
                  {availableSubjects.length > 0 && (
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ padding: '0 0.25rem', fontSize: '0.75rem', color: 'var(--primary)', height: 'auto', fontWeight: 600 }}
                      onClick={() => setIsCustomSubject(!isCustomSubject)}
                    >
                      {isCustomSubject ? 'Pick from List' : 'Custom'}
                    </button>
                  )}
                </label>

                {!isCustomSubject && availableSubjects.length > 0 ? (
                  <select
                    className="form-select"
                    value={code}
                    onChange={e => handleSubjectDropdownChange(e.target.value)}
                    required
                  >
                    {availableSubjects.map(s => (
                      <option key={s.id} value={s.code}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                    <option value="__custom__">+ Enter Custom Code...</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. IT 204, CS 301"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    required
                    autoFocus
                  />
                )}
              </div>

              {/* Section / Block Selector */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Section / Block *</span>
                  {availableSections.length > 0 && (
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ padding: '0 0.25rem', fontSize: '0.75rem', color: 'var(--primary)', height: 'auto', fontWeight: 600 }}
                      onClick={() => setIsCustomSection(!isCustomSection)}
                    >
                      {isCustomSection ? 'Pick from List' : 'Custom'}
                    </button>
                  )}
                </label>

                {!isCustomSection && availableSections.length > 0 ? (
                  <select
                    className="form-select"
                    value={selectedSectionId}
                    onChange={e => handleSectionDropdownChange(e.target.value)}
                    required
                  >
                    {availableSections.map(sec => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name} ({sec.students?.length || 0} students)
                      </option>
                    ))}
                    <option value="__custom__">+ Enter Custom Section...</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. BSIT 3-A, CS 2-B"
                    value={section}
                    onChange={e => setSection(e.target.value)}
                    required
                  />
                )}
              </div>
            </div>

            {/* Row 2: Subject Title / Course Name */}
            <div className="form-group">
              <label className="form-label">
                <span>Subject Title / Course Name *</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Database Management Systems"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            {/* Row 3: Semester & Room (2 Columns) */}
            <div className="form-row-2col">
              <div className="form-group">
                <label className="form-label">Semester / Term</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 1st Semester 2026-2027"
                  value={semester}
                  onChange={e => setSemester(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Room / Hall / Lab</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Tech Lab 402, Hall B"
                  value={room}
                  onChange={e => setRoom(e.target.value)}
                />
              </div>
            </div>

            {/* Row 4: Class Schedule Days */}
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={14} />
                <span>Class Schedule Days (M T W TH F S SU) *</span>
              </label>

              {/* Day selection buttons */}
              <div className="day-selector-row">
                {DAYS_OF_WEEK.map(d => {
                  const isSelected = selectedDays.includes(d.code);
                  return (
                    <button
                      key={d.code}
                      type="button"
                      className={`day-selector-btn ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleDay(d.code)}
                      title={`${d.full} (${d.code})`}
                    >
                      <span className="day-btn-label">{d.label}</span>
                      <span className="day-btn-sub">{d.full.slice(0, 3)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 5: Class Time Dropdowns for Each Selected Day */}
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Clock size={14} />
                  <span>Class Time / Period</span>
                </label>
                {selectedDays.length > 1 && (
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: '0 0.35rem', fontSize: '0.72rem', color: 'var(--primary)', height: 'auto', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    onClick={() => copyTimeToAllDays(selectedDays[0])}
                    title="Apply first day's time to all selected days"
                  >
                    <Sparkles size={12} />
                    <span>Apply {selectedDays[0]}'s time to all</span>
                  </button>
                )}
              </div>

              {selectedDays.length === 0 ? (
                <div style={{ padding: '0.75rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Select one or more schedule days above to configure class time.
                </div>
              ) : (
                <div className="day-times-list">
                  {DAYS_OF_WEEK.filter(d => selectedDays.includes(d.code)).map(d => {
                    const dt = dayTimes[d.code] || { startTime: '08:00 AM', endTime: '09:00 AM' };
                    return (
                      <div key={d.code} className="day-time-card">
                        <div className="day-time-badge">
                          <span className="day-time-code">{d.code}</span>
                          <span className="day-time-name">{d.full}</span>
                        </div>

                        <div className="day-time-dropdowns">
                          <select
                            className="form-select day-time-select"
                            value={dt.startTime}
                            onChange={e => handleDayTimeChange(d.code, 'startTime', e.target.value)}
                          >
                            {TIME_DROPDOWN_OPTIONS.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>

                          <span className="day-time-separator">:</span>

                          <select
                            className="form-select day-time-select"
                            value={dt.endTime}
                            onChange={e => handleDayTimeChange(d.code, 'endTime', e.target.value)}
                          >
                            {TIME_DROPDOWN_OPTIONS.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Row 6: Accent Color Picker */}
            <div className="form-group">
              <label className="form-label">Course Color Tag</label>
              <div className="color-picker-row">
                {COLOR_OPTIONS.map(c => (
                  <div
                    key={c}
                    className={`color-choice ${color === c ? 'selected' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            {initialCourse && onDelete && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ color: 'var(--status-absent)', marginRight: 'auto' }}
                onClick={() => {
                  if (confirm(`Delete course "${initialCourse.code} - ${initialCourse.name}" and all its students?`)) {
                    onDelete(initialCourse.id);
                    onClose();
                  }
                }}
              >
                <Trash2 size={16} />
                Delete
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {initialCourse ? 'Save Changes' : 'Create Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
