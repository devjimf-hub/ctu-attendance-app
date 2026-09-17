import React, { useState } from 'react';
import { X, Users, Upload, FileText, CheckCircle2, BookOpen } from 'lucide-react';
import { Student, CurriculumSection } from '../types';
import { parseStudentBulkInput } from '../utils/collegeUtils';
import { storageService } from '../services/storageService';

interface StudentBulkModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  courseCode: string;
  existingStudentsCount: number;
  onAddStudents: (students: Student[]) => void;
}

export const StudentBulkModal: React.FC<StudentBulkModalProps> = ({
  isOpen,
  onClose,
  courseId,
  courseCode,
  existingStudentsCount,
  onAddStudents
}) => {
  const sections: CurriculumSection[] = storageService.getSections();
  const [activeMode, setActiveMode] = useState<'section' | 'bulk' | 'single'>('section');

  // Pre-configured section import
  const [selectedSectionId, setSelectedSectionId] = useState<string>(sections[0]?.id || '');

  // Single mode state
  const [singleId, setSingleId] = useState('');
  const [singleName, setSingleName] = useState('');
  const [singleMajor, setSingleMajor] = useState('');
  const [singleYear, setSingleYear] = useState('');

  // Bulk mode state
  const [bulkText, setBulkText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<Omit<Student, 'id' | 'createdAt'>[]>([]);

  if (!isOpen) return null;

  const selectedSectionObj = storageService.getSectionById(selectedSectionId) || sections.find(s => s.id === selectedSectionId);

  const handleImportSectionStudents = () => {
    if (!selectedSectionObj || !selectedSectionObj.students || selectedSectionObj.students.length === 0) return;

    const newStudents: Student[] = selectedSectionObj.students.map((ms, idx) => ({
      id: `stu_${courseId}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      studentId: ms.studentId,
      name: ms.name,
      email: ms.email,
      courseId,
      major: selectedSectionObj.name,
      yearLevel: selectedSectionObj.yearLevel,
      createdAt: Date.now()
    }));

    onAddStudents(newStudents);
    onClose();
  };

  const handleBulkTextChange = (text: string) => {
    setBulkText(text);
    if (!text.trim()) {
      setParsedPreview([]);
      return;
    }
    const parsed = parseStudentBulkInput(text, courseId, existingStudentsCount);
    setParsedPreview(parsed);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      if (content) {
        handleBulkTextChange(content);
      }
    };
    reader.readAsText(file);
  };

  const handleSaveBulk = () => {
    if (parsedPreview.length === 0) return;

    const newStudents: Student[] = parsedPreview.map((item, index) => ({
      ...item,
      id: `stu_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now()
    }));

    onAddStudents(newStudents);
    onClose();
    setBulkText('');
    setParsedPreview([]);
  };

  const handleSaveSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleName.trim()) return;

    const student: Student = {
      id: `stu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      studentId: singleId.trim() || `STU-${String(existingStudentsCount + 1).padStart(3, '0')}`,
      name: singleName.trim(),
      courseId,
      major: singleMajor.trim() || undefined,
      yearLevel: singleYear.trim() || undefined,
      createdAt: Date.now()
    };

    onAddStudents([student]);
    onClose();
    setSingleId('');
    setSingleName('');
    setSingleMajor('');
    setSingleYear('');
  };

  const sampleTemplate = `2024-00101, Alexander Wright, BS Computer Science, 3rd Year
2024-00102, Brianna Chen, BS Computer Science, 3rd Year
2024-00103, Carlos Morales, BS Information Tech, 2nd Year
2024-00104, Danielle Vance, BS Computer Science, 3rd Year
Ethan Hunt
Fiona Gallagher`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="modal-icon-badge">
              <Users size={20} />
            </div>
            <div>
              <h3 className="modal-title">Add Students to {courseCode}</h3>
              <p className="modal-subtitle">
                Select official class section roster or import via paste / CSV
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Mode Toggle Segmented Control */}
        <div className="modal-tabs-wrapper">
          <div className="segmented-control">
            <button
              type="button"
              className={`tab-button ${activeMode === 'section' ? 'active' : ''}`}
              onClick={() => setActiveMode('section')}
            >
              <BookOpen size={15} />
              Official Section Roster
            </button>
            <button
              type="button"
              className={`tab-button ${activeMode === 'bulk' ? 'active' : ''}`}
              onClick={() => setActiveMode('bulk')}
            >
              <FileText size={15} />
              Paste / CSV
            </button>
            <button
              type="button"
              className={`tab-button ${activeMode === 'single' ? 'active' : ''}`}
              onClick={() => setActiveMode('single')}
            >
              <Users size={15} />
              Single Student
            </button>
          </div>
        </div>

        {/* MODE 1: Official Section Roster Selector */}
        {activeMode === 'section' && (
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Select Official Section Roster</label>
              <select
                className="form-select"
                value={selectedSectionId}
                onChange={e => setSelectedSectionId(e.target.value)}
              >
                {sections.map(sec => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name} — {sec.yearLevel} ({sec.students?.length || 0} students)
                  </option>
                ))}
              </select>
            </div>

            {selectedSectionObj && selectedSectionObj.students && selectedSectionObj.students.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--google-green)', fontSize: '0.85rem', fontWeight: 600 }}>
                    <CheckCircle2 size={16} />
                    <span>{selectedSectionObj.students.length} students enrolled in {selectedSectionObj.name}:</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Alphabetical CTU Roster
                  </span>
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface-elevated)', zIndex: 2 }}>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.5rem 0.65rem', width: '120px' }}>Student ID</th>
                        <th style={{ padding: '0.5rem 0.65rem' }}>Student Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSectionObj.students.map((s, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.45rem 0.65rem', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{s.studentId}</td>
                          <td style={{ padding: '0.45rem 0.65rem', fontWeight: 600 }}>{s.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                No students found in this section.
              </div>
            )}
          </div>
        )}

        {/* MODE 2: Bulk Text / CSV */}
        {activeMode === 'bulk' && (
          <div className="modal-body">
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>
                  Paste Roster (Excel, Word, or School ERP)
                </label>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => handleBulkTextChange(sampleTemplate)}
                >
                  ⚡ Load Sample Roster
                </button>
              </div>

              <textarea
                className="form-textarea"
                rows={5}
                placeholder="Paste names here. Formats supported:&#10;• 2024-00101, Alexander Wright, BSCS, 3rd Year&#10;• 2024-00102  Brianna Chen&#10;• Or just student names (one per line)"
                value={bulkText}
                onChange={e => handleBulkTextChange(e.target.value)}
                autoFocus
              />
            </div>

            {/* CSV File Upload Drop Zone */}
            <div className="upload-drop-zone">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.85rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                  <Upload size={16} />
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>Import from Spreadsheet</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Accepts .CSV, .TSV, or .TXT files</div>
                </div>
              </div>
              <label className="btn btn-sm btn-secondary" style={{ cursor: 'pointer' }}>
                Browse File
                <input type="file" accept=".csv,.txt,.tsv" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>

            {/* Live Parsing Preview */}
            {parsedPreview.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--google-green)', fontSize: '0.85rem', fontWeight: 600 }}>
                    <CheckCircle2 size={16} />
                    <span>Ready to import {parsedPreview.length} students:</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    (Ordered by Last Name automatically)
                  </span>
                </div>

                <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface-elevated)', zIndex: 2 }}>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.5rem 0.65rem', width: '120px' }}>Student ID</th>
                        <th style={{ padding: '0.5rem 0.65rem' }}>Full Name</th>
                        <th style={{ padding: '0.5rem 0.65rem' }}>Major / Year</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedPreview.map((s, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.45rem 0.65rem', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{s.studentId}</td>
                          <td style={{ padding: '0.45rem 0.65rem', fontWeight: 600 }}>{s.name}</td>
                          <td style={{ padding: '0.45rem 0.65rem', color: 'var(--text-secondary)' }}>{s.major || s.yearLevel || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODE 3: Single Student */}
        {activeMode === 'single' && (
          <form onSubmit={handleSaveSingle}>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Student ID / Matric No.</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 2024-00101"
                    value={singleId}
                    onChange={e => setSingleId(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Alexander Wright"
                    value={singleName}
                    onChange={e => setSingleName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">College Major / Program</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. BS Computer Science"
                    value={singleMajor}
                    onChange={e => setSingleMajor(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Year Level</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 3rd Year"
                    value={singleYear}
                    onChange={e => setSingleYear(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Add Student
              </button>
            </div>
          </form>
        )}

        {/* Footer for Section Roster Mode */}
        {activeMode === 'section' && (
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selectedSectionObj || !selectedSectionObj.students || selectedSectionObj.students.length === 0}
              onClick={handleImportSectionStudents}
            >
              Enroll {selectedSectionObj?.students?.length || 0} Students to Class
            </button>
          </div>
        )}

        {/* Footer for Bulk Mode */}
        {activeMode === 'bulk' && (
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={parsedPreview.length === 0}
              onClick={handleSaveBulk}
            >
              Import {parsedPreview.length > 0 ? `${parsedPreview.length} Students` : 'Roster'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
