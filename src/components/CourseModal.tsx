import React, { useState, useEffect } from 'react';
import { X, BookOpen, Trash2, Sparkles } from 'lucide-react';
import { Course, CurriculumProgram, CurriculumSubject, CurriculumSection } from '../types';
import { storageService } from '../services/storageService';

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
  '#06b6d4', // Cyan
  '#059669', // Emerald
  '#e11d48', // Rose
  '#d97706', // Amber
  '#0284c7'  // Sky Blue
];

export const CourseModal: React.FC<CourseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialCourse,
  teacherProgramId
}) => {
  const programs: CurriculumProgram[] = storageService.getPrograms();

  const [programId, setProgramId] = useState(teacherProgramId || programs[0]?.id || '');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [semester, setSemester] = useState('1st Semester 2026-2027');
  const [room, setRoom] = useState('');
  const [schedule, setSchedule] = useState('');
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [isCustomSubject, setIsCustomSubject] = useState(false);
  const [isCustomSection, setIsCustomSection] = useState(false);

  // Available subjects and sections under chosen Program
  const availableSubjects: CurriculumSubject[] = storageService.getSubjects(programId);
  const availableSections: CurriculumSection[] = storageService.getSections(programId);

  useEffect(() => {
    if (initialCourse) {
      setCode(initialCourse.code);
      setName(initialCourse.name);
      setSection(initialCourse.section);
      setSemester(initialCourse.semester || '1st Semester 2026-2027');
      setRoom(initialCourse.room || '');
      setSchedule(initialCourse.schedule || '');
      setColor(initialCourse.color || COLOR_OPTIONS[0]);
      setIsCustomSubject(true);
      setIsCustomSection(true);
      setSelectedSectionId('');
    } else {
      const defaultProg = teacherProgramId || programs[0]?.id || '';
      setProgramId(defaultProg);

      const defaultSubjs = storageService.getSubjects(defaultProg);
      const defaultSecs = storageService.getSections(defaultProg);

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
      setSchedule('');
      setColor(COLOR_OPTIONS[0]);
    }
  }, [initialCourse, isOpen, teacherProgramId]);

  // Handle Degree Program switch
  const handleProgramChange = (newProgId: string) => {
    setProgramId(newProgId);
    const subjs = storageService.getSubjects(newProgId);
    const secs = storageService.getSections(newProgId);

    if (subjs.length > 0) {
      setCode(subjs[0].code);
      setName(subjs[0].name);
      setIsCustomSubject(false);
    } else {
      setIsCustomSubject(true);
    }

    if (secs.length > 0) {
      setSection(secs[0].name);
      setSelectedSectionId(secs[0].id);
      setIsCustomSection(false);
    } else {
      setIsCustomSection(true);
    }
  };

  // Handle Subject Code dropdown selection -> Auto-fills Subject Name!
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
        setName(matched.name); // Automatically fills the subject name!
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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;

    const courseData: Course = {
      id: initialCourse ? initialCourse.id : `course_${Date.now()}`,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      section: section.trim() || 'Block A',
      semester: semester.trim(),
      room: room.trim() || undefined,
      schedule: schedule.trim() || undefined,
      color,
      createdAt: initialCourse ? initialCourse.createdAt : Date.now()
    };

    onSave(courseData, !initialCourse && !isCustomSection ? selectedSectionId : undefined);
    onClose();
  };

  const selectedSectionObj = availableSections.find(s => s.id === selectedSectionId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="modal-icon-badge" style={{ background: color + '20', color: color }}>
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="modal-title">{initialCourse ? 'Edit Subject / Class' : 'Add College Subject / Class'}</h3>
              <p className="modal-subtitle">Auto-filled from degree curriculum & section rosters</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            
            {/* Degree Program Filter */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>College Degree Program</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Curriculum catalog source</span>
              </label>
              <select
                className="form-select"
                value={programId}
                onChange={e => handleProgramChange(e.target.value)}
              >
                {programs.map(prog => (
                  <option key={prog.id} value={prog.id}>
                    {prog.code} - {prog.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject Code (Dropdown or Custom) & Block Section (Dropdown or Custom) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              
              {/* Subject Code Selector */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subject Code *</span>
                  {availableSubjects.length > 0 && (
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ padding: 0, fontSize: '0.75rem', color: 'var(--primary)', height: 'auto' }}
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
                        {s.code} ({s.name})
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
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Section / Block *</span>
                  {availableSections.length > 0 && (
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ padding: 0, fontSize: '0.75rem', color: 'var(--primary)', height: 'auto' }}
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

            {/* Course Title / Subject Name (Auto-filled) */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>Subject Title / Course Name *</span>
                {!isCustomSubject && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--status-present)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <Sparkles size={12} /> Auto-filled from curriculum
                  </span>
                )}
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

            {/* Auto-enroll notice if section has students */}
            {!initialCourse && !isCustomSection && selectedSectionObj && selectedSectionObj.students?.length > 0 && (
              <div style={{ padding: '0.65rem 0.85rem', background: 'var(--status-present-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(21, 128, 61, 0.2)', fontSize: '0.8rem', color: 'var(--status-present)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>👥 <strong>{selectedSectionObj.students.length} pre-enrolled students</strong> from <strong>{selectedSectionObj.name}</strong> will be automatically enrolled in your class roster!</span>
              </div>
            )}

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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
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

              <div className="form-group">
                <label className="form-label">Schedule / Days</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. MWF 9:00 - 10:30 AM"
                  value={schedule}
                  onChange={e => setSchedule(e.target.value)}
                />
              </div>
            </div>

            {/* Accent Color Picker */}
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
              {initialCourse ? 'Save Changes' : 'Create Subject & Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

