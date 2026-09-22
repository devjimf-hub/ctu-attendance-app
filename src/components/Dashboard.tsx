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
  BookOpen,
  Calendar,
  Sparkles,
  Layers
} from 'lucide-react';
import { Course, Student } from '../types';
import {
  DAYS_OF_WEEK,
  getTodayDayCode,
  isCourseScheduledForDay,
  getCourseTimeDisplay,
  getCourseStartTimeMinutes
} from '../utils/collegeUtils';

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
  const [dayFilter, setDayFilter] = useState<'today' | 'all'>('today');
  const [activeMenuCourseId, setActiveMenuCourseId] = useState<string | null>(null);

  const todayCode = getTodayDayCode();
  const todayObj = DAYS_OF_WEEK.find(d => d.code === todayCode) || DAYS_OF_WEEK[4]; // Default to Friday if none

  // Calculate today's scheduled classes count
  const todayCoursesCount = courses.filter(c => isCourseScheduledForDay(c, todayCode)).length;

  // Filter courses based on search and active day filter
  const filteredCourses = courses.filter(course => {
    // 1. Search term matching
    const matchesSearch =
      course.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.section.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (course.room && course.room.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (course.schedule && course.schedule.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    // 2. Day filter matching (only show if scheduled for today when 'today' is active)
    if (dayFilter === 'today') {
      return isCourseScheduledForDay(course, todayCode);
    }
    return true;
  });

  // Sort courses chronologically by time schedule
  const sortedCourses = [...filteredCourses].sort((a, b) => {
    const timeA = getCourseStartTimeMinutes(a, todayCode);
    const timeB = getCourseStartTimeMinutes(b, todayCode);
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    // Secondary fallback: custom order or course code
    if (a.order !== undefined && b.order !== undefined && a.order !== b.order) {
      return a.order - b.order;
    }
    return a.code.localeCompare(b.code);
  });

  const getStudentCount = (courseId: string) => {
    return students.filter(s => s.courseId === courseId).length;
  };

  return (
    <div>
      {/* Top Search & Create Toolbar */}
      <div className="dashboard-top-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.2rem' }}
            placeholder="Search your subjects, code, section, room..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <button className="btn btn-primary hide-on-mobile" onClick={onOpenCreateCourse}>
          <Plus size={16} />
          <span>Add Class</span>
        </button>
      </div>

      {/* Dynamic Day of Week Filter Bar: Today vs All */}
      {courses.length > 0 && (
        <div className="dashboard-day-filter-bar">
          {/* Today Button */}
          <button
            type="button"
            className={`day-filter-tab today-tab ${dayFilter === 'today' ? 'active' : ''}`}
            onClick={() => setDayFilter('today')}
            title={`Show classes scheduled for Today (${todayObj.full})`}
          >
            <Sparkles size={14} />
            <span>Today ({todayObj.label})</span>
            <span className="day-tab-count">{todayCoursesCount}</span>
          </button>

          {/* All Tab Button */}
          <button
            type="button"
            className={`day-filter-tab ${dayFilter === 'all' ? 'active' : ''}`}
            onClick={() => setDayFilter('all')}
            title="Browse all subjects"
          >
            <Layers size={14} />
            <span>All</span>
            <span className="day-tab-count">{courses.length}</span>
          </button>
        </div>
      )}

      {/* Active Filter Header Notice for Today */}
      {courses.length > 0 && dayFilter === 'today' && (
        <div className="dynamic-day-info-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Calendar size={15} />
            <span>
              Showing classes for <strong>Today ({todayObj.full})</strong> ({filteredCourses.length} of {courses.length} classes)
            </span>
          </div>
        </div>
      )}

      {/* Classroom Cards Grid */}
      {sortedCourses.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '3.5rem 1.5rem', textAlign: 'center', maxWidth: '540px', margin: '2rem auto' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: 'var(--radius-full)', background: 'var(--primary-light)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
            <BookOpen size={28} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', marginBottom: '0.35rem' }}>
            {courses.length === 0
              ? 'No Classes Created Yet'
              : dayFilter === 'today'
              ? `No Classes Scheduled for Today (${todayObj.full})`
              : 'No Matching Classes'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {courses.length === 0
              ? 'Tap the button below to add your first college class and start taking roll calls.'
              : dayFilter === 'today'
              ? 'You can switch to "All" to view all your enrolled classes.'
              : 'Try clearing your search query to see all classes.'}
          </p>
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {courses.length > 0 && dayFilter === 'today' && (
              <button className="btn btn-secondary" onClick={() => setDayFilter('all')}>
                View All {courses.length} Classes
              </button>
            )}
            <button className="btn btn-primary" onClick={onOpenCreateCourse}>
              <Plus size={16} />
              Add Class
            </button>
          </div>
        </div>
      ) : (
        <div className="classroom-grid">
          {sortedCourses.map(course => {
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
                    backgroundImage: `linear-gradient(135deg, ${course.color || '#1a73e8'} 0%, rgba(0,0,0,0.25) 100%)`
                  }}
                >
                  <div className="card-top-row">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="card-course-code">
                        {course.section ? `${course.section} - ${course.code}` : course.code}
                      </div>
                      <div className="card-course-name">{course.name}</div>
                    </div>

                    {/* 3-dots action menu */}
                    <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                      <button
                        className="btn-icon"
                        style={{ color: '#ffffff', background: 'rgba(0,0,0,0.18)', width: '30px', height: '30px' }}
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
                            <Edit2 size={14} /> Edit Class
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
                              if (confirm(`Delete class "${course.code} - ${course.name}"?`)) {
                                onDeleteCourse(course.id);
                              }
                            }}
                          >
                            <Trash2 size={14} /> Delete Class
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="card-section-name">
                    {course.semester}
                  </div>
                </div>

                {/* Card Body */}
                <div className="classroom-card-body">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {(() => {
                      const timeText = getCourseTimeDisplay(course, todayCode);
                      if (!timeText) return null;
                      return (
                        <div className="card-info-row">
                          <Clock size={13} />
                          <span>{timeText}</span>
                        </div>
                      );
                    })()}

                    {course.room && (
                      <div className="card-info-row">
                        <MapPin size={13} />
                        <span>Room: {course.room}</span>
                      </div>
                    )}
                  </div>

                  <div className="card-footer-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                      <Users size={14} />
                      <span>{studentCount} Students</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--primary)', fontWeight: 600 }}>
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

      {/* Floating Action Button (FAB) for Mobile - Bottom Right */}
      <button
        type="button"
        className="fab-add-class"
        onClick={onOpenCreateCourse}
        aria-label="Add Class"
        title="Add Class"
      >
        <Plus size={20} />
        <span>Add Class</span>
      </button>
    </div>
  );
};
