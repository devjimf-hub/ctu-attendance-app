import React, { useState, useEffect } from 'react';
import { X, BookOpen, Trash2 } from 'lucide-react';
import { Course } from '../types';

interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (course: Course) => void;
  onDelete?: (courseId: string) => void;
  initialCourse?: Course | null;
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
  initialCourse
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const [semester, setSemester] = useState('1st Semester 2026-2027');
  const [room, setRoom] = useState('');
  const [schedule, setSchedule] = useState('');
  const [color, setColor] = useState(COLOR_OPTIONS[0]);

  useEffect(() => {
    if (initialCourse) {
      setCode(initialCourse.code);
      setName(initialCourse.name);
      setSection(initialCourse.section);
      setSemester(initialCourse.semester || '1st Semester 2026-2027');
      setRoom(initialCourse.room || '');
      setSchedule(initialCourse.schedule || '');
      setColor(initialCourse.color || COLOR_OPTIONS[0]);
    } else {
      setCode('');
      setName('');
      setSection('');
      setSemester('1st Semester 2026-2027');
      setRoom('');
      setSchedule('');
      setColor(COLOR_OPTIONS[0]);
    }
  }, [initialCourse, isOpen]);

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

    onSave(courseData);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="modal-icon-badge" style={{ background: color + '20', color: color }}>
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="modal-title">{initialCourse ? 'Edit Course / Subject' : 'Add College Course'}</h3>
              <p className="modal-subtitle">Subject info, block section & schedule</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Course Code *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. CS-301, IT-204"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Section / Block *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. BSIT 3-A, CS 2-B"
                  value={section}
                  onChange={e => setSection(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Course Title / Subject Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Database Management Systems"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Room / Hall / Lab</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Lab 402, Hall B"
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
              {initialCourse ? 'Save Changes' : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
