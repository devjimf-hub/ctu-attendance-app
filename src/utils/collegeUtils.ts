import {
  Student,
  AttendanceSession,
  StudentAttendanceSummary,
  Course,
  CurriculumProgram,
  CurriculumSubject,
  CurriculumSection
} from '../types';

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

/**
 * Generate Default Sample Curriculum Data for Admin & Teacher sync
 */
export function getSampleCurriculumData(): {
  programs: CurriculumProgram[];
  subjects: CurriculumSubject[];
  sections: CurriculumSection[];
} {
  const programs: CurriculumProgram[] = [
    {
      id: 'prog_bsit',
      code: 'BSIT',
      name: 'Bachelor of Science in Information Technology',
      department: 'College of Computer Studies',
      createdAt: Date.now() - 86400000 * 30
    },
    {
      id: 'prog_bscs',
      code: 'BSCS',
      name: 'Bachelor of Science in Computer Science',
      department: 'College of Computer Studies',
      createdAt: Date.now() - 86400000 * 30
    },
    {
      id: 'prog_bsis',
      code: 'BSIS',
      name: 'Bachelor of Science in Information Systems',
      department: 'College of Computer Studies',
      createdAt: Date.now() - 86400000 * 30
    }
  ];

  const subjects: CurriculumSubject[] = [
    // BSIT Major Subjects
    // FIRST YEAR — 1st Semester
    { id: 'subj_cc111', programId: 'prog_bsit', code: 'CC 111', name: 'Introduction to Computing', units: 3, yearLevel: '1st Year', semester: '1st Semester', createdAt: Date.now() },
    { id: 'subj_cc112', programId: 'prog_bsit', code: 'CC 112', name: 'Computer Programming 1 (Lec)', units: 2, yearLevel: '1st Year', semester: '1st Semester', createdAt: Date.now() },
    { id: 'subj_cc112l', programId: 'prog_bsit', code: 'CC 112L', name: 'Computer Programming 1 (Lab)', units: 1, yearLevel: '1st Year', semester: '1st Semester', createdAt: Date.now() },
    { id: 'subj_ap1', programId: 'prog_bsit', code: 'AP 1', name: 'Multimedia', units: 3, yearLevel: '1st Year', semester: '1st Semester', createdAt: Date.now() },

    // FIRST YEAR — 2nd Semester
    { id: 'subj_cc123', programId: 'prog_bsit', code: 'CC 123', name: 'Computer Programming 2 (Lec)', units: 2, yearLevel: '1st Year', semester: '2nd Semester', createdAt: Date.now() },
    { id: 'subj_cc123l', programId: 'prog_bsit', code: 'CC 123L', name: 'Computer Programming 2 (Lab)', units: 1, yearLevel: '1st Year', semester: '2nd Semester', createdAt: Date.now() },
    { id: 'subj_pc121', programId: 'prog_bsit', code: 'PC 121 / Math-E2', name: 'Discrete Mathematics', units: 3, yearLevel: '1st Year', semester: '2nd Semester', createdAt: Date.now() },
    { id: 'subj_ap2', programId: 'prog_bsit', code: 'AP 2', name: 'Digital Logic Design', units: 3, yearLevel: '1st Year', semester: '2nd Semester', createdAt: Date.now() },

    // SECOND YEAR — 1st Semester
    { id: 'subj_pc212', programId: 'prog_bsit', code: 'PC 212', name: 'Quantitative Methods (Modeling & Simulation)', units: 3, yearLevel: '2nd Year', semester: '1st Semester', createdAt: Date.now() },
    { id: 'subj_cc214', programId: 'prog_bsit', code: 'CC 214', name: 'Data Structures and Algorithms (Lec)', units: 2, yearLevel: '2nd Year', semester: '1st Semester', createdAt: Date.now() },
    { id: 'subj_cc214l', programId: 'prog_bsit', code: 'CC 214L', name: 'Data Structures and Algorithms (Lab)', units: 1, yearLevel: '2nd Year', semester: '1st Semester', createdAt: Date.now() },
    { id: 'subj_pelec1', programId: 'prog_bsit', code: 'P Elec 1', name: 'Object-Oriented Programming', units: 3, yearLevel: '2nd Year', semester: '1st Semester', createdAt: Date.now() },
    { id: 'subj_pelec2', programId: 'prog_bsit', code: 'P Elec 2', name: 'Web Systems and Technologies', units: 3, yearLevel: '2nd Year', semester: '1st Semester', createdAt: Date.now() },

    // SECOND YEAR — 2nd Semester
    { id: 'subj_pc223', programId: 'prog_bsit', code: 'PC 223', name: 'Integrative Programming and Technologies 1', units: 3, yearLevel: '2nd Year', semester: '2nd Semester', createdAt: Date.now() },
    { id: 'subj_pc224', programId: 'prog_bsit', code: 'PC 224', name: 'Networking 1', units: 3, yearLevel: '2nd Year', semester: '2nd Semester', createdAt: Date.now() },
    { id: 'subj_cc225', programId: 'prog_bsit', code: 'CC 225', name: 'Information Management (Lec)', units: 2, yearLevel: '2nd Year', semester: '2nd Semester', createdAt: Date.now() },
    { id: 'subj_cc225l', programId: 'prog_bsit', code: 'CC 225L', name: 'Information Management (Lab)', units: 1, yearLevel: '2nd Year', semester: '2nd Semester', createdAt: Date.now() },
    { id: 'subj_pelec3', programId: 'prog_bsit', code: 'P Elec 3', name: 'Platform Technologies', units: 3, yearLevel: '2nd Year', semester: '2nd Semester', createdAt: Date.now() },
    { id: 'subj_ap3', programId: 'prog_bsit', code: 'AP 3', name: 'ASP.NET', units: 3, yearLevel: '2nd Year', semester: '2nd Semester', createdAt: Date.now() },

    // THIRD YEAR — 1st Semester
    { id: 'subj_pc315', programId: 'prog_bsit', code: 'PC 315', name: 'Networking 2 (Lec)', units: 2, yearLevel: '3rd Year', semester: '1st Semester', createdAt: Date.now() },
    { id: 'subj_pc315l', programId: 'prog_bsit', code: 'PC 315L', name: 'Networking 2 (Lab)', units: 1, yearLevel: '3rd Year', semester: '1st Semester', createdAt: Date.now() },
    { id: 'subj_pc316', programId: 'prog_bsit', code: 'PC 316', name: 'Systems Integration and Architecture 1', units: 3, yearLevel: '3rd Year', semester: '1st Semester', createdAt: Date.now() },
    { id: 'subj_pc317', programId: 'prog_bsit', code: 'PC 317', name: 'Introduction to Human Computer Interaction', units: 3, yearLevel: '3rd Year', semester: '1st Semester', createdAt: Date.now() },
    { id: 'subj_pc3180', programId: 'prog_bsit', code: 'PC 3180', name: 'Database Management Systems', units: 3, yearLevel: '3rd Year', semester: '1st Semester', createdAt: Date.now() },
    { id: 'subj_cc316', programId: 'prog_bsit', code: 'CC 316', name: 'Applications Development and Emerging Technologies', units: 3, yearLevel: '3rd Year', semester: '1st Semester', createdAt: Date.now() },

    // THIRD YEAR — 2nd Semester
    { id: 'subj_pc329', programId: 'prog_bsit', code: 'PC 329', name: 'Capstone Project and Research 1', units: 3, yearLevel: '3rd Year', semester: '2nd Semester', createdAt: Date.now() },
    { id: 'subj_pc3210', programId: 'prog_bsit', code: 'PC 3210', name: 'Social and Professional Issues', units: 3, yearLevel: '3rd Year', semester: '2nd Semester', createdAt: Date.now() },
    { id: 'subj_pc3211', programId: 'prog_bsit', code: 'PC 3211', name: 'Information Assurance and Security 1 (Lec)', units: 2, yearLevel: '3rd Year', semester: '2nd Semester', createdAt: Date.now() },
    { id: 'subj_pc3211l', programId: 'prog_bsit', code: 'PC 3211L', name: 'Information Assurance and Security 1 (Lab)', units: 1, yearLevel: '3rd Year', semester: '2nd Semester', createdAt: Date.now() },
    { id: 'subj_ap4', programId: 'prog_bsit', code: 'AP 4', name: 'iOS Mobile Application Development Cross-Platform', units: 3, yearLevel: '3rd Year', semester: '2nd Semester', createdAt: Date.now() },
    { id: 'subj_ap5', programId: 'prog_bsit', code: 'AP 5', name: 'Technology and the Application of the Internet of Things', units: 3, yearLevel: '3rd Year', semester: '2nd Semester', createdAt: Date.now() },

    // FOURTH YEAR — 1st Semester
    { id: 'subj_pc4112', programId: 'prog_bsit', code: 'PC 4112', name: 'Information Assurance and Security 2 (Lec)', units: 2, yearLevel: '4th Year', semester: '1st Semester', createdAt: Date.now() },
    { id: 'subj_pc4112l', programId: 'prog_bsit', code: 'PC 4112L', name: 'Information Assurance and Security 2 (Lab)', units: 1, yearLevel: '4th Year', semester: '1st Semester', createdAt: Date.now() },
    { id: 'subj_pc4113', programId: 'prog_bsit', code: 'PC 4113', name: 'Systems Administration and Maintenance', units: 3, yearLevel: '4th Year', semester: '1st Semester', createdAt: Date.now() },
    { id: 'subj_pc4114', programId: 'prog_bsit', code: 'PC 4114', name: 'Capstone Project and Research 2', units: 3, yearLevel: '4th Year', semester: '1st Semester', createdAt: Date.now() },
    { id: 'subj_pelec4', programId: 'prog_bsit', code: 'P Elec 4', name: 'Systems Integration and Architecture 2', units: 3, yearLevel: '4th Year', semester: '1st Semester', createdAt: Date.now() },
    { id: 'subj_ap6', programId: 'prog_bsit', code: 'AP 6', name: 'Cross-Platform Script Development Technology', units: 3, yearLevel: '4th Year', semester: '1st Semester', createdAt: Date.now() },

    // FOURTH YEAR — 2nd Semester
    { id: 'subj_pc4215', programId: 'prog_bsit', code: 'PC 4215', name: 'On-the-Job Training (OJT)', units: 6, yearLevel: '4th Year', semester: '2nd Semester', createdAt: Date.now() },

    // BSCS Subjects
    { id: 'subj_cs101', programId: 'prog_bscs', code: 'CS 101', name: 'Discrete Mathematics', units: 3, yearLevel: '1st Year', semester: '1st Semester', createdAt: Date.now() },
    { id: 'subj_cs202', programId: 'prog_bscs', code: 'CS 202', name: 'Object-Oriented Programming (Java/C++)', units: 3, yearLevel: '2nd Year', semester: '1st Semester', createdAt: Date.now() },
    { id: 'subj_cs301', programId: 'prog_bscs', code: 'CS 301', name: 'Database Management Systems', units: 3, yearLevel: '3rd Year', semester: '1st Semester', createdAt: Date.now() },
    { id: 'subj_cs305', programId: 'prog_bscs', code: 'CS 305', name: 'Design & Analysis of Algorithms', units: 3, yearLevel: '3rd Year', semester: '1st Semester', createdAt: Date.now() },
    { id: 'subj_cs401', programId: 'prog_bscs', code: 'CS 401', name: 'Artificial Intelligence & Machine Learning', units: 3, yearLevel: '4th Year', semester: '1st Semester', createdAt: Date.now() }
  ];

  const sections: CurriculumSection[] = [
    // BSIT 1A (Day - 34 students)
    {
      id: 'sec_bsit1a',
      programId: 'prog_bsit',
      name: 'BSIT 1A',
      yearLevel: '1st Year',
      semester: '1st Semester',
      students: [
        { id: 'stu_5261066', studentId: '5261066', name: 'ABLAÑA, KERVIN L.' },
        { id: 'stu_5261106', studentId: '5261106', name: 'AGBAY, MARIA LUCIA L.' },
        { id: 'stu_5261120', studentId: '5261120', name: 'BARCENAL, LOUIE JANE D.' },
        { id: 'stu_5261089', studentId: '5261089', name: 'BERENGUEL, NIÑO JUSTINE CHADD B.' },
        { id: 'stu_5261111', studentId: '5261111', name: 'CAGAY, MICA ROSE G.' },
        { id: 'stu_5261117', studentId: '5261117', name: 'CAMINGAWAN, RHYL METCH A.' },
        { id: 'stu_5261080', studentId: '5261080', name: 'CUIZON, CHRISTIAN JAY M.' },
        { id: 'stu_5261070', studentId: '5261070', name: 'EDROZO, KLYDE EZEKIEL' },
        { id: 'stu_5261069', studentId: '5261069', name: 'FLORES, JERRY B.' },
        { id: 'stu_5261096', studentId: '5261096', name: 'FUENTES, JULIUS P.' },
        { id: 'stu_5261057', studentId: '5261057', name: 'GABRINAO, JASPER KLIENT P.' },
        { id: 'stu_5261072', studentId: '5261072', name: 'GALLARDO, KENTH DENIEL P.' },
        { id: 'stu_5261067', studentId: '5261067', name: 'GALLARDO, NICOLE KIM N.' },
        { id: 'stu_5261099', studentId: '5261099', name: 'GENSON, ARL SPENCER' },
        { id: 'stu_5261156', studentId: '5261156', name: 'GODINEZ, DANFRITZ BENEDICT A.' },
        { id: 'stu_5261124', studentId: '5261124', name: 'HABASA, JACKY LHOU G.' },
        { id: 'stu_5261068', studentId: '5261068', name: 'LAPING, JAZEL A.' },
        { id: 'stu_5261075', studentId: '5261075', name: 'LIBRIA, NIÑA YUHANA B.' },
        { id: 'stu_5261121', studentId: '5261121', name: 'LOPEZ, RAQUEL B.' },
        { id: 'stu_5261076', studentId: '5261076', name: 'MAAMBONG, JEZELLE MAE G.' },
        { id: 'stu_5261062', studentId: '5261062', name: 'MONISIT, CHINT VENICE E.' },
        { id: 'stu_5261065', studentId: '5261065', name: 'MONTERDE, RHOSMAR B.' },
        { id: 'stu_5261063', studentId: '5261063', name: 'PAGLINAWAN, CLOVEN MECO A.' },
        { id: 'stu_5261074', studentId: '5261074', name: 'PAQUIBO, CHRISTIAN JAKE B.' },
        { id: 'stu_5261022', studentId: '5261022', name: 'PLAYDA, JERRICHO' },
        { id: 'stu_5261086', studentId: '5261086', name: 'QUILATON, KYLE STEPHEN G.' },
        { id: 'stu_5261071', studentId: '5261071', name: 'REBLEZA, ARNOLD JR. L.' },
        { id: 'stu_5261087', studentId: '5261087', name: 'SARLATAN, DOMINIC T.' },
        { id: 'stu_5261126', studentId: '5261126', name: 'SICLOT, ALESA MAE A.' },
        { id: 'stu_5200406', studentId: '5200406', name: 'TALAUGON, ANTHONY Q.' },
        { id: 'stu_5261091', studentId: '5261091', name: 'TICAG, RENELYN A.' },
        { id: 'stu_5261073', studentId: '5261073', name: 'UGBINAR, HERO ARCADIO M.' },
        { id: 'stu_5261157', studentId: '5261157', name: 'VERANO, DAVID KHARL M.' },
        { id: 'stu_5261131', studentId: '5261131', name: 'YNOY, REZLIE ANN P.' }
      ],
      createdAt: Date.now()
    },

    // BSIT 1B (Day - 36 students)
    {
      id: 'sec_bsit1b',
      programId: 'prog_bsit',
      name: 'BSIT 1B',
      yearLevel: '1st Year',
      semester: '1st Semester',
      students: [
        { id: 'stu_5261009', studentId: '5261009', name: 'ABLAÑA, LEONILO G.' },
        { id: 'stu_5261115', studentId: '5261115', name: 'AGUANTA, CRYSTEL C.' },
        { id: 'stu_5261055', studentId: '5261055', name: 'APARES, SHANIA LYN A.' },
        { id: 'stu_5261053', studentId: '5261053', name: 'BARAZAN, JANINE M.' },
        { id: 'stu_5261098', studentId: '5261098', name: 'BORLA, SAMANTHA IRA Y.' },
        { id: 'stu_5261033', studentId: '5261033', name: 'BULA, KATE VERONICA D.' },
        { id: 'stu_5261114', studentId: '5261114', name: 'BUÑAO, VINZ ROQUE PIO N.' },
        { id: 'stu_5261136', studentId: '5261136', name: 'CABARRUBIAS, JUSHEL F.' },
        { id: 'stu_5261082', studentId: '5261082', name: 'CASAS, LEHNEN JANE B.' },
        { id: 'stu_5261090', studentId: '5261090', name: 'DAGUPLO, SHANE ROSE S.' },
        { id: 'stu_5261132', studentId: '5261132', name: 'DELA CRUZ, RHENSE SHANDELL D.' },
        { id: 'stu_5261077', studentId: '5261077', name: 'DIAMANTE, MARY JEAN C.' },
        { id: 'stu_5261104', studentId: '5261104', name: 'ESPEJO, DENCIL R.' },
        { id: 'stu_5250117', studentId: '5250117', name: 'GANCERO, REANNAH ANGEL C.' },
        { id: 'stu_5261129', studentId: '5261129', name: 'GUITGUITEN, ASHLEY P.' },
        { id: 'stu_5261137', studentId: '5261137', name: 'HERMOSA, DINAVIE W.' },
        { id: 'stu_5261142', studentId: '5261142', name: 'JAYME, MARIA ISABEL L.' },
        { id: 'stu_5261084', studentId: '5261084', name: 'JUBAN, DJ MARIE M.' },
        { id: 'stu_5261147', studentId: '5261147', name: 'LOREGAS, SHERIE MAE P.' },
        { id: 'stu_5261093', studentId: '5261093', name: 'LUSTE, GHABRIZA KOLLIN T.' },
        { id: 'stu_5261140', studentId: '5261140', name: 'MANZA, MARIA NICOLE A.' },
        { id: 'stu_5261151', studentId: '5261151', name: 'MONTEBON, CHRISTIAN D.' },
        { id: 'stu_5261112', studentId: '5261112', name: 'MONTERMOSO, MIGUEL G.' },
        { id: 'stu_5261118', studentId: '5261118', name: 'OMANDAC, SHEDDAH UNICE T.' },
        { id: 'stu_5261148', studentId: '5261148', name: 'PACAÑA, KIANN E.' },
        { id: 'stu_5261113', studentId: '5261113', name: 'QUIÑONES, HYRO JUSTIN R.' },
        { id: 'stu_5261119', studentId: '5261119', name: 'RAÑOLA, JORDIN M.' },
        { id: 'stu_5261056', studentId: '5261056', name: 'ROXAS, BRIELLE JUSTIN N.' },
        { id: 'stu_5261138', studentId: '5261138', name: 'SABALANDE, DAPHNE AMOR N.' },
        { id: 'stu_5261133', studentId: '5261133', name: 'SALIPDAN, TOMAS JR T.' },
        { id: 'stu_5261127', studentId: '5261127', name: 'SALUBRE, JOHN LAURENCE V.' },
        { id: 'stu_5261105', studentId: '5261105', name: 'SAYSON, AIRA JAIL M.' },
        { id: 'stu_5261094', studentId: '5261094', name: 'SAYSON, SHERY MAY D.' },
        { id: 'stu_5261141', studentId: '5261141', name: 'SEDEÑO, KENT PAUL G.' },
        { id: 'stu_5261088', studentId: '5261088', name: 'SUPATAN, DANIEL LOUISE L.' },
        { id: 'stu_5251875', studentId: '5251875', name: 'TAMBUT, ARIZHA ANGELI YVE G.' }
      ],
      createdAt: Date.now()
    },

    // BSIT 1C (Day - 26 students)
    {
      id: 'sec_bsit1c',
      programId: 'prog_bsit',
      name: 'BSIT 1C',
      yearLevel: '1st Year',
      semester: '1st Semester',
      students: [
        { id: 'stu_5261085', studentId: '5261085', name: 'ABAYAN, JOHN NATHANIEL A.' },
        { id: 'stu_5261081', studentId: '5261081', name: 'BACUNAWA, DESTINY ANGEL C.' },
        { id: 'stu_5261107', studentId: '5261107', name: 'BAFLOR, MARY ANTHONETTE A.' },
        { id: 'stu_5261109', studentId: '5261109', name: 'BAROTO, JOHN MICHAEL S.' },
        { id: 'stu_5261060', studentId: '5261060', name: 'BOCOG, LEE ANN C.' },
        { id: 'stu_5261125', studentId: '5261125', name: 'CARLOBOS, NIÑA JEAN R.' },
        { id: 'stu_5261130', studentId: '5261130', name: 'DELA CERNA, CHRISSA MAE A.' },
        { id: 'stu_5261061', studentId: '5261061', name: 'DIAPANA, MARY AMORELLE N.' },
        { id: 'stu_5261083', studentId: '5261083', name: 'DIVINAGRACIA, RHEA JANE S.' },
        { id: 'stu_5261052', studentId: '5261052', name: 'ENCABO, SHANELLE PAULINE H.' },
        { id: 'stu_5261153', studentId: '5261153', name: 'HERNANE, JOHN MICHAEL C.' },
        { id: 'stu_5261152', studentId: '5261152', name: 'LACORDA, ARGIE A.' },
        { id: 'stu_5261155', studentId: '5261155', name: 'LUCERO, KIRBY B.' },
        { id: 'stu_5261078', studentId: '5261078', name: 'MAHINAY, ERICA G.' },
        { id: 'stu_5261079', studentId: '5261079', name: 'MAINIT, WENDY ROSE P.' },
        { id: 'stu_5261100', studentId: '5261100', name: 'MALARAS, DANNY JAMES A.' },
        { id: 'stu_5261064', studentId: '5261064', name: 'MAÑEGO, JANAH FEBIE M.' },
        { id: 'stu_5261097', studentId: '5261097', name: 'MARAYAN, JEE LOUISSE S.' },
        { id: 'stu_5261092', studentId: '5261092', name: 'MOLEJON, IMM MARIE L.' },
        { id: 'stu_5261144', studentId: '5261144', name: 'MONTEJO, IRAH BELLE M.' },
        { id: 'stu_5261051', studentId: '5261051', name: 'OBENZA, LOHANNA M.' },
        { id: 'stu_5261150', studentId: '5261150', name: 'PAZ, GIL ASHLY S.' },
        { id: 'stu_5261059', studentId: '5261059', name: 'RICABORDA, JOHN CLAUD D.' },
        { id: 'stu_5261135', studentId: '5261135', name: 'SASO, JEBBSAN Q.' },
        { id: 'stu_5261054', studentId: '5261054', name: 'SILVERIO, JOHNDYLL R.' },
        { id: 'stu_5261149', studentId: '5261149', name: 'VISCAYNO, ZARIS KIRK B.' }
      ],
      createdAt: Date.now()
    },

    // BSIT 1D (Evening - 32 students)
    {
      id: 'sec_bsit1d',
      programId: 'prog_bsit',
      name: 'BSIT 1D',
      yearLevel: '1st Year',
      semester: '1st Semester',
      students: [
        { id: 'stu_5231591', studentId: '5231591', name: 'ANCAJAS, KYLEEN E.' },
        { id: 'stu_5261030', studentId: '5261030', name: 'ANGANA, ISMAEL GABRIEL A.' },
        { id: 'stu_5261042', studentId: '5261042', name: 'ANSIT, QUEINIE D.' },
        { id: 'stu_5261014', studentId: '5261014', name: 'ATIS, SHARIE SHEIN M.' },
        { id: 'stu_5261023', studentId: '5261023', name: 'BEJASA, ASHLEY MAE H.' },
        { id: 'stu_5261015', studentId: '5261015', name: 'BRAGAT, KHYME MARJORIE S.' },
        { id: 'stu_5261050', studentId: '5261050', name: 'CAMACHO, RAFAEL RODZ M.' },
        { id: 'stu_5261021', studentId: '5261021', name: 'CASTILLO, MAREJANE P.' },
        { id: 'stu_5261006', studentId: '5261006', name: 'ESCALICAS, JUSTINE T.' },
        { id: 'stu_5261004', studentId: '5261004', name: 'GALLARDE, MERYN C.' },
        { id: 'stu_5260981', studentId: '5260981', name: 'GERALDEZ, ANGELYN C.' },
        { id: 'stu_5260988', studentId: '5260988', name: 'HATAMOSA, HONEYLANE P.' },
        { id: 'stu_5261003', studentId: '5261003', name: 'MAGPUYO, MENCHIE D.' },
        { id: 'stu_5261012', studentId: '5261012', name: 'MANANDAY, JEHOSAPHAT C.' },
        { id: 'stu_5261001', studentId: '5261001', name: 'NAVARRO, ARLYT A.' },
        { id: 'stu_5260998', studentId: '5260998', name: 'ORTEGA, KENT CHRISTOPHER M.' },
        { id: 'stu_5260986', studentId: '5260986', name: 'PAGLINAWAN, LESLIE JOY C.' },
        { id: 'stu_5260987', studentId: '5260987', name: 'PARAISO, QUEENIE LYKA N.' },
        { id: 'stu_5261005', studentId: '5261005', name: 'PARDILLO, JEFFERSON L.' },
        { id: 'stu_5261024', studentId: '5261024', name: 'PARONE, RAIMER MARTIN A.' },
        { id: 'stu_5261034', studentId: '5261034', name: 'PASCO, GENESIS S.' },
        { id: 'stu_5261116', studentId: '5261116', name: 'RAMIREZ, RECHELLE ANN M.' },
        { id: 'stu_5260993', studentId: '5260993', name: 'RIBILLE, JOSE ROGELIO JR. G.' },
        { id: 'stu_5260994', studentId: '5260994', name: 'ROBLE, JUNEL M.' },
        { id: 'stu_5260982', studentId: '5260982', name: 'SARLATAN, JAZMINE C.' },
        { id: 'stu_5260990', studentId: '5260990', name: 'SARLATAN, NEL HARRY S.' },
        { id: 'stu_5261002', studentId: '5261002', name: 'SAYSON, KENT N.' },
        { id: 'stu_5260978', studentId: '5260978', name: 'SIBONGA, JEANNETH D.' },
        { id: 'stu_5261013', studentId: '5261013', name: 'SINAMBONG, MARY KATRINA L.' },
        { id: 'stu_5261038', studentId: '5261038', name: 'TULING, JOHNMARK S.' },
        { id: 'stu_5261008', studentId: '5261008', name: 'UGAY, LEANDER T.' },
        { id: 'stu_5260997', studentId: '5260997', name: 'VENTULA, FRANCIS DANIEL A.' }
      ],
      createdAt: Date.now()
    },

    // BSIT 1E (Evening - 33 students)
    {
      id: 'sec_bsit1e',
      programId: 'prog_bsit',
      name: 'BSIT 1E',
      yearLevel: '1st Year',
      semester: '1st Semester',
      students: [
        { id: 'stu_5260985', studentId: '5260985', name: 'ALIBO, SHANE STARWIN A.' },
        { id: 'stu_5261011', studentId: '5261011', name: 'ALOLOR, MARY JOY S.' },
        { id: 'stu_5261025', studentId: '5261025', name: 'BANSILOY, CHRISTIAN JAY R.' },
        { id: 'stu_5261044', studentId: '5261044', name: 'BRIGOLI, MARY JOY C.' },
        { id: 'stu_5261035', studentId: '5261035', name: 'CAGAY, JUSTINE KERR G.' },
        { id: 'stu_5260999', studentId: '5260999', name: 'CANOY, KRIS JOY H.' },
        { id: 'stu_5261026', studentId: '5261026', name: 'COMAJIG, JOHN WAYN A.' },
        { id: 'stu_5261010', studentId: '5261010', name: 'CONAHAP, ROCILLE G.' },
        { id: 'stu_5260989', studentId: '5260989', name: 'DELOBIO, VANNESA G.' },
        { id: 'stu_5261108', studentId: '5261108', name: 'DIAMANTE, DIANNA MAE' },
        { id: 'stu_5261048', studentId: '5261048', name: 'ESTAN, RHEANNA N.' },
        { id: 'stu_5261032', studentId: '5261032', name: 'FORTUNADO, SAMUEL' },
        { id: 'stu_5260995', studentId: '5260995', name: 'GAMILONG, SHIRIBEL B.' },
        { id: 'stu_5261019', studentId: '5261019', name: 'GAVIOLA, CARLO C.' },
        { id: 'stu_5261036', studentId: '5261036', name: 'GERA, CARD B.' },
        { id: 'stu_5261043', studentId: '5261043', name: 'GUINITA, DEWYCLINT LOUISE D.' },
        { id: 'stu_5261039', studentId: '5261039', name: 'HUMAG, KIM KYLE C.' },
        { id: 'stu_5260992', studentId: '5260992', name: 'LAPIÑA, JAMES' },
        { id: 'stu_5260991', studentId: '5260991', name: 'LUMBAB, ROGER JR. M.' },
        { id: 'stu_5261103', studentId: '5261103', name: 'MAHUSAY, BLESSEL JEAN' },
        { id: 'stu_5261018', studentId: '5261018', name: 'MALAJOS, SHAKIRA JANE S.' },
        { id: 'stu_5261007', studentId: '5261007', name: 'MALINAO, ANGEL M.' },
        { id: 'stu_5261016', studentId: '5261016', name: 'MANLAKAT, REYMARK O.' },
        { id: 'stu_5261027', studentId: '5261027', name: 'MONTECILLO, BABY TRACE A.' },
        { id: 'stu_5261037', studentId: '5261037', name: 'MONTEROLA, JHELO FAYE L.' },
        { id: 'stu_5261028', studentId: '5261028', name: 'NARSICO, JANIE NIMITZ P.' },
        { id: 'stu_5260983', studentId: '5260983', name: 'ORAL, ENGIEL MAE O.' },
        { id: 'stu_5261029', studentId: '5261029', name: 'PAUBSANON, CHRISTIAN DENVER C.' },
        { id: 'stu_5261017', studentId: '5261017', name: 'PELIGRO, JANNIE KEITH G.' },
        { id: 'stu_5261000', studentId: '5261000', name: 'PEPITO, NOEL ANDREI A.' },
        { id: 'stu_5261046', studentId: '5261046', name: 'PIELAGO, MERIE ROSE P.' },
        { id: 'stu_5260980', studentId: '5260980', name: 'TINGAL, VINCE PETER G.' },
        { id: 'stu_5261049', studentId: '5261049', name: 'VILLARIN, AJ LOURANCE' }
      ],
      createdAt: Date.now()
    },

    // BSIT 2A (Day - 32 students)
    {
      id: 'sec_bsit2a',
      programId: 'prog_bsit',
      name: 'BSIT 2A',
      yearLevel: '2nd Year',
      semester: '1st Semester',
      students: [
        { id: 'stu_5250471', studentId: '5250471', name: 'ARNADO, JENEVIE D.' },
        { id: 'stu_5250524', studentId: '5250524', name: 'BALDONO, SOFIA GRACE B.' },
        { id: 'stu_5250486', studentId: '5250486', name: 'BICADA, JOHN ANTHONY P.' },
        { id: 'stu_5250535', studentId: '5250535', name: 'CANDADO, JAY MARK' },
        { id: 'stu_5250429', studentId: '5250429', name: 'CATARATA, CRISTYL M.' },
        { id: 'stu_5251578', studentId: '5251578', name: 'COLE, JOHN IRA P.' },
        { id: 'stu_5250474', studentId: '5250474', name: 'COREA, JOSEPHUS D.' },
        { id: 'stu_5250513', studentId: '5250513', name: 'DELA CERNA, MA. CHEKE E.' },
        { id: 'stu_5250451', studentId: '5250451', name: 'DENIEGA, HERSHEL M.' },
        { id: 'stu_5250479', studentId: '5250479', name: 'ESPEJON, JOHN DREG M.' },
        { id: 'stu_5250508', studentId: '5250508', name: 'GASTADOR, IVAN C.' },
        { id: 'stu_5250487', studentId: '5250487', name: 'GENON, FAITH SOPHIA A.' },
        { id: 'stu_5250447', studentId: '5250447', name: 'GERALDE, JOHN VINCENT S.' },
        { id: 'stu_5250491', studentId: '5250491', name: 'JORE, MARY DEVINE' },
        { id: 'stu_5251996', studentId: '5251996', name: 'JUEVESANO, JASPER A.' },
        { id: 'stu_5250455', studentId: '5250455', name: 'LALLEN, RHEINZ KEN ANGEL G.' },
        { id: 'stu_5250438', studentId: '5250438', name: 'LANDERO II, ROQUE KYLE C.' },
        { id: 'stu_5250427', studentId: '5250427', name: 'LARIOSA, CHRISTIEN B.' },
        { id: 'stu_5250505', studentId: '5250505', name: 'MALIRONG, REYNEL F.' },
        { id: 'stu_5251874', studentId: '5251874', name: 'MARTINEZ, JAKE L.' },
        { id: 'stu_5251869', studentId: '5251869', name: 'MENDRES, MIKHAELA S.' },
        { id: 'stu_5251562', studentId: '5251562', name: 'MESIONA, RADSNEY D.' },
        { id: 'stu_5250530', studentId: '5250530', name: 'NAVARRO, KYLE STEVEN B.' },
        { id: 'stu_5250426', studentId: '5250426', name: 'PAGLINAWAN, ANALYN P.' },
        { id: 'stu_5250511', studentId: '5250511', name: 'PAHAYAHAY, ANGELICA P.' },
        { id: 'stu_5251871', studentId: '5251871', name: 'PAYDA, CLARENCE M.' },
        { id: 'stu_5251868', studentId: '5251868', name: 'QUIMADA, JOIE D.' },
        { id: 'stu_5250470', studentId: '5250470', name: 'RODA, CLYDE IVAN S.' },
        { id: 'stu_5250521', studentId: '5250521', name: 'SARLATAN, AARON JACOB M.' },
        { id: 'stu_5250489', studentId: '5250489', name: 'SIAROT, KRISTEL MAE S.' },
        { id: 'stu_5250475', studentId: '5250475', name: 'SOCIAS, JEFFERSON L.' },
        { id: 'stu_5250518', studentId: '5250518', name: 'TORRES, IZZA MARIE B.' }
      ],
      createdAt: Date.now()
    },

    // BSIT 2B (Day - 32 students)
    {
      id: 'sec_bsit2b',
      programId: 'prog_bsit',
      name: 'BSIT 2B',
      yearLevel: '2nd Year',
      semester: '1st Semester',
      students: [
        { id: 'stu_5250504', studentId: '5250504', name: 'ABISO, IRA MARIE A.' },
        { id: 'stu_5250454', studentId: '5250454', name: 'ASINGUA, BJ RUSSEL T.' },
        { id: 'stu_5250512', studentId: '5250512', name: 'AUXTERO, MARY JOY R.' },
        { id: 'stu_5250509', studentId: '5250509', name: 'AWIT, GLENNDEL S.' },
        { id: 'stu_5250460', studentId: '5250460', name: 'CAMPOS, ALTHEA P.' },
        { id: 'stu_5250431', studentId: '5250431', name: 'CANOY, JAMES ANDREW C.' },
        { id: 'stu_5250507', studentId: '5250507', name: 'CATAYAS, FRITZ C.' },
        { id: 'stu_5250464', studentId: '5250464', name: 'COSTANILLA, STEPHEN L.' },
        { id: 'stu_5250600', studentId: '5250600', name: 'CURAY, NIÑA MAE Q.' },
        { id: 'stu_5250495', studentId: '5250495', name: 'DESUCATAN, KEN C.' },
        { id: 'stu_5250425', studentId: '5250425', name: 'ELAMNE, NIÑO ASHLY M.' },
        { id: 'stu_5250468', studentId: '5250468', name: 'ELEMINO, HASHLEY JENISE C.' },
        { id: 'stu_5250432', studentId: '5250432', name: 'GABISAN, AUGUSTINE I.' },
        { id: 'stu_5251870', studentId: '5251870', name: 'GALLARDO, CRYSTAL FAITH -.' },
        { id: 'stu_5250520', studentId: '5250520', name: 'GARCIA, JANIEL JEFF D.' },
        { id: 'stu_5250465', studentId: '5250465', name: 'GODINEZ, JOANNA B.' },
        { id: 'stu_5250446', studentId: '5250446', name: 'GUINITA, MERICK JHYLLE A.' },
        { id: 'stu_5250430', studentId: '5250430', name: 'INDIG, ANGEL G.' },
        { id: 'stu_5250481', studentId: '5250481', name: 'LUCION, JUSTINE JUDE S.' },
        { id: 'stu_5250436', studentId: '5250436', name: 'MALOLOY-ON, ASHLEY B.' },
        { id: 'stu_5250449', studentId: '5250449', name: 'MARCELLANA, GRACE L.' },
        { id: 'stu_5250452', studentId: '5250452', name: 'MOMO, KESIYA ARRIANA A.' },
        { id: 'stu_5250519', studentId: '5250519', name: 'MOSQUERA, CARL ERNEST S.' },
        { id: 'stu_5250437', studentId: '5250437', name: 'PILOTO, ANDREE C.' },
        { id: 'stu_5250498', studentId: '5250498', name: 'SABIO, KEIRA AUDREY C.' },
        { id: 'stu_5250522', studentId: '5250522', name: 'SALAHID, KIN CASTER TROY S.' },
        { id: 'stu_5250456', studentId: '5250456', name: 'SORTONES, KIMBERLY O.' },
        { id: 'stu_5250514', studentId: '5250514', name: 'TAPERLA, VINCE THERES L.' },
        { id: 'stu_5251873', studentId: '5251873', name: 'TUBURAN, KURT L.' },
        { id: 'stu_5250503', studentId: '5250503', name: 'TUL-ID, LIERA JANE -.' },
        { id: 'stu_5250433', studentId: '5250433', name: 'URSUNAL, JENIEL C.' },
        { id: 'stu_5250467', studentId: '5250467', name: 'VILLARONTE, HERALIA P.' }
      ],
      createdAt: Date.now()
    },

    // BSIT 2C (Day - 33 students)
    {
      id: 'sec_bsit2c',
      programId: 'prog_bsit',
      name: 'BSIT 2C',
      yearLevel: '2nd Year',
      semester: '1st Semester',
      students: [
        { id: 'stu_5250440', studentId: '5250440', name: 'ARAGON, MARLI SHANE A.' },
        { id: 'stu_5250490', studentId: '5250490', name: 'BALUCOS, ROSE ANN M.' },
        { id: 'stu_5250453', studentId: '5250453', name: 'CABARDO, MARIA JULIA M.' },
        { id: 'stu_5250603', studentId: '5250603', name: 'CALAGO, GIAN S.' },
        { id: 'stu_5250502', studentId: '5250502', name: 'CALINAWAN, KAREN THERESE H.' },
        { id: 'stu_5250515', studentId: '5250515', name: 'CAÑADA, JAMES PHILLIP D.' },
        { id: 'stu_5250516', studentId: '5250516', name: 'CAÑETE, JOSEPH CYRIL P.' },
        { id: 'stu_5250461', studentId: '5250461', name: 'CANGMAONG, CRISSA MAE C.' },
        { id: 'stu_5250488', studentId: '5250488', name: 'CATANAMAN, JENNY BABE C.' },
        { id: 'stu_5250450', studentId: '5250450', name: 'DELA CRUZ, RHENA' },
        { id: 'stu_5250439', studentId: '5250439', name: 'DIAMANTE, CJ O.' },
        { id: 'stu_5250457', studentId: '5250457', name: 'DICHOS, APRIL JANE M.' },
        { id: 'stu_5250492', studentId: '5250492', name: 'DIVINAGRACIA, AIRA SHANE S.' },
        { id: 'stu_5250477', studentId: '5250477', name: 'FUENTES, PAULEEN ALEXA F.' },
        { id: 'stu_5250499', studentId: '5250499', name: 'HEYROSA, CHRISJOHN C.' },
        { id: 'stu_5250501', studentId: '5250501', name: 'HONRADA, APRIL ROSE B.' },
        { id: 'stu_5250463', studentId: '5250463', name: 'IBO, CANDELARIO JR. V.' },
        { id: 'stu_5250424', studentId: '5250424', name: 'JAYME, HANZ D.' },
        { id: 'stu_5250500', studentId: '5250500', name: 'LAZAGA, JEAN MARIE C.' },
        { id: 'stu_5250591', studentId: '5250591', name: 'MACAPAZ, ROMEO JR E.' },
        { id: 'stu_5250483', studentId: '5250483', name: 'MAGLASANG, BRYLLE A.' },
        { id: 'stu_5250476', studentId: '5250476', name: 'PACQUIAO, ROBERTO C.' },
        { id: 'stu_5250445', studentId: '5250445', name: 'PANTINUPLE, JOHN KENT B.' },
        { id: 'stu_5250478', studentId: '5250478', name: 'PRAHINOG, ALEXA THERESE C.' },
        { id: 'stu_5250554', studentId: '5250554', name: 'REDAZA, LAWRENCE DAVID M.' },
        { id: 'stu_5250485', studentId: '5250485', name: 'RONDEZ, MARC FRANCE H.' },
        { id: 'stu_5250575', studentId: '5250575', name: 'ROXAS, JHOREIL KEN C.' },
        { id: 'stu_5250506', studentId: '5250506', name: 'SABALANDE, GLEGEN C.' },
        { id: 'stu_5250484', studentId: '5250484', name: 'SAMIAO, JAENEROSE M.' },
        { id: 'stu_5250496', studentId: '5250496', name: 'SEÑORON, CHRIS OYVEN L.' },
        { id: 'stu_5250510', studentId: '5250510', name: 'TALLEDO, RHONA JANE P.' },
        { id: 'stu_5250472', studentId: '5250472', name: 'TAPARAN, GYDE FRANDY B.' },
        { id: 'stu_5251872', studentId: '5251872', name: 'TIWANAG, LOVELY ROSE' }
      ],
      createdAt: Date.now()
    },

    // BSIT 2D (Evening - 27 students)
    {
      id: 'sec_bsit2d',
      programId: 'prog_bsit',
      name: 'BSIT 2D',
      yearLevel: '2nd Year',
      semester: '1st Semester',
      students: [
        { id: 'stu_5250531', studentId: '5250531', name: 'AMAHAN, CHARLYN L.' },
        { id: 'stu_5250583', studentId: '5250583', name: 'AMANCIO, JAYJAY P.' },
        { id: 'stu_5250572', studentId: '5250572', name: 'ANCAJAS, SHENA P.' },
        { id: 'stu_5250517', studentId: '5250517', name: 'ARIAS, JOHN ODILON C.' },
        { id: 'stu_5250605', studentId: '5250605', name: 'ARNADO, GIAN O.' },
        { id: 'stu_5251886', studentId: '5251886', name: 'BRIGOLI, JEYK BERWIN B.' },
        { id: 'stu_5250562', studentId: '5250562', name: 'CAMAHALAN, JHEA' },
        { id: 'stu_5250539', studentId: '5250539', name: 'CAMUS, JOAN J.' },
        { id: 'stu_5250549', studentId: '5250549', name: 'CAÑETE, MARK JACENT A.' },
        { id: 'stu_5250568', studentId: '5250568', name: 'CANOY, JOHN OMAR A.' },
        { id: 'stu_5250581', studentId: '5250581', name: 'CAPUYAN, JAMAICA P.' },
        { id: 'stu_5250528', studentId: '5250528', name: 'DAÑAS, FRANZEN JAMES G.' },
        { id: 'stu_5251880', studentId: '5251880', name: 'DINOPOL, FRITZ GERALD A.' },
        { id: 'stu_5241367', studentId: '5241367', name: 'FORTUNADO, FLORIDAN N.' },
        { id: 'stu_5250610', studentId: '5250610', name: 'GUNGOB, JEANS RUFFY C.' },
        { id: 'stu_5250564', studentId: '5250564', name: 'KINKITO, VIC ERSON Y.' },
        { id: 'stu_5250542', studentId: '5250542', name: 'LABANGON, FRIAH ZHIENE ANN P.' },
        { id: 'stu_5251884', studentId: '5251884', name: 'LARIOSA, DELGIE B.' },
        { id: 'stu_5250529', studentId: '5250529', name: 'LIBRE, VICTOR' },
        { id: 'stu_5250606', studentId: '5250606', name: 'MUÑOZ, FELIPE G.' },
        { id: 'stu_5251883', studentId: '5251883', name: 'PAGLINAWAN, RUTCHIE A.' },
        { id: 'stu_5251882', studentId: '5251882', name: 'PEGAROM, DESIRIE V.' },
        { id: 'stu_5250545', studentId: '5250545', name: 'PONES, JOHN ALDEN I.' },
        { id: 'stu_5250525', studentId: '5250525', name: 'TAN, CHARITY L.' },
        { id: 'stu_5250435', studentId: '5250435', name: 'UY, KEITH FRANCIS R.' },
        { id: 'stu_5250532', studentId: '5250532', name: 'VILLANUEVA, JOHN PATRICK M.' },
        { id: 'stu_5250552', studentId: '5250552', name: 'YLANAN, MEL DENVER A.' }
      ],
      createdAt: Date.now()
    },

    // BSIT 2E (Evening - 26 students)
    {
      id: 'sec_bsit2e',
      programId: 'prog_bsit',
      name: 'BSIT 2E',
      yearLevel: '2nd Year',
      semester: '1st Semester',
      students: [
        { id: 'stu_5250565', studentId: '5250565', name: 'APARES, BRYLLE JOHN A.' },
        { id: 'stu_5250553', studentId: '5250553', name: 'BARTOLINI, RAZIL CLEONY A.' },
        { id: 'stu_5250546', studentId: '5250546', name: 'CABRERA, GILBERT B.' },
        { id: 'stu_5211541', studentId: '5211541', name: 'CARTAGENA, AIREEN P.' },
        { id: 'stu_5250563', studentId: '5250563', name: 'CASILAO, JESRIEL L.' },
        { id: 'stu_5251949', studentId: '5251949', name: 'CATUBIG, VINCENT A.' },
        { id: 'stu_5250602', studentId: '5250602', name: 'DALES, IVAN KIM G.' },
        { id: 'stu_5250569', studentId: '5250569', name: 'DE GUZMAN, JESRYL B.' },
        { id: 'stu_5250593', studentId: '5250593', name: 'DUMAGAN, JONH KYLE T.' },
        { id: 'stu_5250548', studentId: '5250548', name: 'DUMDUM, JAMEIS OLIVER U.' },
        { id: 'stu_5250590', studentId: '5250590', name: 'GADIA, TRISHA Q.' },
        { id: 'stu_5250576', studentId: '5250576', name: 'GAKO, KURT LAURENCE D.' },
        { id: 'stu_5250556', studentId: '5250556', name: 'INAHID, JEAN LORRAINE' },
        { id: 'stu_5250547', studentId: '5250547', name: 'LAPE, TRISHA MAE M.' },
        { id: 'stu_5250551', studentId: '5250551', name: 'LAURON, PHILIP ZAEL C.' },
        { id: 'stu_5250570', studentId: '5250570', name: 'OTAPIL, JOSELITO T.' },
        { id: 'stu_5250550', studentId: '5250550', name: 'QUIMBO, FRANCIS PAUL C.' },
        { id: 'stu_5250557', studentId: '5250557', name: 'RABUNGUE, KIMBERLY KATE P.' },
        { id: 'stu_5250580', studentId: '5250580', name: 'REGINO, CLIFFORD JAY F.' },
        { id: 'stu_5250566', studentId: '5250566', name: 'SAYSON, KRIS JAY D.' },
        { id: 'stu_5250607', studentId: '5250607', name: 'TAMARGO, FRANCIS JAMES L.' },
        { id: 'stu_5250555', studentId: '5250555', name: 'TAPANGAN, KRISHIA MAE C.' },
        { id: 'stu_5250544', studentId: '5250544', name: 'VILLARIN, BRYAN JEE M.' },
        { id: 'stu_5250434', studentId: '5250434', name: 'VILLAROSA, GABRIEL A.' },
        { id: 'stu_5250571', studentId: '5250571', name: 'VOCALES, JAMES LAWRENCE C.' },
        { id: 'stu_5250567', studentId: '5250567', name: 'ZAFRA, LUIS LORENZ E.' }
      ],
      createdAt: Date.now()
    },

    // BSIT 2F (Evening - 31 students)
    {
      id: 'sec_bsit2f',
      programId: 'prog_bsit',
      name: 'BSIT 2F',
      yearLevel: '2nd Year',
      semester: '1st Semester',
      students: [
        { id: 'stu_5250559', studentId: '5250559', name: 'ACASO, LUKE ABRAHAM G.' },
        { id: 'stu_5250543', studentId: '5250543', name: 'AGABON, REY JOSEPH A.' },
        { id: 'stu_5250585', studentId: '5250585', name: 'ALFORQUE, IZYTHAN C.' },
        { id: 'stu_5250538', studentId: '5250538', name: 'BARON, CRISTINE L.' },
        { id: 'stu_5250586', studentId: '5250586', name: 'BATULAN, ANDREILO MARCO P.' },
        { id: 'stu_5250589', studentId: '5250589', name: 'BIÑAN, SELJHON M.' },
        { id: 'stu_5251876', studentId: '5251876', name: 'CUESTA, HANNA KIM N.' },
        { id: 'stu_5250462', studentId: '5250462', name: 'CUIZON, BINJIE E.' },
        { id: 'stu_5250558', studentId: '5250558', name: 'GERALDE, BRIZEVER D.' },
        { id: 'stu_5251879', studentId: '5251879', name: 'GILBUENA, WENDY MARIE P.' },
        { id: 'stu_5250540', studentId: '5250540', name: 'GOC-ONG, CRISTHEL B.' },
        { id: 'stu_5250537', studentId: '5250537', name: 'GUNGOB, SYRELLE JAY C.' },
        { id: 'stu_5250604', studentId: '5250604', name: 'HASIM, HASANOR B.' },
        { id: 'stu_5250588', studentId: '5250588', name: 'HORTELANO, JOYCE MAE L.' },
        { id: 'stu_5250608', studentId: '5250608', name: 'JUBAY, GABRIEL LUIS D.' },
        { id: 'stu_5250596', studentId: '5250596', name: 'LAÑA, MARK KEVIN H.' },
        { id: 'stu_5251881', studentId: '5251881', name: 'MANABAN, JHONCARL M.' },
        { id: 'stu_5251878', studentId: '5251878', name: 'MASAYON, LESLIE JOY N.' },
        { id: 'stu_5250560', studentId: '5250560', name: 'NAVARRO, FRANCIS KIANE P.' },
        { id: 'stu_5250601', studentId: '5250601', name: 'PANTILGAN, JHEA F.' },
        { id: 'stu_5250533', studentId: '5250533', name: 'PASCO, JOHN TEMPEST M.' },
        { id: 'stu_5251887', studentId: '5251887', name: 'PITOGO, ANGELICA KAYLE O.' },
        { id: 'stu_5250561', studentId: '5250561', name: 'RETAZA, JAMIL E.' },
        { id: 'stu_5250598', studentId: '5250598', name: 'SALIG, EUNEL JEAN G.' },
        { id: 'stu_5250578', studentId: '5250578', name: 'SISMAR, RAFFE C.' },
        { id: 'stu_5250582', studentId: '5250582', name: 'TAGANILE, CHRIS DAVE N.' },
        { id: 'stu_5251877', studentId: '5251877', name: 'TAN-AWON, GENELEN T.' },
        { id: 'stu_5250595', studentId: '5250595', name: 'TUDTUD, KYLA MAE S.' },
        { id: 'stu_5250448', studentId: '5250448', name: 'VERAN, SHERLY B.' },
        { id: 'stu_5250577', studentId: '5250577', name: 'YAMELO, JHON KENNETH B.' },
        { id: 'stu_5250541', studentId: '5250541', name: 'YUSON, SHELLA JANE D.' }
      ],
      createdAt: Date.now()
    },

    // BSIT 3A (Day - 24 students)
    {
      id: 'sec_bsit3a',
      programId: 'prog_bsit',
      name: 'BSIT 3A',
      yearLevel: '3rd Year',
      semester: '1st Semester',
      students: [
        { id: 'stu_5241289', studentId: '5241289', name: 'ABELLA, SHIELA A.' },
        { id: 'stu_5241261', studentId: '5241261', name: 'ARNAIZ, JOHN CLARK T.' },
        { id: 'stu_5241274', studentId: '5241274', name: 'BALIBAD, ZHEREMAE G.' },
        { id: 'stu_5241290', studentId: '5241290', name: 'BATILLER, JEUNGHAN F.' },
        { id: 'stu_5241275', studentId: '5241275', name: 'BOCABAL, DIVINE GRACE R.' },
        { id: 'stu_5241279', studentId: '5241279', name: 'BRIGOLI, HANNAH T.' },
        { id: 'stu_5241272', studentId: '5241272', name: 'BUCABAL, JOAN C.' },
        { id: 'stu_5241278', studentId: '5241278', name: 'COPAS, ISIAH MIGUEL M.' },
        { id: 'stu_5241258', studentId: '5241258', name: 'GABUYA, AARON KRISTOFFER G.' },
        { id: 'stu_5241265', studentId: '5241265', name: 'HABASA, BABY DORES S.' },
        { id: 'stu_5241310', studentId: '5241310', name: 'IGNALIG, ANA MARIE A.' },
        { id: 'stu_5241313', studentId: '5241313', name: 'JUGAN, ANGELA S.' },
        { id: 'stu_5241302', studentId: '5241302', name: 'LANGGA, HUXLEY R.' },
        { id: 'stu_5241300', studentId: '5241300', name: 'LEJANO, MARJORIE L.' },
        { id: 'stu_5180640', studentId: '5180640', name: 'LICANDA, ANGELOU V.' },
        { id: 'stu_5241294', studentId: '5241294', name: 'NOEL, KRISTINA C.' },
        { id: 'stu_5241276', studentId: '5241276', name: 'PAGLINAWAN, AIMEE G.' },
        { id: 'stu_5241359', studentId: '5241359', name: 'PAKINGAN, KENT VINCENT O.' },
        { id: 'stu_5241303', studentId: '5241303', name: 'SARLATAN, JAMES RALPH M.' },
        { id: 'stu_5241273', studentId: '5241273', name: 'SEÑAGAN, VINCE CYRUS D.' },
        { id: 'stu_5251804', studentId: '5251804', name: 'TAGULABONG, LYCA MARIE G.' },
        { id: 'stu_5241305', studentId: '5241305', name: 'TORION, XYLERE THERESE N.' },
        { id: 'stu_5241301', studentId: '5241301', name: 'TULING, RENZ P.' },
        { id: 'stu_5241267', studentId: '5241267', name: 'TURA, GELEAH R.' }
      ],
      createdAt: Date.now()
    },

    // BSIT 3B (Day - 24 students)
    {
      id: 'sec_bsit3b',
      programId: 'prog_bsit',
      name: 'BSIT 3B',
      yearLevel: '3rd Year',
      semester: '1st Semester',
      students: [
        { id: 'stu_5241299', studentId: '5241299', name: 'ARDIENTE, CLIFFORD B.' },
        { id: 'stu_5241288', studentId: '5241288', name: 'AYUNAN, VINCE JM E.' },
        { id: 'stu_5241450', studentId: '5241450', name: 'BANTILAN, JOSEPH KYLE L.' },
        { id: 'stu_5241263', studentId: '5241263', name: 'BARRERA, KRISTINE ELLISA A.' },
        { id: 'stu_5241277', studentId: '5241277', name: 'BEJASA, SEAN DEVOUGHN B.' },
        { id: 'stu_5241269', studentId: '5241269', name: 'BONTIA, CRISVIN ALVIC D.' },
        { id: 'stu_5241271', studentId: '5241271', name: 'BRIGOLI, RENAL JANE C.' },
        { id: 'stu_5240538', studentId: '5240538', name: 'CAÑETE, FERL THUVIEN P.' },
        { id: 'stu_5250018', studentId: '5250018', name: 'COLLARIN, KEZIAH LHEE L.' },
        { id: 'stu_5241259', studentId: '5241259', name: 'DA-AN, DEECERE LINAH MARIE G.' },
        { id: 'stu_5241314', studentId: '5241314', name: 'ECHAVEZ, RUSSELL YURI S.' },
        { id: 'stu_5241298', studentId: '5241298', name: 'ESPINOSA, CLAIRE M.' },
        { id: 'stu_5241293', studentId: '5241293', name: 'ESTREBA, RAINN PAUL A.' },
        { id: 'stu_5241311', studentId: '5241311', name: 'FERNANDEZ, KATRINA KATE S.' },
        { id: 'stu_5241266', studentId: '5241266', name: 'GERALE, ANNEVIE P.' },
        { id: 'stu_5241291', studentId: '5241291', name: 'LOMOCSO, KINSTIN L.' },
        { id: 'stu_5241292', studentId: '5241292', name: 'MAHILOM, DENCIL D.' },
        { id: 'stu_5241260', studentId: '5241260', name: 'MALAZARTE, HONEY KAYE C.' },
        { id: 'stu_5241308', studentId: '5241308', name: 'PELAYO, JUN ROBERT M.' },
        { id: 'stu_5241297', studentId: '5241297', name: 'PENALES, JANNELLE T.' },
        { id: 'stu_5241312', studentId: '5241312', name: 'RONDEZ, KENDRA T.' },
        { id: 'stu_5241262', studentId: '5241262', name: 'SALCEDO, JOHN VINCENT C.' },
        { id: 'stu_5220014', studentId: '5220014', name: 'TIÑAS, JHAY MARK B.' },
        { id: 'stu_5241296', studentId: '5241296', name: 'ZAPANTA, KARYLLE ANNE J.' }
      ],
      createdAt: Date.now()
    },

    // BSIT 3C (Evening - 24 students)
    {
      id: 'sec_bsit3c',
      programId: 'prog_bsit',
      name: 'BSIT 3C',
      yearLevel: '3rd Year',
      semester: '1st Semester',
      students: [
        { id: 'stu_5241345', studentId: '5241345', name: 'ABANID, MITZ ALOHA T.' },
        { id: 'stu_5241336', studentId: '5241336', name: 'ADLAWAN, METHUSELAH D.' },
        { id: 'stu_5241353', studentId: '5241353', name: 'AGSOY, ROGELIO JR. E.' },
        { id: 'stu_5241383', studentId: '5241383', name: 'ALCALA, DIOSH DYLAN D.' },
        { id: 'stu_5241338', studentId: '5241338', name: 'ANTIMARO, CHRISTIAN L.' },
        { id: 'stu_5241355', studentId: '5241355', name: 'BACHO, JEZNEL KENT L.' },
        { id: 'stu_5241371', studentId: '5241371', name: 'BORJA, JHON KYLE U.' },
        { id: 'stu_5241369', studentId: '5241369', name: 'BUHIAN, REEVAN B.' },
        { id: 'stu_5231615', studentId: '5231615', name: 'BUHIAN, TYRON B.' },
        { id: 'stu_5231600', studentId: '5231600', name: 'ENTERINA, PATRICK H.' },
        { id: 'stu_5241361', studentId: '5241361', name: 'GLODOVE, LOUIS MICHAEL T.' },
        { id: 'stu_5241339', studentId: '5241339', name: 'GONZAGA, MILES N.' },
        { id: 'stu_5231589', studentId: '5231589', name: 'GUARIN, ALDREN M.' },
        { id: 'stu_5241354', studentId: '5241354', name: 'LAZAGA, JAMES C.' },
        { id: 'stu_5241337', studentId: '5241337', name: 'NATURAL, ROLLEN C.' },
        { id: 'stu_5231623', studentId: '5231623', name: 'RAMOS, NEIL ADRIAN F.' },
        { id: 'stu_5241374', studentId: '5241374', name: 'REMEDIO, MARK B.' },
        { id: 'stu_5241363', studentId: '5241363', name: 'ROCA, TRIXIE N.' },
        { id: 'stu_5241344', studentId: '5241344', name: 'RONARIO, SONJHAY P.' },
        { id: 'stu_5241382', studentId: '5241382', name: 'SEMBRINO, MARY GRACE C.' },
        { id: 'stu_5241376', studentId: '5241376', name: 'SORTONES, CHAWE A.' },
        { id: 'stu_5241368', studentId: '5241368', name: 'TALAUGON, GLYDEL P.' },
        { id: 'stu_5241381', studentId: '5241381', name: 'TRASMONTE, KURT IVAN N.' },
        { id: 'stu_5241341', studentId: '5241341', name: 'VILLAFRANCA, RIZZA MAE L.' }
      ],
      createdAt: Date.now()
    },

    // BSIT 3D (Evening - 19 students)
    {
      id: 'sec_bsit3d',
      programId: 'prog_bsit',
      name: 'BSIT 3D',
      yearLevel: '3rd Year',
      semester: '1st Semester',
      students: [
        { id: 'stu_5231595', studentId: '5231595', name: 'ABELLANA, KURT HAMET H.' },
        { id: 'stu_5241356', studentId: '5241356', name: 'BARON, LEXEL ENOSH B.' },
        { id: 'stu_5241358', studentId: '5241358', name: 'BOT-OY, JAYROLD A.' },
        { id: 'stu_5241357', studentId: '5241357', name: 'CULDORA, RENIANE A.' },
        { id: 'stu_5241372', studentId: '5241372', name: 'ESTOY, JAMFRYX ZION E.' },
        { id: 'stu_5241342', studentId: '5241342', name: 'GALLARDO, GERMAINE O.' },
        { id: 'stu_5220866', studentId: '5220866', name: 'GONZAGA, CHRIS GABRIEL B.' },
        { id: 'stu_5241379', studentId: '5241379', name: 'LABANA, JARRED C.' },
        { id: 'stu_5241352', studentId: '5241352', name: 'MAANO, FRITZ LEWEL M.' },
        { id: 'stu_5222008', studentId: '5222008', name: 'MAHINAY, JAPH LUKE A.' },
        { id: 'stu_5230124', studentId: '5230124', name: 'MONTEBON, GERMON A.' },
        { id: 'stu_5241365', studentId: '5241365', name: 'OGATIS, JANRYL R.' },
        { id: 'stu_5241307', studentId: '5241307', name: 'PAGLINAWAN, JOHN RAFAEL A.' },
        { id: 'stu_5241370', studentId: '5241370', name: 'PANGILINAN, KARL' },
        { id: 'stu_5241309', studentId: '5241309', name: 'PELAYO, CRYSTAL JANE M.' },
        { id: 'stu_5241346', studentId: '5241346', name: 'PEREZ, JONRHO N.' },
        { id: 'stu_5241347', studentId: '5241347', name: 'PISIAO, JEAN C.' },
        { id: 'stu_5241377', studentId: '5241377', name: 'SATO, JOSVEN N.' },
        { id: 'stu_5241380', studentId: '5241380', name: 'VILLAVER, LYNDON D.' }
      ],
      createdAt: Date.now()
    },

    // BSIT 4A (Day - 19 students)
    {
      id: 'sec_bsit4a',
      programId: 'prog_bsit',
      name: 'BSIT 4A',
      yearLevel: '4th Year',
      semester: '1st Semester',
      students: [
        { id: 'stu_5231484', studentId: '5231484', name: 'ALAÑA, ANDRIAN C.' },
        { id: 'stu_5231482', studentId: '5231482', name: 'ALBARAN, NICA JANE L.' },
        { id: 'stu_5231531', studentId: '5231531', name: 'ALIMPAGO, JEEBERT Q.' },
        { id: 'stu_5231481', studentId: '5231481', name: 'ARTAJO, KAREL FAYE G.' },
        { id: 'stu_5231492', studentId: '5231492', name: 'BAFLOR, CLENT ANDREW A.' },
        { id: 'stu_5231479', studentId: '5231479', name: 'BAHIS, SHEILLA MARIE M.' },
        { id: 'stu_5221459', studentId: '5221459', name: 'BEREBER, HOWARD KENNETH C.' },
        { id: 'stu_5231563', studentId: '5231563', name: 'CANILLAS, HANES DANIEL B.' },
        { id: 'stu_5231571', studentId: '5231571', name: 'COMAINGKING, HADJI E.' },
        { id: 'stu_5231478', studentId: '5231478', name: 'DE ASIS, MILKCA R.' },
        { id: 'stu_5231554', studentId: '5231554', name: 'GALO, JYE LOURDES A.' },
        { id: 'stu_5231587', studentId: '5231587', name: 'GENELASO, RICHMOND O.' },
        { id: 'stu_5231550', studentId: '5231550', name: 'LANZADERAS, KLAYDE C.' },
        { id: 'stu_5231528', studentId: '5231528', name: 'LEORNAS, AYESSA MAE T.' },
        { id: 'stu_5231500', studentId: '5231500', name: 'MAGAÑA, VIVIAN KAREN' },
        { id: 'stu_5231567', studentId: '5231567', name: 'MATUGAS, CLAIRE D.' },
        { id: 'stu_5231477', studentId: '5231477', name: 'RAMOS, AYEZA THERESE A.' },
        { id: 'stu_5231573', studentId: '5231573', name: 'SUMBAL, DAVE CARL D.' },
        { id: 'stu_5231592', studentId: '5231592', name: 'TABOADA, LANCE JOSHUA M.' }
      ],
      createdAt: Date.now()
    },

    // BSIT 4B (Day - 21 students)
    {
      id: 'sec_bsit4b',
      programId: 'prog_bsit',
      name: 'BSIT 4B',
      yearLevel: '4th Year',
      semester: '1st Semester',
      students: [
        { id: 'stu_5231489', studentId: '5231489', name: 'AGSOY, AELLA MARIE C.' },
        { id: 'stu_5231565', studentId: '5231565', name: 'ALFECHE, KURT BRYAN B.' },
        { id: 'stu_5231535', studentId: '5231535', name: 'ALMENTO, MARIA ESTIFANE S.' },
        { id: 'stu_5231480', studentId: '5231480', name: 'ANTIOJO, CHRISTIAN JHAY J.' },
        { id: 'stu_5231476', studentId: '5231476', name: 'ARANA, JENNYLYN' },
        { id: 'stu_5231574', studentId: '5231574', name: 'BARON, HYRDI M.' },
        { id: 'stu_5231546', studentId: '5231546', name: 'BAYNO, PRINCESS JANA MAE C.' },
        { id: 'stu_5231603', studentId: '5231603', name: 'BURGOS, ALTHEA T.' },
        { id: 'stu_5200674', studentId: '5200674', name: 'DELA CERNA, LEZLIE L.' },
        { id: 'stu_5231560', studentId: '5231560', name: 'DIAMANTE, RONAR C.' },
        { id: 'stu_5231487', studentId: '5231487', name: 'ESDRELON, KYLE REXIE R.' },
        { id: 'stu_5231570', studentId: '5231570', name: 'GARGAR, HONEY BLARE B.' },
        { id: 'stu_5231542', studentId: '5231542', name: 'GEMILLAN, SHALAIKA MAE B.' },
        { id: 'stu_5231495', studentId: '5231495', name: 'JULIANE, CARMEL M.' },
        { id: 'stu_5231568', studentId: '5231568', name: 'PESIAO, JOSHUA G.' },
        { id: 'stu_5231562', studentId: '5231562', name: 'PONSICA, GAREN XADE B.' },
        { id: 'stu_5231553', studentId: '5231553', name: 'PRAHINOG, MIKE P.' },
        { id: 'stu_5231625', studentId: '5231625', name: 'QUIJANO, MARTHRONE ANDRO M.' },
        { id: 'stu_5180669', studentId: '5180669', name: 'RAÑOLA, RYAN NICOLI T.' },
        { id: 'stu_5220071', studentId: '5220071', name: 'SACAYAN, MERLY JANE L.' },
        { id: 'stu_5231513', studentId: '5231513', name: 'YPIL, GIAN S.' }
      ],
      createdAt: Date.now()
    },

    // BSIT 4C (Evening - 10 students)
    {
      id: 'sec_bsit4c',
      programId: 'prog_bsit',
      name: 'BSIT 4C',
      yearLevel: '4th Year',
      semester: '1st Semester',
      students: [
        { id: 'stu_5231377', studentId: '5231377', name: 'ABARQUEZ, JESSAH MA. BIANCA T.' },
        { id: 'stu_5231580', studentId: '5231580', name: 'BURLADO, SHIELA MAY C.' },
        { id: 'stu_5231590', studentId: '5231590', name: 'CALVO, SHEENA BABE B.' },
        { id: 'stu_5231588', studentId: '5231588', name: 'CASILAO, NEIL L.' },
        { id: 'stu_5231585', studentId: '5231585', name: 'DATUMANONG, JASMINE JOY T.' },
        { id: 'stu_5231584', studentId: '5231584', name: 'DAYTE, CASEY LAURENCE T.' },
        { id: 'stu_5180224', studentId: '5180224', name: 'MEÑORIA, REY ANN N.' },
        { id: 'stu_5231619', studentId: '5231619', name: 'PAGLINAWAN, JAMAICA C.' },
        { id: 'stu_5231604', studentId: '5231604', name: 'PASAYLO, MARY DHEELL S.' },
        { id: 'stu_5231593', studentId: '5231593', name: 'PESTAÑO, LEXHARRIET S.' }
      ],
      createdAt: Date.now()
    },

    // BSIT 4D (Evening - 17 students)
    {
      id: 'sec_bsit4d',
      programId: 'prog_bsit',
      name: 'BSIT 4D',
      yearLevel: '4th Year',
      semester: '1st Semester',
      students: [
        { id: 'stu_5231579', studentId: '5231579', name: 'BELLITA, VINCETHEO E.' },
        { id: 'stu_5231581', studentId: '5231581', name: 'CLARO, EYERE KHAYE L.' },
        { id: 'stu_5231596', studentId: '5231596', name: 'CLARO, JOHN PAUL M.' },
        { id: 'stu_5231613', studentId: '5231613', name: 'DELA CERNA, DANVIR ERNEST P.' },
        { id: 'stu_5231575', studentId: '5231575', name: 'DIAMANTE, ACEL ANN O.' },
        { id: 'stu_5211447', studentId: '5211447', name: 'DUMDUM, HAZEL MAE P.' },
        { id: 'stu_5231620', studentId: '5231620', name: 'GENTERONE, VENUS R.' },
        { id: 'stu_5231608', studentId: '5231608', name: 'GIMONGALA, RHYAN DANIEL B.' },
        { id: 'stu_5231578', studentId: '5231578', name: 'GUMERA, VHENNZ C.' },
        { id: 'stu_5231577', studentId: '5231577', name: 'MALANG, DANIELA MARIE C.' },
        { id: 'stu_5231586', studentId: '5231586', name: 'PADOR, REY FRANZ JAMES S.' },
        { id: 'stu_5231609', studentId: '5231609', name: 'SABALA, KERJI M.' },
        { id: 'stu_5231611', studentId: '5231611', name: 'SERVIDOR, RAYMART S.' },
        { id: 'stu_5231617', studentId: '5231617', name: 'SILLAR, EPHRAIM JOHN R.' },
        { id: 'stu_5231594', studentId: '5231594', name: 'TABOTABO, FEY ANRELLE G.' },
        { id: 'stu_5231598', studentId: '5231598', name: 'TELLO, MYK LEO A.' },
        { id: 'stu_5231597', studentId: '5231597', name: 'VILLANUEVA, GHENIE S.' }
      ],
      createdAt: Date.now()
    }
  ];

  return { programs, subjects, sections };
}
