import React, { useState, useEffect } from 'react';
import {
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
  ShieldCheck,
  ArrowRight,
  X,
  UserCheck
} from 'lucide-react';
import { TeacherUser, CurriculumProgram } from '../types';
import { authService } from '../services/authService';
import { storageService } from '../services/storageService';

interface LoginScreenProps {
  onLoginSuccess: (user: TeacherUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const programs: CurriculumProgram[] = storageService.getPrograms();

  // Saved / Recent accounts for quick login
  const [recentAccounts, setRecentAccounts] = useState<TeacherUser[]>(() => authService.getRecentAccounts());
  const [selectedQuickUser, setSelectedQuickUser] = useState<TeacherUser | null>(() => {
    const saved = authService.getRecentAccounts();
    return saved.length > 0 ? saved[0] : null;
  });

  // Auth mode: 'quick' (if recent accounts exist), 'signin', or 'register'
  const [authMode, setAuthMode] = useState<'quick' | 'signin' | 'register'>(() => {
    const saved = authService.getRecentAccounts();
    return saved.length > 0 ? 'quick' : 'signin';
  });

  // Form fields
  const [email, setEmail] = useState(() => selectedQuickUser?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState<string>(programs[0]?.id || 'prog_bsit');

  // UI status
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync email when quick user changes
  useEffect(() => {
    if (authMode === 'quick' && selectedQuickUser) {
      setEmail(selectedQuickUser.email);
    }
  }, [selectedQuickUser, authMode]);

  const handleSelectQuickAccount = (user: TeacherUser) => {
    setSelectedQuickUser(user);
    setEmail(user.email);
    setPassword('');
    setErrorMessage(null);
    setAuthMode('quick');
  };

  const handleRemoveQuickAccount = (e: React.MouseEvent, user: TeacherUser) => {
    e.stopPropagation();
    const updated = authService.removeRecentAccount(user.id);
    setRecentAccounts(updated);
    if (selectedQuickUser?.id === user.id) {
      if (updated.length > 0) {
        setSelectedQuickUser(updated[0]);
        setEmail(updated[0].email);
      } else {
        setSelectedQuickUser(null);
        setAuthMode('signin');
      }
    }
  };

  const handleToggleMode = (mode: 'signin' | 'register') => {
    setAuthMode(mode);
    setErrorMessage(null);
    setPassword('');
    setConfirmPassword('');
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
      if (authMode === 'register') {
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
      } else {
        // 'signin' or 'quick' mode
        const user = await authService.loginWithFirebase(cleanEmail, password);
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
          width: '64px',
          height: '64px',
          margin: '0 auto 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          borderRadius: 'var(--radius-full)',
          padding: '6px',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
          border: '1px solid var(--border-color)'
        }}>
          <img
            src="/logo.webp"
            alt="CTU UniAttend Logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
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

        {/* QUICK LOGIN BAR (Displayed when recent teacher accounts exist) */}
        {recentAccounts.length > 0 && (
          <div style={{ marginBottom: '1.25rem', textAlign: 'left' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.5rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              <span>Quick Login Accounts</span>
              {authMode !== 'quick' && (
                <button
                  type="button"
                  onClick={() => {
                    if (recentAccounts.length > 0) {
                      handleSelectQuickAccount(recentAccounts[0]);
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Show Quick Login
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {recentAccounts.map(account => {
                const isSelected = authMode === 'quick' && selectedQuickUser?.id === account.id;
                return (
                  <div
                    key={account.id}
                    onClick={() => handleSelectQuickAccount(account)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      background: isSelected ? 'var(--primary-light)' : 'var(--bg-surface-elevated)',
                      border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'var(--transition-fast)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: 'var(--radius-full)',
                        background: isSelected ? 'var(--primary)' : '#5f6368',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {account.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0, overflow: 'hidden' }}>
                        <div style={{
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {account.name}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {account.email}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {isSelected ? (
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: 'var(--primary)',
                          background: 'var(--bg-surface)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          border: '1px solid var(--primary)'
                        }}>
                          Active
                        </span>
                      ) : (
                        <ArrowRight size={15} color="var(--text-muted)" />
                      )}

                      <button
                        type="button"
                        onClick={(e) => handleRemoveQuickAccount(e, account)}
                        title="Remove from quick login list"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          padding: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: 'var(--radius-full)'
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Switcher: Sign In vs Register (Shown if not in quick mode or to switch) */}
        {authMode !== 'quick' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4px',
            background: 'var(--bg-surface-elevated)',
            padding: '4px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '1.25rem',
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
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)'
          }}>
            <span>Enter password to continue</span>
            <button
              type="button"
              onClick={() => handleToggleMode('signin')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                padding: 0
              }}
            >
              Use another account
            </button>
          </div>
        )}

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

          {/* Email Address (Hidden input visual when in Quick mode, editable in signin/register) */}
          {authMode !== 'quick' ? (
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
          ) : (
            <input type="hidden" value={email} />
          )}

          {/* Password with Show/Hide toggle */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={13} color="var(--text-secondary)" />
              {authMode === 'quick' ? `Password for ${selectedQuickUser?.name || email} *` : 'Password *'}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder={authMode === 'register' ? 'At least 6 characters' : 'Enter your password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                style={{ paddingRight: '2.5rem' }}
                disabled={isLoading}
                autoFocus={authMode === 'quick'}
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
                <span>
                  {authMode === 'register'
                    ? 'Creating Account...'
                    : authMode === 'quick'
                    ? `Signing in as ${selectedQuickUser?.name?.split(' ')[0] || 'Teacher'}...`
                    : 'Signing in...'}
                </span>
              </>
            ) : authMode === 'quick' ? (
              <>
                <UserCheck size={16} />
                <span>Continue as {selectedQuickUser?.name || 'Teacher'}</span>
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

        {/* Option to Switch or Register when in Quick mode */}
        {authMode === 'quick' && (
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '1rem', fontSize: '0.82rem' }}>
            <button
              type="button"
              onClick={() => handleToggleMode('signin')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Sign in with another account
            </button>
            <span style={{ color: 'var(--border-color)' }}>|</span>
            <button
              type="button"
              onClick={() => handleToggleMode('register')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Register new account
            </button>
          </div>
        )}

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
          <span>Firebase Secured • Quick Teacher Access</span>
        </div>
      </div>
    </div>
  );
};
