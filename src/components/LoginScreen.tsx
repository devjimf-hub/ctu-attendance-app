import React, { useState } from 'react';
import { GraduationCap, Sparkles, UserCheck, ShieldCheck } from 'lucide-react';
import { TeacherUser, CurriculumProgram } from '../types';
import { authService } from '../services/authService';
import { storageService } from '../services/storageService';

interface LoginScreenProps {
  onLoginSuccess: (user: TeacherUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const programs: CurriculumProgram[] = storageService.getPrograms();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState<string>(programs[0]?.id || 'prog_bsit');

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const selectedProgram = programs.find(p => p.id === selectedProgramId);
    const user = authService.login(name, email, selectedProgram?.department || '', selectedProgramId);
    onLoginSuccess(user);
  };

  const handleQuickDemoLogin = () => {
    const user = authService.quickDemoLogin();
    onLoginSuccess(user);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'var(--bg-main)' }}>
      <div style={{ width: '100%', maxWidth: '440px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', padding: '2rem 1.5rem', textAlign: 'center' }}>
        
        {/* App Logo & Branding */}
        <div style={{ width: '56px', height: '56px', background: '#1a73e8', borderRadius: 'var(--radius-md)', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 12px rgba(26, 115, 232, 0.35)' }}>
          <GraduationCap size={32} />
        </div>

        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          UniAttend
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          College Faculty & Teacher Attendance Portal
        </p>

        {/* 1-Tap Quick Demo Login */}
        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.75rem', marginBottom: '1.25rem', fontSize: '0.95rem' }}
          onClick={handleQuickDemoLogin}
        >
          <Sparkles size={18} />
          Quick Sign In (Prof. Turner - BSIT)
        </button>

        <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          <hr style={{ flex: 1, borderColor: 'var(--border-color)' }} />
          <span style={{ padding: '0 0.6rem' }}>OR SIGN UP / IN WITH YOUR PROGRAM</span>
          <hr style={{ flex: 1, borderColor: 'var(--border-color)' }} />
        </div>

        <form onSubmit={handleCustomLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', textAlign: 'left' }}>
          <div className="form-group">
            <label className="form-label">Professor / Lecturer Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Dr. Jane Smith"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">College Degree / Course Program *</label>
            <select
              className="form-select"
              value={selectedProgramId}
              onChange={e => setSelectedProgramId(e.target.value)}
              required
            >
              {programs.map(prog => (
                <option key={prog.id} value={prog.id}>
                  {prog.code} - {prog.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">College Email (Optional)</label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. jsmith@university.edu"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-secondary"
            style={{ width: '100%', padding: '0.65rem', marginTop: '0.5rem' }}
          >
            <UserCheck size={16} />
            Sign In to Teacher Portal
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <ShieldCheck size={14} color="var(--google-green)" />
          <span>Offline Ready • Real-time Multi-Device Sync</span>
        </div>
      </div>
    </div>
  );
};
