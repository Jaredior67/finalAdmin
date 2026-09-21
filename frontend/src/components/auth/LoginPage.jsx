import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  UserPlus, 
  CheckCircle2, 
  ArrowRight,
  Shield,
  Landmark,
  Wrench,
  GraduationCap,
  KeyRound
} from 'lucide-react';
import { useAuth, TEST_PERSONAS } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { RegisterModal } from './RegisterModal';
import { Modal } from '../common/Modal';
import pdasLogo from '../../assets/fixit-logo.png';

export const LoginPage = () => {
  const { loginWithCredentials, resetPassword } = useAuth();
  const { requestPasswordChange } = useData();
  
  // Login flow active tab: 'admin' | 'faculty_staff' | 'maintenance'
  const [activeFlow, setActiveFlow] = useState('admin');

  // Credentials & Form State
  const [email, setEmail] = useState(() => localStorage.getItem('fixit_pdas_remembered_login_v1') || 'adminisatu.edu.ph@gmail.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => Boolean(localStorage.getItem('fixit_pdas_remembered_login_v1')));
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);

  // Modals State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  // Forgot password modal state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotPass, setShowForgotPass] = useState(false);
  const [showForgotConfirmPass, setShowForgotConfirmPass] = useState(false);
  const [isForgotCapsLockOn, setIsForgotCapsLockOn] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // Key event listeners for Caps Lock check
  const handlePasswordKeyDown = (e) => {
    if (e.getModifierState) {
      setIsCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  const handleForgotKeyDown = (e) => {
    if (e.getModifierState) {
      setIsForgotCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  // Switch Login Flow (Admin, Approver, Faculty & Staff, Maintenance)
  const handleSelectFlow = (flowType) => {
    setActiveFlow(flowType);
    setError('');
    
    if (flowType === 'admin') {
      const p = TEST_PERSONAS.find(item => item.key === 'admin');
      setEmail(p?.email || 'adminisatu.edu.ph@gmail.com');
      setPassword(p?.password || 'admin123');
    } else if (flowType === 'campus_admin') {
      const p = TEST_PERSONAS.find(item => item.key === 'campus_admin');
      setEmail(p?.email || 'campusadmin@isatu.edu.ph');
      setPassword(p?.password || 'admin123');
    } else if (flowType === 'faculty_staff') {
      const p = TEST_PERSONAS.find(item => item.key === 'faculty');
      setEmail(p?.email || 'faculty@isatu.edu.ph');
      setPassword(p?.password || 'faculty123');
    } else if (flowType === 'maintenance') {
      const p = TEST_PERSONAS.find(item => item.key === 'maintenance');
      setEmail(p?.email || 'maintenance@isatu.edu.ph');
      setPassword(p?.password || 'tech123');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your institutional email address.');
      return;
    }
    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    setIsLoading(true);
    setError('');

    setTimeout(async () => {
      const res = await loginWithCredentials(cleanEmail, password, activeFlow);
      setIsLoading(false);
      if (!res.success) {
        const msg = res.error || '';
        if (
          msg.toLowerCase().includes('cannot reach') ||
          msg.toLowerCase().includes('failed to fetch') ||
          msg.toLowerCase().includes('networkerror') ||
          msg.toLowerCase().includes('not reachable')
        ) {
          setError(
            '🔌 Backend server is not running. Double-click start-dev.bat in the project folder to start it, then try again.'
          );
        } else {
          setError(msg || 'Incorrect email or password. Please check your credentials.');
        }
      } else if (rememberMe) {
        localStorage.setItem('fixit_pdas_remembered_login_v1', cleanEmail);
      } else {
        localStorage.removeItem('fixit_pdas_remembered_login_v1');
      }
    }, 350);
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');

    if (!forgotEmail.trim()) {
      setForgotError('Please enter your registered institutional email.');
      return;
    }
    if (forgotPassword.length < 6) {
      setForgotError('Password must contain at least 6 characters.');
      return;
    }
    if (forgotPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match. Please verify both fields.');
      return;
    }

    setIsForgotSubmitting(true);
    const result = await resetPassword(forgotEmail.trim(), forgotPassword);
    setIsForgotSubmitting(false);

    if (!result.success) {
      setForgotError(result.error || 'Failed to reset password. Please try again.');
      return;
    }
    requestPasswordChange(forgotEmail.trim());
    setForgotSubmitted(true);
  };

  // Determine accent color for the submit button based on role
  const getSubmitBtnStyle = () => {
    if (activeFlow === 'campus_admin') {
      return { background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)' };
    }
    if (activeFlow === 'faculty_staff') {
      return { background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' };
    }
    if (activeFlow === 'maintenance') {
      return { background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)' };
    }
    return { background: 'linear-gradient(135deg, #001f9c 0%, #001373 100%)' };
  };

  return (
    <div className="login-page-root" style={{ minHeight: '100vh', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="login-desktop-shell" style={{ maxHeight: 'calc(100vh - 32px)', minHeight: '520px' }}>
        
        {/* ── Left Desktop Brand Hero Panel (Clean, Static, Professional) ── */}
        <div 
          className="login-desktop-hero"
          style={{ padding: '40px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', textAlign: 'center' }}
        >
          <div style={{ margin: 'auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <div className="login-logo-glow-wrapper" style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
              <img 
                src={pdasLogo} 
                alt="FixIT Logo" 
                className="login-desktop-hero-logo"
                style={{ height: '115px', width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 10px 24px rgba(0,0,0,0.4))' }}
                onError={(e) => { e.target.src = '/fixit-logo.png'; }}
              />
            </div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#ffffff', letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1.35, maxWidth: '340px' }}>
              ILOILO SCIENCE AND TECHNOLOGY UNIVERSITY
            </div>
            <div style={{ fontSize: '14.5px', fontWeight: '800', color: '#f59e0b', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px' }}>
              DUMANGAS CAMPUS
            </div>
            <div style={{ fontSize: '12.5px', fontWeight: '400', color: 'rgba(255,255,255,0.85)', marginTop: '6px' }}>
              Physical Development &amp; Auxiliary Services (PDAS)
            </div>
          </div>

          {/* Subdued Footer info */}
          <div style={{ fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.55)', textAlign: 'center', paddingTop: '16px' }}>
            Campus Facility Management Portal • ISAT U Dumangas
          </div>
        </div>

        {/* ── Right Desktop Authentication Form Panel ── */}
        <div className="login-desktop-form-panel" style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          
          {/* Mobile Header (Hidden on Desktop via CSS) */}
          <div className="login-mobile-only-header">
            <img src={pdasLogo} alt="FixIT Logo" style={{ height: '40px', margin: '0 auto 6px auto' }} />
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#001f9c' }}>ILOILO SCIENCE AND TECHNOLOGY UNIVERSITY</div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#d97706' }}>DUMANGAS CAMPUS</div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>PDAS Office</div>
          </div>

          {/* Form Header */}
          <div className="login-form-header" style={{ marginBottom: '16px' }}>
            <h1 className="login-form-title" style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: '0 0 4px 0' }}>Sign In</h1>
            <p className="login-form-subtitle" style={{ fontSize: '13px', color: '#475569', margin: 0 }}>
              Choose your role and enter your credentials.
            </p>
          </div>

          {/* ── Role Switcher Segmented Tabs ── */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
              SIGN IN AS
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '4px',
              background: '#f1f5f9',
              padding: '4px',
              borderRadius: '10px'
            }}>
              {/* PDAS Admin */}
              <button
                type="button"
                onClick={() => handleSelectFlow('admin')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '8px 2px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeFlow === 'admin' ? '#001f9c' : 'transparent',
                  color: activeFlow === 'admin' ? '#ffffff' : '#334155',
                  fontWeight: activeFlow === 'admin' ? '700' : '600',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <Shield size={12} />
                PDAS Head
              </button>

              {/* Approver */}
              <button
                type="button"
                onClick={() => handleSelectFlow('campus_admin')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '8px 2px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeFlow === 'campus_admin' ? '#1e3a8a' : 'transparent',
                  color: activeFlow === 'campus_admin' ? '#ffffff' : '#334155',
                  fontWeight: activeFlow === 'campus_admin' ? '700' : '600',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <Landmark size={12} />
                Approver
              </button>

              {/* Faculty & Staff */}
              <button
                type="button"
                onClick={() => handleSelectFlow('faculty_staff')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '8px 2px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeFlow === 'faculty_staff' ? '#d97706' : 'transparent',
                  color: activeFlow === 'faculty_staff' ? '#ffffff' : '#334155',
                  fontWeight: activeFlow === 'faculty_staff' ? '700' : '600',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <GraduationCap size={12} />
                Faculty / Staff
              </button>

              {/* Maintenance */}
              <button
                type="button"
                onClick={() => handleSelectFlow('maintenance')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '8px 2px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeFlow === 'maintenance' ? '#374151' : 'transparent',
                  color: activeFlow === 'maintenance' ? '#ffffff' : '#334155',
                  fontWeight: activeFlow === 'maintenance' ? '700' : '600',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <Wrench size={12} />
                Maintenance
              </button>
            </div>

            {/* One-Line Role Context Info */}
            <div style={{
              marginTop: '6px',
              padding: '6px 10px',
              background: activeFlow === 'admin' ? '#eff4ff' : activeFlow === 'campus_admin' ? '#eff6ff' : activeFlow === 'faculty_staff' ? '#fffbeb' : '#f8fafc',
              border: `1px solid ${activeFlow === 'admin' ? '#bfdbfe' : activeFlow === 'campus_admin' ? '#93c5fd' : activeFlow === 'faculty_staff' ? '#fde68a' : '#e2e8f0'}`,
              borderRadius: '8px',
              fontSize: '11.5px',
              color: '#475569',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {activeFlow === 'admin' && <><Shield size={12} color="#001f9c" /><span><strong style={{ color: '#001f9c' }}>PDAS Head / Director</strong> — Manage requests & operations</span></>}
              {activeFlow === 'campus_admin' && <><Landmark size={12} color="#1e3a8a" /><span><strong style={{ color: '#1e3a8a' }}>Approver</strong> — Final approval authority</span></>}
              {activeFlow === 'faculty_staff' && <><GraduationCap size={12} color="#b45309" /><span><strong style={{ color: '#b45309' }}>Faculty &amp; Staff</strong> — Submit and track facility requests</span></>}
              {activeFlow === 'maintenance' && <><Wrench size={12} color="#374151" /><span><strong style={{ color: '#374151' }}>Maintenance</strong> — PDAS Technical Personnel &amp; Field Staff</span></>}
            </div>
          </div>

          {/* ── Error Message ── */}
          {error && (
            <div className="auth-error-banner" style={{ margin: '0 0 12px 0', padding: '8px 12px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <div>{error}</div>
            </div>
          )}

          {/* ── Credentials Form ── */}
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label" htmlFor="login-email" style={{ fontSize: '12.5px', fontWeight: '600', color: '#1e293b', marginBottom: '4px', display: 'block' }}>
                Institutional Email
              </label>
              <div className="input-with-icon-wrapper" style={{ position: 'relative' }}>
                <Mail size={16} className="input-leading-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@isatu.edu.ph"
                  style={{ paddingLeft: '38px', height: '40px', borderRadius: '8px', fontSize: '13.5px', border: '1px solid #cbd5e1', width: '100%' }}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '10px' }}>
              <label className="form-label" htmlFor="login-password" style={{ fontSize: '12.5px', fontWeight: '600', color: '#1e293b', marginBottom: '4px', display: 'block' }}>
                Password
              </label>
              <div className="input-with-icon-wrapper" style={{ position: 'relative' }}>
                <Lock size={16} className="input-leading-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handlePasswordKeyDown}
                  onKeyUp={handlePasswordKeyDown}
                  placeholder="Enter password"
                  style={{ paddingLeft: '38px', paddingRight: '40px', height: '40px', borderRadius: '8px', fontSize: '13.5px', border: '1px solid #cbd5e1', width: '100%' }}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Caps Lock Warning Banner */}
              {isCapsLockOn && (
                <div style={{ marginTop: '4px', fontSize: '11.5px', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <AlertCircle size={12} />
                  <span>Caps Lock is ON</span>
                </div>
              )}
            </div>

            <div className="form-options-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <label className="custom-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#475569', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  className="custom-checkbox-input"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>

              <button
                type="button"
                className="forgot-link-btn"
                style={{ background: 'none', border: 'none', color: '#001f9c', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer' }}
                onClick={() => {
                  setForgotEmail(email);
                  setForgotSubmitted(false);
                  setForgotPassword('');
                  setForgotConfirmPassword('');
                  setForgotError('');
                  setShowForgotPass(false);
                  setShowForgotConfirmPass(false);
                  setIsForgotModalOpen(true);
                }}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              className="btn btn-primary login-submit-btn"
              style={{ ...getSubmitBtnStyle(), width: '100%', height: '42px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}
              disabled={isLoading}
            >
              {isLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="badge-dot" style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#ffffff', animation: 'spin 0.8s infinite linear' }}></div>
                  Signing in...
                </div>
              ) : (
                <>
                  <Lock size={15} />
                  Sign In
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* ── Register Secondary Outline Action ── */}
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setIsRegisterOpen(true)}
              style={{
                width: '100%',
                height: '38px',
                borderRadius: '8px',
                background: 'transparent',
                border: '1.5px solid #cbd5e1',
                color: '#001f9c',
                fontSize: '13px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#001f9c'; e.currentTarget.style.background = '#eff4ff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = 'transparent'; }}
            >
              <UserPlus size={15} />
              Create an account
            </button>
          </div>
        </div>
      </div>

      {/* ── Enhanced Forgot Password Recovery Modal ── */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title="Reset Account Password"
        maxWidth="460px"
      >
        {forgotSubmitted ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#ecfdf5',
              color: '#059669',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <CheckCircle2 size={32} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
              Password Reset Successful
            </h3>
            <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: '1.55', marginBottom: '22px' }}>
              Your password for <strong>{forgotEmail}</strong> has been updated. You can now sign in using your new credentials.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', height: '40px', borderRadius: '8px', background: '#001f9c', color: '#ffffff', fontWeight: '700', fontSize: '13.5px', border: 'none', cursor: 'pointer' }}
              onClick={() => {
                setIsForgotModalOpen(false);
                setPassword(forgotPassword);
                setEmail(forgotEmail);
              }}
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgotSubmit}>
            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5', marginBottom: '16px' }}>
              Enter your registered institutional email and create a new secure password.
            </p>

            {/* Email Field */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ fontSize: '12.5px', fontWeight: '600', color: '#1e293b', marginBottom: '4px', display: 'block' }}>
                Institutional Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="email"
                  className="form-input"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@isatu.edu.ph"
                  style={{ paddingLeft: '38px', height: '40px', borderRadius: '8px', fontSize: '13.5px', border: '1px solid #cbd5e1', width: '100%' }}
                  required
                />
              </div>
            </div>

            {/* New Password Field with Eye Toggle */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ fontSize: '12.5px', fontWeight: '600', color: '#1e293b', marginBottom: '4px', display: 'block' }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type={showForgotPass ? 'text' : 'password'}
                  className="form-input"
                  value={forgotPassword}
                  onChange={(e) => setForgotPassword(e.target.value)}
                  onKeyDown={handleForgotKeyDown}
                  onKeyUp={handleForgotKeyDown}
                  placeholder="At least 6 characters"
                  style={{ paddingLeft: '38px', paddingRight: '40px', height: '40px', borderRadius: '8px', fontSize: '13.5px', border: '1px solid #cbd5e1', width: '100%' }}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowForgotPass(!showForgotPass)}
                  aria-label={showForgotPass ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                >
                  {showForgotPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm New Password Field with Eye Toggle */}
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label className="form-label" style={{ fontSize: '12.5px', fontWeight: '600', color: '#1e293b', marginBottom: '4px', display: 'block' }}>
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type={showForgotConfirmPass ? 'text' : 'password'}
                  className="form-input"
                  value={forgotConfirmPassword}
                  onChange={(e) => setForgotConfirmPassword(e.target.value)}
                  onKeyDown={handleForgotKeyDown}
                  onKeyUp={handleForgotKeyDown}
                  placeholder="Re-type new password"
                  style={{ paddingLeft: '38px', paddingRight: '40px', height: '40px', borderRadius: '8px', fontSize: '13.5px', border: '1px solid #cbd5e1', width: '100%' }}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowForgotConfirmPass(!showForgotConfirmPass)}
                  aria-label={showForgotConfirmPass ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                >
                  {showForgotConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password Matching Feedback */}
              {forgotConfirmPassword && (
                <div style={{ marginTop: '6px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {forgotPassword === forgotConfirmPassword ? (
                    <span style={{ color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                      <CheckCircle2 size={13} /> Passwords match
                    </span>
                  ) : (
                    <span style={{ color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={13} /> Passwords do not match
                    </span>
                  )}
                </div>
              )}

              {/* Caps Lock Warning for Forgot Password */}
              {isForgotCapsLockOn && (
                <div style={{ marginTop: '4px', fontSize: '11.5px', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <AlertCircle size={12} />
                  <span>Caps Lock is ON</span>
                </div>
              )}
            </div>

            {/* Error Message */}
            {forgotError && (
              <div style={{ padding: '8px 12px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '12.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{forgotError}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, height: '40px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: '600', cursor: 'pointer' }}
                onClick={() => setIsForgotModalOpen(false)}
                disabled={isForgotSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2, height: '40px', borderRadius: '8px', background: '#001f9c', color: '#ffffff', fontWeight: '700', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                disabled={isForgotSubmitting}
              >
                {isForgotSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Registration Modal ── */}
      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSwitchToLogin={() => setIsRegisterOpen(false)}
      />
    </div>
  );
};
