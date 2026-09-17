import { Student, AttendanceSession, StudentAttendanceSummary, Course } from '../types';

/**
 * Parse student name parts for sorting and standard academic display (Lastname, Firstname).
 */
export function parseNameParts(fullName: string): {
  lastName: string;
  firstName: string;
  displayName: string;
  sortKey: string;
} {
  const trimmed = fullName ? fullName.trim() : '';
  if (!trimmed) {
    return { lastName: '', firstName: '', displayName: '', sortKey: '' };
  }

  // If already formatted as "LastName, FirstName"
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map(p => p.trim());
    const lastName = parts[0] || '';
    const firstName = parts.slice(1).join(' ') || '';
    return {
      lastName,
      firstName,
      displayName: firstName ? `${lastName}, ${firstName}` : lastName,
      sortKey: `${lastName.toLowerCase()} ${firstName.toLowerCase()}`
    };
  }

  // Format "FirstName MiddleName LastName"
  const words = trimmed.split(/\s+/);
  if (words.length === 1) {
    return {
      lastName: words[0],
      firstName: '',
      displayName: words[0],
      sortKey: words[0].toLowerCase()
    };
  }

  const lastName = words[words.length - 1];
  const firstName = words.slice(0, words.length - 1).join(' ');
  return {
    lastName,
    firstName,
    displayName: `${lastName}, ${firstName}`,
    sortKey: `${lastName.toLowerCase()} ${firstName.toLowerCase()}`
  };
}

/**
 * Sort students strictly by Last Name (A to Z), then First Name
 */
export function sortStudentsByLastName<T extends { name: string }>(students: T[]): T[] {
  return [...students].sort((a, b) => {
    const nameA = parseNameParts(a.name);
    const nameB = parseNameParts(b.name);
    return nameA.sortKey.localeCompare(nameB.sortKey);
  });
}


/**
 * Intelligent parser for college student rosters.
 * Supports:
 * - Tab-separated lines (direct copy-paste from Excel / Google Sheets / University ERP)
 * - Comma-separated CSV lines (ID, Name, Major, Year)
 * - "ID - Name" or "ID Name"
 * - Just names (generates sequential College IDs)
 */
export function parseStudentBulkInput(
  rawText: string,
  courseId: string,
  existingCount: number = 0
): Omit<Student, 'id' | 'createdAt'>[] {
  const lines = rawText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const results: Omit<Student, 'id' | 'createdAt'>[] = [];
  let autoIdCounter = existingCount + 1;

  for (const line of lines) {
    // Check for TSV (Excel paste)
    if (line.includes('\t')) {
      const parts = line.split('\t').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        // If first part looks like an ID, use it
        const firstIsId = /^[A-Za-z0-9-_/]+$/.test(parts[0]) && parts[0].length <= 20;
        const studentId = firstIsId ? parts[0] : `STU-${String(autoIdCounter++).padStart(3, '0')}`;
        const name = firstIsId ? parts[1] : parts[0];
        const major = parts[2] || undefined;
        const yearLevel = parts[3] || undefined;

        if (name) {
          results.push({ studentId, name, courseId, major, yearLevel });
          continue;
        }
      }
    }

    // Check for CSV format
    if (line.includes(',')) {
      const parts = line.split(',').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const firstIsId = /^[A-Za-z0-9-_/]+$/.test(parts[0]) && parts[0].length <= 20;
        const studentId = firstIsId ? parts[0] : `STU-${String(autoIdCounter++).padStart(3, '0')}`;
        const name = firstIsId ? parts[1] : parts[0];
        const major = parts[2] || undefined;
        const yearLevel = parts[3] || undefined;

        if (name) {
          results.push({ studentId, name, courseId, major, yearLevel });
          continue;
        }
      }
    }

    // Check for hyphen separated: e.g., "2023-0012 - Alexander Wright"
    if (line.includes(' - ')) {
      const parts = line.split(' - ').map(p => p.trim());
      if (parts.length >= 2) {
        results.push({
          studentId: parts[0],
          name: parts[1],
          courseId,
          major: parts[2] || undefined
        });
        continue;
      }
    }

    // Regex check for: "2023-10492 Johnathan Doe" (leading ID followed by name)
    const match = line.match(/^([A-Za-z0-9-_/]{3,20})\s+([A-Za-z\s.'-]+)$/);
    if (match) {
      results.push({
        studentId: match[1],
        name: match[2].trim(),
        courseId
      });
      continue;
    }

    // Default fallback: entire line is student name
    results.push({
      studentId: `STU-${String(autoIdCounter++).padStart(3, '0')}`,
      name: line,
      courseId
    });
  }

  return results;
}

/**
 * Calculate college attendance percentage & status for each student in a course
 */
export function calculateStudentSummaries(
  students: Student[],
  sessions: AttendanceSession[]
): StudentAttendanceSummary[] {
  return students.map(student => {
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;
    let totalRecorded = 0;

    sessions.forEach(session => {
      const record = session.records[student.id];
      if (record) {
        totalRecorded++;
        if (record.status === 'present') presentCount++;
        else if (record.status === 'absent') absentCount++;
        else if (record.status === 'late') lateCount++;
        else if (record.status === 'excused') excusedCount++;
      }
    });

    // College calculation: Present = 1.0, Late = 0.5 (or present depending on uni policy), Excused is not penalized
    // Effective denominator excludes excused or counts standard total
    const effectiveTotal = totalRecorded - excusedCount;
    let percentage = 100;

    if (effectiveTotal > 0) {
      const score = presentCount + (lateCount * 0.75); // Late counts as 75% attendance in typical college systems
      percentage = Math.round((score / effectiveTotal) * 100);
    } else if (totalRecorded === 0) {
      percentage = 100; // No sessions yet
    }

    // College threshold:
    // Good: >= 80%
    // Warning (At Risk): 75% - 79%
    // Critical (FDA / Dropped alert): < 75%
    let statusCategory: 'good' | 'warning' | 'critical' = 'good';
    if (totalRecorded >= 3) {
      if (percentage < 75) {
        statusCategory = 'critical';
      } else if (percentage < 80) {
        statusCategory = 'warning';
      }
    }

    return {
      student,
      totalSessions: totalRecorded,
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
      attendancePercentage: Math.min(100, Math.max(0, percentage)),
      statusCategory
    };
  });
}

/**
 * Generate CSV for College Registrar / Dean
 */
export function exportAttendanceToCSV(
  course: Course,
  students: Student[],
  sessions: AttendanceSession[]
): void {
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const sortedStudents = sortStudentsByLastName(students);

  // Header row
  const headers = [
    'Student ID',
    'Full Name (Last Name, First Name)',
    'Major / Program',
    'Year Level',
    ...sortedSessions.map(s => `${s.date} (${s.sessionType.toUpperCase().slice(0, 3)})`),
    'Total Sessions',
    'Present',
    'Absent',
    'Late',
    'Excused',
    'Attendance %',
    'Exam Eligibility / College Status'
  ];

  const rows = sortedStudents.map(student => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;
    let total = 0;

    const sessionCols = sortedSessions.map(session => {
      const record = session.records[student.id];
      if (!record) return '-';
      total++;
      if (record.status === 'present') {
        present++;
        return 'P';
      }
      if (record.status === 'absent') {
        absent++;
        return 'A';
      }
      if (record.status === 'late') {
        late++;
        return 'L';
      }
      if (record.status === 'excused') {
        excused++;
        return 'E';
      }
      return '-';
    });

    const effectiveTotal = total - excused;
    const pct = effectiveTotal > 0 ? Math.round(((present + (late * 0.75)) / effectiveTotal) * 100) : 100;

    let statusLabel = 'Eligible (Dean Status: Good)';
    if (total >= 3) {
      if (pct < 75) statusLabel = 'CRITICAL (Excessive Absences / Ineligible)';
      else if (pct < 80) statusLabel = 'WARNING (At Risk for Exam Disqualification)';
    }

    return [
      `"${student.studentId}"`,
      `"${parseNameParts(student.name).displayName}"`,
      `"${student.major || '-'}"`,
      `"${student.yearLevel || '-'}"`,
      ...sessionCols.map(c => `"${c}"`),
      total,
      present,
      absent,
      late,
      excused,
      `"${pct}%"`,
      `"${statusLabel}"`
    ].join(',');
  });

  const csvContent = `data:text/csv;charset=utf-8,${[
    `"Course: ${course.code} - ${course.name}"`,
    `"Section: ${course.section} | Semester: ${course.semester}"`,
    `"Generated On: ${new Date().toLocaleDateString()}"`,
    '',
    headers.join(','),
    ...rows
  ].join('\n')}`;

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `${course.code}_${course.section}_Attendance_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generate Sample College Demo Data
 */
export function getSampleCollegeData(): { courses: Course[]; students: Student[]; sessions: AttendanceSession[] } {
  const course1Id = 'course-cs301';
  const course2Id = 'course-it204';

  const courses: Course[] = [
    {
      id: course1Id,
      code: 'CS-301',
      name: 'Database Management Systems',
      section: 'BSCS 3-A',
      semester: '1st Semester 2026-2027',
      room: 'Tech Lab 402',
      schedule: 'MWF 09:00 - 10:30 AM',
      color: '#4f46e5',
      createdAt: Date.now() - 86400000 * 14
    },
    {
      id: course2Id,
      code: 'IT-204',
      name: 'Advanced Web Applications & Cloud',
      section: 'BSIT 2-B',
      semester: '1st Semester 2026-2027',
      room: 'Innovation Hall 101',
      schedule: 'TTh 01:00 - 03:00 PM',
      color: '#06b6d4',
      createdAt: Date.now() - 86400000 * 10
    }
  ];

  const students: Student[] = [
    { id: 's1', studentId: '2023-01041', name: 'Alexander Wright', courseId: course1Id, major: 'BS Computer Science', yearLevel: '3rd Year', createdAt: Date.now() },
    { id: 's2', studentId: '2023-01042', name: 'Brianna Chen', courseId: course1Id, major: 'BS Computer Science', yearLevel: '3rd Year', createdAt: Date.now() },
    { id: 's3', studentId: '2023-01043', name: 'Carlos Morales', courseId: course1Id, major: 'BS Computer Science', yearLevel: '3rd Year', createdAt: Date.now() },
    { id: 's4', studentId: '2023-01044', name: 'Danielle Vance', courseId: course1Id, major: 'BS Computer Science', yearLevel: '3rd Year', createdAt: Date.now() },
    { id: 's5', studentId: '2023-01045', name: 'Ethan Hunt', courseId: course1Id, major: 'BS Computer Science', yearLevel: '3rd Year', createdAt: Date.now() },
    { id: 's6', studentId: '2023-01046', name: 'Fiona Gallagher', courseId: course1Id, major: 'BS Computer Science', yearLevel: '3rd Year', createdAt: Date.now() },
    { id: 's7', studentId: '2023-01047', name: 'Gabriel Santos', courseId: course1Id, major: 'BS Computer Science', yearLevel: '3rd Year', createdAt: Date.now() },
    { id: 's8', studentId: '2023-01048', name: 'Hannah Abbott', courseId: course1Id, major: 'BS Computer Science', yearLevel: '3rd Year', createdAt: Date.now() },

    { id: 's9', studentId: '2024-02101', name: 'Liam Johnson', courseId: course2Id, major: 'BS Information Tech', yearLevel: '2nd Year', createdAt: Date.now() },
    { id: 's10', studentId: '2024-02102', name: 'Maya Lin', courseId: course2Id, major: 'BS Information Tech', yearLevel: '2nd Year', createdAt: Date.now() },
    { id: 's11', studentId: '2024-02103', name: 'Noah Miller', courseId: course2Id, major: 'BS Information Tech', yearLevel: '2nd Year', createdAt: Date.now() },
    { id: 's12', studentId: '2024-02104', name: 'Olivia Davis', courseId: course2Id, major: 'BS Information Tech', yearLevel: '2nd Year', createdAt: Date.now() }
  ];

  // Helper date formatter YYYY-MM-DD
  const getDateStr = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };

  const sessions: AttendanceSession[] = [
    {
      id: `cs301_session_1`,
      courseId: course1Id,
      date: getDateStr(7),
      sessionType: 'lecture',
      topic: 'SQL Normalization & 3NF',
      records: {
        's1': { studentId: 's1', status: 'present', timestamp: Date.now() },
        's2': { studentId: 's2', status: 'present', timestamp: Date.now() },
        's3': { studentId: 's3', status: 'late', timestamp: Date.now(), remarks: 'Traffic delay' },
        's4': { studentId: 's4', status: 'present', timestamp: Date.now() },
        's5': { studentId: 's5', status: 'absent', timestamp: Date.now() },
        's6': { studentId: 's6', status: 'present', timestamp: Date.now() },
        's7': { studentId: 's7', status: 'excused', timestamp: Date.now(), remarks: 'College varsity tournament' },
        's8': { studentId: 's8', status: 'present', timestamp: Date.now() }
      },
      createdAt: Date.now() - 86400000 * 7,
      updatedAt: Date.now() - 86400000 * 7
    },
    {
      id: `cs301_session_2`,
      courseId: course1Id,
      date: getDateStr(4),
      sessionType: 'lab',
      topic: 'PostgreSQL Indexing & Optimization',
      records: {
        's1': { studentId: 's1', status: 'present', timestamp: Date.now() },
        's2': { studentId: 's2', status: 'present', timestamp: Date.now() },
        's3': { studentId: 's3', status: 'present', timestamp: Date.now() },
        's4': { studentId: 's4', status: 'present', timestamp: Date.now() },
        's5': { studentId: 's5', status: 'absent', timestamp: Date.now() },
        's6': { studentId: 's6', status: 'present', timestamp: Date.now() },
        's7': { studentId: 's7', status: 'present', timestamp: Date.now() },
        's8': { studentId: 's8', status: 'late', timestamp: Date.now() }
      },
      createdAt: Date.now() - 86400000 * 4,
      updatedAt: Date.now() - 86400000 * 4
    },
    {
      id: `cs301_session_3`,
      courseId: course1Id,
      date: getDateStr(0),
      sessionType: 'lecture',
      topic: 'ACID Transactions & Concurrency Control',
      records: {
        's1': { studentId: 's1', status: 'present', timestamp: Date.now() },
        's2': { studentId: 's2', status: 'present', timestamp: Date.now() },
        's3': { studentId: 's3', status: 'present', timestamp: Date.now() },
        's4': { studentId: 's4', status: 'present', timestamp: Date.now() },
        's5': { studentId: 's5', status: 'absent', timestamp: Date.now(), remarks: '3rd consecutive absence - Warning sent' },
        's6': { studentId: 's6', status: 'present', timestamp: Date.now() },
        's7': { studentId: 's7', status: 'present', timestamp: Date.now() },
        's8': { studentId: 's8', status: 'present', timestamp: Date.now() }
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ];

  return { courses, students, sessions };
}
