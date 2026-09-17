import React, { useState, useEffect, useRef } from 'react';
import { Printer, Download, ArrowLeft, Sliders, FileSpreadsheet, Calendar, Smartphone, ZoomIn } from 'lucide-react';
import { Course, Student, AttendanceSession, StudentAttendanceSummary, TeacherUser } from '../types';
import { exportAttendanceToCSV, sortStudentsByLastName, parseNameParts } from '../utils/collegeUtils';

interface PrintableSummaryProps {
  course: Course;
  students: Student[];
  sessions: AttendanceSession[];
  summaries: StudentAttendanceSummary[];
  teacher: TeacherUser | null;
  onBack: () => void;
}

export const PrintableSummary: React.FC<PrintableSummaryProps> = ({
  course,
  students,
  sessions,
  summaries,
  teacher,
  onBack
}) => {
  // View mode: 'totals' (Presents, A, T, E counts) or 'dates' (date-by-date daily sheet)
  const [viewMode, setViewMode] = useState<'totals' | 'dates'>('totals');

  // Scale / Mobile Page Fit mode ('fit' to view full page on mobile or 'actual' for 100% scrollable)
  const [scaleMode, setScaleMode] = useState<'fit' | 'actual'>('fit');
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 820);
  const [sheetHeight, setSheetHeight] = useState(0);

  const viewportRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Header State customizable
  const [republicHeader, setRepublicHeader] = useState('Republic of the Philippines');
  const [universityName, setUniversityName] = useState('CEBU TECHNOLOGICAL UNIVERSITY');
  const [campusName, setCampusName] = useState('TUBURAN CAMPUS');
  const [addressLine, setAddressLine] = useState('Brgy 8, Poblacion, Tuburan, Cebu, Philippines');
  const [contactInfo, setContactInfo] = useState('Website: http://www.ctu.edu.ph | E-mail: tuburan.campus@ctu.edu.ph | Phone: +6332 463 9313 loc. 1523');
  
  const [collegeHeader, setCollegeHeader] = useState('COLLEGE OF TECHNOLOGY');
  const [programHeader, setProgramHeader] = useState('BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY (BSIT)');
  const [documentTitle, setDocumentTitle] = useState('DAILY CLASS ATTENDANCE MONITORING');
  const [academicYear, setAcademicYear] = useState(course.semester || 'Second Semester, A.Y. 2025-2026');
  const [instructorName, setInstructorName] = useState(teacher?.name || 'Prof. Alexander Turner');

  const [showConfig, setShowConfig] = useState(false);

  // Sort sessions chronologically
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Alphabetically sorted students by LAST NAME (A to Z)
  const sortedStudents = sortStudentsByLastName(students);

  // Auto-measure viewport and sheet dimensions for proportional full-page scaling
  useEffect(() => {
    const updateDimensions = () => {
      if (viewportRef.current) {
        setViewportWidth(viewportRef.current.clientWidth);
      }
      if (sheetRef.current) {
        setSheetHeight(sheetRef.current.offsetHeight);
      }
    };

    updateDimensions();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        updateDimensions();
      });
      if (viewportRef.current) ro.observe(viewportRef.current);
      if (sheetRef.current) ro.observe(sheetRef.current);
    }

    window.addEventListener('resize', updateDimensions);
    const timer = setTimeout(updateDimensions, 100);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateDimensions);
      clearTimeout(timer);
    };
  }, [viewMode, sortedStudents.length, showConfig, scaleMode]);

  const BASE_SHEET_WIDTH = 820;
  const isMobile = viewportWidth < BASE_SHEET_WIDTH;
  const scale = scaleMode === 'fit' && isMobile
    ? Math.max(0.35, Math.min(1, (viewportWidth - 16) / BASE_SHEET_WIDTH))
    : 1;

  const containerHeight = scale < 1 && sheetHeight > 0
    ? `${Math.ceil(sheetHeight * scale + 16)}px`
    : undefined;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    exportAttendanceToCSV(course, students, sessions);
  };

  return (
    <div>
      {/* Control & Customization Toolbar (Hidden when Printed) */}
      <div className="no-print" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={onBack}>
            <ArrowLeft size={16} />
            Back to Roll Call
          </button>

          {/* View Mode Toggle: Summary Totals vs Daily Dates */}
          <div style={{ display: 'flex', background: 'var(--bg-surface-elevated)', padding: '0.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', gap: '0.25rem' }}>
            <button
              className={`btn btn-sm ${viewMode === 'totals' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('totals')}
              style={{ fontSize: '0.8rem' }}
            >
              <FileSpreadsheet size={14} />
              Summary Totals (Presents, A, T, E)
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'dates' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setViewMode('dates')}
              style={{ fontSize: '0.8rem' }}
            >
              <Calendar size={14} />
              Daily Date Matrix
            </button>
          </div>

          {/* Mobile Full Page Fit vs 100% Zoom Toggle */}
          {isMobile && (
            <div style={{ display: 'flex', background: 'var(--bg-surface-elevated)', padding: '0.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', gap: '0.25rem' }}>
              <button
                className={`btn btn-sm ${scaleMode === 'fit' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setScaleMode('fit')}
                style={{ fontSize: '0.75rem' }}
                title="Scale and fit entire document page to screen"
              >
                <Smartphone size={13} />
                Fit Full Page
              </button>
              <button
                className={`btn btn-sm ${scaleMode === 'actual' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setScaleMode('actual')}
                style={{ fontSize: '0.75rem' }}
                title="View at 100% scale with horizontal scroll"
              >
                <ZoomIn size={13} />
                100% Zoom
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowConfig(!showConfig)}
              title="Edit Header text & details"
            >
              <Sliders size={16} />
              {showConfig ? 'Hide Header Options' : 'Edit Header Text'}
            </button>

            <button className="btn btn-secondary" onClick={handleExportCSV}>
              <Download size={16} />
              Export CSV
            </button>

            <button className="btn btn-primary" onClick={handlePrint}>
              <Printer size={16} />
              Print Attendance Summary
            </button>
          </div>
        </div>

        {/* Collapsible Header Customization */}
        {showConfig && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Top Republic Header</label>
              <input
                type="text"
                className="form-input"
                value={republicHeader}
                onChange={e => setRepublicHeader(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">University Name</label>
              <input
                type="text"
                className="form-input"
                value={universityName}
                onChange={e => setUniversityName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Campus Name</label>
              <input
                type="text"
                className="form-input"
                value={campusName}
                onChange={e => setCampusName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Campus Address</label>
              <input
                type="text"
                className="form-input"
                value={addressLine}
                onChange={e => setAddressLine(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contact & Website Info</label>
              <input
                type="text"
                className="form-input"
                value={contactInfo}
                onChange={e => setContactInfo(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">College / Department</label>
              <input
                type="text"
                className="form-input"
                value={collegeHeader}
                onChange={e => setCollegeHeader(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Degree / Program</label>
              <input
                type="text"
                className="form-input"
                value={programHeader}
                onChange={e => setProgramHeader(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Document Title</label>
              <input
                type="text"
                className="form-input"
                value={documentTitle}
                onChange={e => setDocumentTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Academic Year / Semester</label>
              <input
                type="text"
                className="form-input"
                value={academicYear}
                onChange={e => setAcademicYear(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Instructor Name</label>
              <input
                type="text"
                className="form-input"
                value={instructorName}
                onChange={e => setInstructorName(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          EXACT REPLICA OF "Daily Attendance Sheet.docx" (HEADER + BODY + FOOTER)
          Scales proportionally to fit full page on mobile viewports
          ========================================================================= */}
      <div
        className="sheet-outer-viewport"
        ref={viewportRef}
        style={{
          width: '100%',
          overflowX: scaleMode === 'actual' ? 'auto' : 'hidden',
          overflowY: 'visible',
          height: containerHeight,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <div
          style={{
            width: `${BASE_SHEET_WIDTH}px`,
            minWidth: `${BASE_SHEET_WIDTH}px`,
            transform: scale < 1 ? `scale(${scale})` : 'none',
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out'
          }}
        >
          <div
            className="docx-attendance-sheet"
            ref={sheetRef}
            style={{
              width: `${BASE_SHEET_WIDTH}px`,
              minWidth: `${BASE_SHEET_WIDTH}px`,
              background: '#ffffff',
              color: '#000000',
              padding: '28px 32px',
              fontFamily: 'Arial, Helvetica, sans-serif',
              border: '1px solid #d1d5db',
              boxShadow: 'var(--shadow-md)',
              borderRadius: '4px',
              position: 'relative',
              boxSizing: 'border-box'
            }}
          >
            {/* -------------------------------------------------------------
                1. OFFICIAL UNIVERSITY LETTERHEAD (header1.xml)
                ------------------------------------------------------------- */}
            <div className="docx-header-section" style={{ borderBottom: '2px solid #000000', paddingBottom: '10px', marginBottom: '16px' }}>
          
          {/* Top Logo Row with CTU Seals & Institutional Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            {/* Left Logo (CTU Official University Seal) */}
            <div style={{ width: '85px', height: '85px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src="/docx_assets/image4.png"
                alt="CTU Logo"
                style={{ maxWidth: '85px', maxHeight: '85px', objectFit: 'contain' }}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            {/* Center Institution Details */}
            <div style={{ textAlign: 'center', flex: 1, lineHeight: '1.25' }}>
              <div style={{ fontSize: '9pt', color: '#111827' }}>
                {republicHeader}
              </div>
              <div style={{ fontSize: '11.5pt', fontWeight: 'bold', color: '#000000', letterSpacing: '0.02em', marginTop: '1px' }}>
                {universityName}
              </div>
              <div style={{ fontSize: '10.5pt', fontWeight: 'bold', color: '#000000', marginTop: '1px' }}>
                {campusName}
              </div>
              <div style={{ fontSize: '8pt', color: '#374151', marginTop: '1px' }}>
                {addressLine}
              </div>
              <div style={{ fontSize: '7.5pt', color: '#4b5563', marginTop: '1px' }}>
                {contactInfo}
              </div>
            </div>

            {/* Right Logo (Accreditation / Bagong Pilipinas Seal) */}
            <div style={{ width: '85px', height: '85px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src="/docx_assets/image1.png"
                alt="Accreditation Seal"
                style={{ maxWidth: '85px', maxHeight: '85px', objectFit: 'contain' }}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          </div>

          {/* Academic Department & Program Sub-Header */}
          <div style={{ textAlign: 'center', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #9ca3af' }}>
            <div style={{ fontSize: '10pt', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase' }}>
              {collegeHeader}
            </div>
            <div style={{ fontSize: '9pt', fontWeight: 'bold', color: '#1f2937', textTransform: 'uppercase', marginTop: '1px' }}>
              {programHeader}
            </div>
          </div>

          {/* Form Title & Term Banner */}
          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <div style={{ fontSize: '11.5pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {documentTitle}
            </div>
            <div style={{ fontSize: '9.5pt', fontStyle: 'italic', color: '#374151', marginTop: '1px' }}>
              {academicYear}
            </div>
          </div>
        </div>

        {/* -------------------------------------------------------------
            2. SUBJECT & COURSE FORM FIELDS (P1 & P2 from docx)
            ------------------------------------------------------------- */}
        <div style={{ fontSize: '10.5pt', fontWeight: 'bold', lineHeight: '1.7', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <span>Course Code: </span>
              <span style={{ borderBottom: '1px solid #000', paddingBottom: '1px', display: 'inline-block', minWidth: '130px' }}>
                {course.code || '________'}
              </span>
            </div>

            <div>
              <span>Course Title: </span>
              <span style={{ borderBottom: '1px solid #000', paddingBottom: '1px', display: 'inline-block', minWidth: '320px' }}>
                {course.name || '_____________________________________'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
            <div>
              <span>Blocksection: </span>
              <span style={{ borderBottom: '1px solid #000', paddingBottom: '1px', display: 'inline-block', minWidth: '130px' }}>
                {course.section || '________'}
              </span>
            </div>

            <div>
              <span>Instructor: </span>
              <span style={{ borderBottom: '1px solid #000', paddingBottom: '1px', display: 'inline-block', minWidth: '320px' }}>
                {instructorName || '_____________________________________'}
              </span>
            </div>
          </div>
        </div>

        {/* -------------------------------------------------------------
            3. ATTENDANCE TABLE (Consolidated Totals Mode or Date Grid)
            ------------------------------------------------------------- */}
        {viewMode === 'totals' ? (
          /* CONSOLIDATED SUMMARY TABLE: Number of Presents, Absences, Tardiness, Excuses, Total, % (No Remarks Column) */
          <table
            className="docx-table"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '9pt',
              textAlign: 'left',
              border: '1.5px solid #000000'
            }}
          >
            <thead>
              <tr style={{ background: '#f3f4f6', borderBottom: '1.5px solid #000000' }}>
                <th style={{ border: '1px solid #000000', padding: '6px 8px', width: '36px', textAlign: 'center', fontWeight: 'bold' }}>
                  #
                </th>
                <th style={{ border: '1px solid #000000', padding: '6px 8px', width: '130px', fontWeight: 'bold' }}>
                  ID NO.
                </th>
                <th style={{ border: '1px solid #000000', padding: '6px 8px', fontWeight: 'bold' }}>
                  STUDENT NAME
                </th>
                <th style={{ border: '1px solid #000000', padding: '6px 6px', width: '85px', textAlign: 'center', fontWeight: 'bold' }}>
                  PRESENTS<br />(P)
                </th>
                <th style={{ border: '1px solid #000000', padding: '6px 6px', width: '85px', textAlign: 'center', fontWeight: 'bold' }}>
                  ABSENCES<br />(A)
                </th>
                <th style={{ border: '1px solid #000000', padding: '6px 6px', width: '85px', textAlign: 'center', fontWeight: 'bold' }}>
                  TARDINESS<br />(T)
                </th>
                <th style={{ border: '1px solid #000000', padding: '6px 6px', width: '85px', textAlign: 'center', fontWeight: 'bold' }}>
                  EXCUSES<br />(E)
                </th>
                <th style={{ border: '1px solid #000000', padding: '6px 6px', width: '75px', textAlign: 'center', fontWeight: 'bold' }}>
                  TOTAL<br />SESSIONS
                </th>
                <th style={{ border: '1px solid #000000', padding: '6px 8px', width: '80px', textAlign: 'center', fontWeight: 'bold' }}>
                  ATTENDANCE<br />%
                </th>
              </tr>
            </thead>

            <tbody>
              {sortedStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '16px', textAlign: 'center', fontStyle: 'italic', border: '1px solid #000000' }}>
                    No students enrolled in this course yet.
                  </td>
                </tr>
              ) : (
                sortedStudents.map((student, idx) => {
                  const summary = summaries.find(sm => sm.student.id === student.id);
                  const totalSessions = summary ? summary.totalSessions : sessions.length;
                  const presentCount = summary ? summary.presentCount : 0;
                  const absentCount = summary ? summary.absentCount : 0;
                  const lateCount = summary ? summary.lateCount : 0;
                  const excusedCount = summary ? summary.excusedCount : 0;
                  const pct = summary ? summary.attendancePercentage : 100;

                  return (
                    <tr key={student.id} style={{ height: '24px' }}>
                      <td style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'center' }}>
                        {idx + 1}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 8px', fontFamily: 'monospace', fontWeight: 600 }}>
                        {student.studentId}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 8px', fontWeight: 'bold' }}>
                        {parseNameParts(student.name).displayName}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'center', fontWeight: 'bold', color: '#15803d' }}>
                        {presentCount}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'center', fontWeight: absentCount > 2 ? 'bold' : 'normal', color: absentCount > 2 ? '#b91c1c' : '#000000' }}>
                        {absentCount}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'center' }}>
                        {lateCount}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'center' }}>
                        {excusedCount}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'center', fontWeight: 600 }}>
                        {totalSessions}
                      </td>
                      <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'center', fontWeight: 'bold' }}>
                        {pct}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          /* DATE MATRIX TABLE: Daily date marks */
          <table
            className="docx-table"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '9pt',
              textAlign: 'left',
              border: '1.5px solid #000000'
            }}
          >
            <thead>
              <tr style={{ background: '#ffffff', borderBottom: '1.5px solid #000000' }}>
                <th style={{ border: '1px solid #000000', padding: '6px 8px', width: '120px', fontWeight: 'bold' }}>
                  ID NO.
                </th>
                <th style={{ border: '1px solid #000000', padding: '6px 8px', minWidth: '220px', fontWeight: 'bold' }}>
                  NAME
                </th>
                {sortedSessions.map((sess) => (
                  <th
                    key={sess.id}
                    style={{
                      border: '1px solid #000000',
                      padding: '4px 3px',
                      width: '42px',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      fontSize: '8pt',
                      verticalAlign: 'bottom'
                    }}
                  >
                    {sess.date.slice(5)}
                  </th>
                ))}
                <th
                  style={{
                    border: '1px solid #000000',
                    padding: '4px 6px',
                    width: '140px',
                    fontSize: '8pt',
                    fontWeight: 'bold',
                    lineHeight: '1.25',
                    verticalAlign: 'top',
                    textAlign: 'left'
                  }}
                >
                  <div>Total # of</div>
                  <div>A=Absences</div>
                  <div>T=Tardiness</div>
                  <div>E=Excuses</div>
                </th>
              </tr>
            </thead>

            <tbody>
              {sortedStudents.map((student) => {
                const summary = summaries.find(sm => sm.student.id === student.id);

                return (
                  <tr key={student.id} style={{ height: '24px' }}>
                    <td style={{ border: '1px solid #000000', padding: '3px 8px', fontFamily: 'monospace', fontWeight: 600 }}>
                      {student.studentId}
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '3px 8px', fontWeight: 'bold' }}>
                      {parseNameParts(student.name).displayName}
                    </td>
                    {sortedSessions.map((session) => {
                      const rec = session.records[student.id];
                      let mark = '';
                      if (rec) {
                        if (rec.status === 'present') mark = '✓';
                        else if (rec.status === 'absent') mark = 'A';
                        else if (rec.status === 'late') mark = 'T';
                        else if (rec.status === 'excused') mark = 'E';
                      }

                      return (
                        <td
                          key={session.id}
                          style={{
                            border: '1px solid #000000',
                            padding: '2px',
                            textAlign: 'center',
                            fontWeight: mark === 'A' ? 'bold' : 'normal',
                            color: mark === 'A' ? '#c5221f' : '#000000'
                          }}
                        >
                          {mark}
                        </td>
                      );
                    })}
                    <td style={{ border: '1px solid #000000', padding: '3px 6px', fontSize: '8.5pt', fontWeight: 600 }}>
                      {summary ? (
                        <span>
                          A: {summary.absentCount} &nbsp; T: {summary.lateCount} &nbsp; E: {summary.excusedCount}
                        </span>
                      ) : (
                        <span>A: 0 &nbsp; T: 0 &nbsp; E: 0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Legend */}
        <div style={{ marginTop: '10px', fontSize: '8pt', color: '#4b5563', display: 'flex', gap: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '6px', flexWrap: 'wrap' }}>
          <span><strong>Legend:</strong></span>
          <span><strong>P:</strong> Presents</span>
          <span><strong>A:</strong> Absences</span>
          <span><strong>T:</strong> Tardiness</span>
          <span><strong>E:</strong> Excuses</span>
        </div>

        {/* -------------------------------------------------------------
            4. OFFICIAL UNIVERSITY FOOTER BANNER (footer1.xml)
            ------------------------------------------------------------- */}
        <div className="docx-footer-section" style={{ marginTop: '24px', paddingTop: '8px', textAlign: 'center' }}>
          <img
            src="/docx_assets/image2.png"
            alt="University Footer Certification Banner"
            style={{ width: '100%', maxHeight: '55px', objectFit: 'contain' }}
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      </div>
    </div>
  </div>
</div>
  );
};
