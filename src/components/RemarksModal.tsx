import React, { useState, useEffect } from 'react';
import { X, MessageSquare } from 'lucide-react';
import { Student, AttendanceRecord } from '../types';

interface RemarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  record?: AttendanceRecord;
  onSaveRemark: (studentId: string, remark: string) => void;
}

export const RemarksModal: React.FC<RemarksModalProps> = ({
  isOpen,
  onClose,
  student,
  record,
  onSaveRemark
}) => {
  const [remark, setRemark] = useState('');

  useEffect(() => {
    if (record) {
      setRemark(record.remarks || '');
    } else {
      setRemark('');
    }
  }, [record, isOpen]);

  if (!isOpen || !student) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveRemark(student.id, remark.trim());
    onClose();
  };

  const quickPresets = [
    'Official University Representation',
    'Medical Certificate Submitted',
    'Arrived 15 mins late',
    'Left early with permit',
    'Dean Office Appointment',
    'Weather / Commute disruption'
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="modal-icon-badge">
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 className="modal-title">Attendance Remarks</h3>
              <p className="modal-subtitle">For {student.name} ({student.studentId})</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Note / Reason for status</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Enter remarks or excuse documentation note..."
                value={remark}
                onChange={e => setRemark(e.target.value)}
                autoFocus
              />
            </div>

            {/* Quick Preset Buttons */}
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Quick Preset Remarks:
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {quickPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    onClick={() => setRemark(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Remark
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
