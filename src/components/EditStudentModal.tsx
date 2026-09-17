import React, { useState, useEffect } from 'react';
import { X, UserCheck } from 'lucide-react';
import { Student } from '../types';

interface EditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  onSave: (updatedStudent: Student) => void;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({
  isOpen,
  onClose,
  student,
  onSave
}) => {
  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [major, setMajor] = useState('');
  const [yearLevel, setYearLevel] = useState('');

  useEffect(() => {
    if (student) {
      setStudentId(student.studentId);
      setName(student.name);
      setMajor(student.major || '');
      setYearLevel(student.yearLevel || '');
    }
  }, [student, isOpen]);

  if (!isOpen || !student) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      ...student,
      studentId: studentId.trim() || student.studentId,
      name: name.trim(),
      major: major.trim() || undefined,
      yearLevel: yearLevel.trim() || undefined
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="modal-icon-badge">
              <UserCheck size={20} />
            </div>
            <div>
              <h3 className="modal-title">Edit Student</h3>
              <p className="modal-subtitle">Update student information</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Student ID / Matric No.</label>
              <input
                type="text"
                className="form-input"
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Program / Major</label>
              <input
                type="text"
                className="form-input"
                value={major}
                onChange={e => setMajor(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Year Level</label>
              <input
                type="text"
                className="form-input"
                value={yearLevel}
                onChange={e => setYearLevel(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
