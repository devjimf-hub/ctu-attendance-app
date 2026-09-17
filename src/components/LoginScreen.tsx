import React, { useState } from 'react';
import {
  GraduationCap,
  LogIn,
  UserPlus,
  Mail,
  Lock,
  User,
  BookOpen,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { TeacherUser, CurriculumProgram } from '../types';
import { authService } from '../services/authService';
import { storageService } from '../services/storageService';

interface LoginScreenProps {
  onLoginSuccess: (user: TeacherUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const programs: CurriculumProgram[] = storageService.getPrograms();
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState<string>(programs[0]?.id || 'prog_bsit');

  // UI status
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = () => {
    setErrorMessage(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleToggleMode = (mode: 'signin' | 'register') => {
    setAuthMode(mode);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your faculty email address.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    if (authMode === 'register') {
      if (!name.trim()) {
        setErrorMessage('Please enter your full name / faculty title.');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please re-check.');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (authMode === 'signin') {
        const user = await authService.loginWithFirebase(cleanEmail, password);
        onLoginSuccess(user);
      } else {
        const selectedProg = programs.find(p => p.id === selectedProgramId);
        const department = selectedProg?.department || 'College of Technology';
        const user = await authService.registerWithFirebase(
          name.trim(),
          cleanEmail,
          password,
          department,
          selectedProgramId
        );
        onLoginSuccess(user);
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
      const friendlyMsg = authService.formatAuthError(err);
      setErrorMessage(friendlyMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem 1rem',
      background: 'var(--bg-main)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        padding: '2rem 1.75rem',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* App Logo & Branding */}
        <div style={{
          width: '56px',
          height: '56px',
          background: 'linear-gradient(135deg, #1a73e8 0%, #1557b0 100%)',
          borderRadius: 'var(--radius-md)',
          margin: '0 auto 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          boxShadow: '0 6px 16px rgba(26, 115, 232, 0.35)'
        }}>
          <GraduationCap size={32} />
        </div>

        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.45rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '0.25rem'
        }}>
          UniAttend
        </h1>
        <p style={{
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          marginBottom: '1.5rem'
        }}>
          Cebu Technological University • Faculty Portal
        </p>

        {/* Tab Switcher: Sign In vs Register */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px',
          background: 'var(--bg-surface-elevated)',
          padding: '4px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '1.5rem',
          border: '1px solid var(--border-color)'
        }}>
          <button
            type="button"
            onClick={() => handleToggleMode('signin')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '0.6rem 0.5rem',
              border: 'none',
              borderRadius: 'var(--radius-xs)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
              background: authMode === 'signin' ? 'var(--bg-surface)' : 'transparent',
              color: authMode === 'signin' ? 'var(--primary)' : 'var(--text-secondary)',
              boxShadow: authMode === 'signin' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            <LogIn size={15} />
            Sign In
          </button>

          <button
            type="button"
            onClick={() => handleToggleMode('register')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '0.6rem 0.5rem',
              border: 'none',
              borderRadius: 'var(--radius-xs)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
              background: authMode === 'register' ? 'var(--bg-surface)' : 'transparent',
              color: authMode === 'register' ? 'var(--primary)' : 'var(--text-secondary)',
              boxShadow: authMode === 'register' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            <UserPlus size={15} />
            Register
          </button>
        </div>

        {/* Error Notification Banner */}
        {errorMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '0.75rem 0.9rem',
            background: 'var(--google-red-bg)',
            border: '1px solid var(--status-absent-border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--google-red)',
            fontSize: '0.82rem',
            textAlign: 'left',
            marginBottom: '1.25rem'
          }}>
            <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ lineHeight: 1.4 }}>{errorMessage}</div>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', textAlign: 'left' }}>
          
          {/* Register-only: Faculty Full Name */}
          {authMode === 'register' && (
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <User size={13} color="var(--text-secondary)" />
                Professor / Faculty Name *
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Prof. Juan Dela Cruz, MIT"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          )}

          {/* Register-only: Program / Department Selection */}
          {authMode === 'register' && (
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <BookOpen size={13} color="var(--text-secondary)" />
                Department / Program *
              </label>
              <select
                className="form-select"
                value={selectedProgramId}
                onChange={e => setSelectedProgramId(e.target.value)}
                required
                disabled={isLoading}
              >
                {programs.map(prog => (
                  <option key={prog.id} value={prog.id}>
                    {prog.code} - {prog.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Email Address */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Mail size={13} color="var(--text-secondary)" />
              Faculty Email *
            </label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. faculty@ctu.edu.ph"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={isLoading}
            />
          </div>

          {/* Password with Show/Hide toggle */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={13} color="var(--text-secondary)" />
              Password *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder={authMode === 'register' ? 'At least 6 characters' : 'Enter your password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                style={{ paddingRight: '2.5rem' }}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.65rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Register-only: Confirm Password */}
          {authMode === 'register' && (
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Lock size={13} color="var(--text-secondary)" />
                Confirm Password *
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Re-type your password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={isLoading}
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.75rem',
              marginTop: '0.5rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="spin-animate" />
                <span>{authMode === 'signin' ? 'Signing in...' : 'Creating Account...'}</span>
              </>
            ) : authMode === 'signin' ? (
              <>
                <LogIn size={16} />
                <span>Sign In to Teacher Portal</span>
              </>
            ) : (
              <>
                <UserPlus size={16} />
                <span>Create Faculty Account</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Subtext */}
        <div style={{
          marginTop: '1.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)'
        }}>
          <ShieldCheck size={14} color="var(--google-green)" />
          <span>Firebase Secured • Real-time Multi-Device Sync</span>
        </div>
      </div>
    </div>
  );
};
