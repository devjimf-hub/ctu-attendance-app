import React, { useState } from 'react';
import {
  Plus,
  Search,
  Users,
  Clock,
  MapPin,
  MoreVertical,
  Edit2,
  Trash2,
  CalendarCheck,
  BookOpen
} from 'lucide-react';
import { Course, Student } from '../types';

interface DashboardProps {
  courses: Course[];
  students: Student[];
  onSelectCourse: (courseId: string) => void;
  onOpenCreateCourse: () => void;
  onEditCourse: (course: Course) => void;
  onDeleteCourse: (courseId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  courses,
  students,
  onSelectCourse,
  onOpenCreateCourse,
  onEditCourse,
  onDeleteCourse
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMenuCourseId, setActiveMenuCourseId] = useState<string | null>(null);

  const filteredCourses = courses.filter(
    c =>
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.section.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStudentCount = (courseId: string) => {
    return students.filter(s => s.courseId === courseId).length;
  };

  return (
    <div>
      {/* Top Search & Filter Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.2rem' }}
            placeholder="Search your subjects or sections..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <button className="btn btn-primary" onClick={onOpenCreateCourse}>
          <Plus size={16} />
          <span>Add Subject</span>
        </button>
      </div>

      {/* Classroom Cards Grid */}
      {filteredCourses.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '3.5rem 1.5rem', textAlign: 'center', maxWidth: '540px', margin: '2rem auto' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-full)', background: 'var(--primary-light)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <BookOpen size={28} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', marginBottom: '0.35rem' }}>
            {courses.length === 0 ? 'No Subjects Created Yet' : 'No Matching Subjects'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {courses.length === 0
              ? 'Tap the button below to add your first college subject and start taking roll calls.'
              : 'Try clearing your search query to see all subjects.'}
          </p>
          <button className="btn btn-primary" onClick={onOpenCreateCourse}>
            <Plus size={16} />
            Create Subject
          </button>
        </div>
      ) : (
        <div className="classroom-grid">
          {filteredCourses.map(course => {
            const studentCount = getStudentCount(course.id);
            const isMenuOpen = activeMenuCourseId === course.id;

            return (
              <div
                key={course.id}
                className="classroom-card"
                onClick={() => onSelectCourse(course.id)}
              >
                {/* Colored Top Header Banner */}
                <div
                  className="classroom-card-banner"
                  style={{
                    backgroundColor: course.color || '#1a73e8',
                    backgroundImage: `linear-gradient(135deg, ${course.color || '#1a73e8'} 0%, rgba(0,0,0,0.2) 100%)`
                  }}
                >
                  <div className="card-top-row">
                    <div>
                      <div className="card-course-code">{course.code}</div>
                      <div className="card-course-name">{course.name}</div>
                    </div>

                    {/* 3-dots action menu */}
                    <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                      <button
                        className="btn-icon"
                        style={{ color: '#ffffff', background: 'rgba(0,0,0,0.15)', width: '30px', height: '30px' }}
                        onClick={() => setActiveMenuCourseId(isMenuOpen ? null : course.id)}
                        aria-label="Course options"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {isMenuOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '36px',
                            right: 0,
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            boxShadow: 'var(--shadow-md)',
                            zIndex: 20,
                            minWidth: '140px',
                            overflow: 'hidden'
                          }}
                        >
                          <button
                            style={{
                              width: '100%',
                              padding: '0.6rem 0.85rem',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--text-primary)',
                              fontSize: '0.85rem',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              cursor: 'pointer'
                            }}
                            onClick={() => {
                              setActiveMenuCourseId(null);
                              onEditCourse(course);
                            }}
                          >
                            <Edit2 size={14} /> Edit Subject
                          </button>
                          <button
                            style={{
                              width: '100%',
                              padding: '0.6rem 0.85rem',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--google-red)',
                              fontSize: '0.85rem',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              cursor: 'pointer',
                              borderTop: '1px solid var(--border-color)'
                            }}
                            onClick={() => {
                              setActiveMenuCourseId(null);
                              if (confirm(`Delete subject "${course.code} - ${course.name}"?`)) {
                                onDeleteCourse(course.id);
                              }
                            }}
                          >
                            <Trash2 size={14} /> Delete Subject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="card-section-name">
                    Section: <strong>{course.section}</strong> • {course.semester}
                  </div>
                </div>

                {/* Card Body */}
                <div className="classroom-card-body">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {course.schedule && (
                      <div className="card-info-row">
                        <Clock size={14} />
                        <span>{course.schedule}</span>
                      </div>
                    )}
                    {course.room && (
                      <div className="card-info-row">
                        <MapPin size={14} />
                        <span>{course.room}</span>
                      </div>
                    )}
                  </div>

                  <div className="card-footer-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                      <Users size={14} />
                      <span>{studentCount} Students</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#1a73e8', fontWeight: 600 }}>
                      <CalendarCheck size={14} />
                      <span>Take Attendance</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
