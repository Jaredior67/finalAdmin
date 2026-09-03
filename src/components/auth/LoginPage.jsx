import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  UserPlus, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  Zap,
  CalendarCheck,
  Shield,
  Wrench,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Briefcase
} from 'lucide-react';
import { useAuth, TEST_PERSONAS } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { RegisterModal } from './RegisterModal';
import { Modal } from '../common/Modal';
import pdasLogo from '../../assets/fixit-logo.png';

export const LoginPage = () => {
  const { loginWithCredentials, resetPassword } = useAuth();
  const { requestPasswordChange } = useData();
  
  // Separate login flow active tab: 'admin' | 'faculty_staff' | 'maintenance'
  const [activeFlow, setActiveFlow] = useState('admin');

  // Sub-selected persona key within current flow
  const [selectedPersonaKey, setSelectedPersonaKey] = useState('admin');
  const [email, setEmail] = useState('pdas.director@dumangas.isatu.edu.ph');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotError, setForgotError] = useState('');

  // Carousel State
  const [currentSlide, setCurrentSlide] = useState(0);
  const carouselSlides = [
    {
      id: 0,
      icon: <Zap size={22} />,
      title: 'Facility Maintenance & Work Orders',
      subtitle: 'Submit, track, and manage physical infrastructure repairs in real-time across ISAT U Dumangas Campus.',
      tag: 'Real-Time Tracking'
    },
    {
      id: 1,
      icon: <CalendarCheck size={22} />,
      title: 'Preventive Maintenance Schedules',
      subtitle: 'Regular inspections for HVAC systems, electrical substations, plumbing, and laboratory amenities.',
      tag: 'Scheduled Inspections'
    },
    {
      id: 2,
      icon: <Wrench size={22} />,
      title: 'Technician Dispatch & Replacements',
      subtitle: 'Direct assignment to skilled technical personnel and quick flagging for irreparable equipment procurement.',
      tag: 'Field Operations'
    },
    {
      id: 3,
      icon: <ShieldCheck size={22} />,
      title: 'Official Records & Compliance',
      subtitle: 'Generate official PDF job orders, track approval histories, and audit campus facility operations.',
      tag: 'Institutional Records'
    }
  ];

  // Carousel Auto-Play Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % carouselSlides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [carouselSlides.length]);

  const handleNextSlide = () => {
    setCurrentSlide(prev => (prev + 1) % carouselSlides.length);
  };

  const handlePrevSlide = () => {
    setCurrentSlide(prev => (prev - 1 + carouselSlides.length) % carouselSlides.length);
  };

  // Switch Login Flow (Admin, Faculty & Staff, Maintenance)
  const handleSelectFlow = (flowType) => {
    setActiveFlow(flowType);
    setError('');
    
    if (flowType === 'admin') {
      const p = TEST_PERSONAS.find(item => item.key === 'admin');
      setSelectedPersonaKey('admin');
      setEmail(p?.email || 'pdas.director@dumangas.isatu.edu.ph');
      setPassword(p?.password || 'admin123');
    } else if (flowType === 'faculty_staff') {
      const p = TEST_PERSONAS.find(item => item.key === 'faculty');
      setSelectedPersonaKey('faculty');
      setEmail(p?.email || 'elena.ramos.isatu@gmail.com');
      setPassword(p?.password || 'faculty123');
    } else if (flowType === 'maintenance') {
      const p = TEST_PERSONAS.find(item => item.key === 'maintenance');
      setSelectedPersonaKey('maintenance');
      setEmail(p?.email || 'mark.villanueva.isatu@gmail.com');
      setPassword(p?.password || 'tech123');
    }
  };

  const handleSelectPersona = (persona) => {
    setSelectedPersonaKey(persona.key);
    setEmail(persona.email);
    setPassword(persona.password);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please provide your institutional email address.');
      return;
    }
    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    setIsLoading(true);
    setError('');

    setTimeout(() => {
      const res = loginWithCredentials(email, password);
      setIsLoading(false);
      if (!res.success) {
        setError(res.error || 'Authentication failed. Please verify your credentials.');
      }
    }, 350);
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    setForgotError('');
    if (forgotPassword.length < 6) {
      setForgotError('Password must contain at least 6 characters.');
      return;
    }
    if (forgotPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }
    const result = resetPassword(forgotEmail, forgotPassword);
    if (!result.success) {
      setForgotError(result.error);
      return;
    }
    requestPasswordChange(forgotEmail);
    setForgotSubmitted(true);
  };

  return (
    <div className="login-page-root">
      <div className="login-desktop-shell">
        
        {/* Left Desktop Brand Hero Panel with Image & Carousel */}
        <div className="login-desktop-hero">
          <div className="login-desktop-hero-top">
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <div className="login-logo-glow-wrapper" style={{ marginBottom: '4px' }}>
                <img 
                  src={pdasLogo} 
                  alt="Official Logo" 
                  className="login-desktop-hero-logo"
                  onError={(e) => {
                    e.target.src = '/fixit-logo.png';
                  }}
                />
              </div>
              
              <div className="login-desktop-brand-text" style={{ textAlign: 'center', marginTop: '2px', marginBottom: '8px' }}>
                <div className="login-desktop-campus-name">
                  ILOILO SCIENCE AND TECHNOLOGY UNIVERSITY
                </div>
                <div className="login-desktop-campus-sub">
                  DUMANGAS CAMPUS
                </div>
              </div>
            </div>

            {/* Interactive Feature Highlights Carousel */}
            <div className="login-carousel-box">
              <div className="carousel-slide-content">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span className="carousel-tag">
                    {carouselSlides[currentSlide].tag}
                  </span>
                  <div className="carousel-nav-arrows">
                    <button type="button" onClick={handlePrevSlide} className="carousel-arrow-btn" aria-label="Previous slide">
                      <ChevronLeft size={15} />
                    </button>
                    <button type="button" onClick={handleNextSlide} className="carousel-arrow-btn" aria-label="Next slide">
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div className="feature-item-icon">
                    {carouselSlides[currentSlide].icon}
                  </div>
                  <h4 style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff', margin: 0 }}>
                    {carouselSlides[currentSlide].title}
                  </h4>
                </div>

                <p style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: '1.5', margin: 0 }}>
                  {carouselSlides[currentSlide].subtitle}
                </p>
              </div>

              {/* Carousel Pagination Indicator Dots */}
              <div className="carousel-dots-wrapper">
                {carouselSlides.map(slide => (
                  <button
                    key={slide.id}
                    type="button"
                    className={`carousel-dot ${currentSlide === slide.id ? 'active' : ''}`}
                    onClick={() => setCurrentSlide(slide.id)}
                    aria-label={`Go to slide ${slide.id + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="login-desktop-hero-footer">
            <Shield size={14} color="#f59e0b" />
            <span>ISAT U DUMANGAS CAMPUS 2026</span>
          </div>
        </div>

        {/* Right Desktop Authentication Console */}
        <div className="login-desktop-form-panel">
          <div className="login-form-header">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="pdas-admin-chip">
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#001f9c' }}></span>
                PDAS Campus Access
              </span>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                ISAT U Dumangas
              </span>
            </div>
            <h2 className="login-form-title">Account Sign In</h2>
            <p className="login-form-subtitle">
              Select your portal flow and log in with your institutional credentials
            </p>
          </div>

          {/* Separate Login Flows Segmented Control (Admin / Faculty & Staff / Maintenance) */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '800',
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '8px'
            }}>
              Select Login Flow
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '6px',
              background: '#f1f5f9',
              padding: '4px',
              borderRadius: '12px'
            }}>
              <button
                type="button"
                onClick={() => handleSelectFlow('admin')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '9px 6px',
                  borderRadius: '9px',
                  border: 'none',
                  background: activeFlow === 'admin' ? '#001f9c' : 'transparent',
                  color: activeFlow === 'admin' ? '#ffffff' : '#475569',
                  fontWeight: activeFlow === 'admin' ? '800' : '600',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <Shield size={14} />
                Admin
              </button>

              <button
                type="button"
                onClick={() => handleSelectFlow('faculty_staff')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '9px 6px',
                  borderRadius: '9px',
                  border: 'none',
                  background: activeFlow === 'faculty_staff' ? '#001f9c' : 'transparent',
                  color: activeFlow === 'faculty_staff' ? '#ffffff' : '#475569',
                  fontWeight: activeFlow === 'faculty_staff' ? '800' : '600',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <GraduationCap size={14} />
                Faculty & Staff
              </button>

              <button
                type="button"
                onClick={() => handleSelectFlow('maintenance')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '9px 6px',
                  borderRadius: '9px',
                  border: 'none',
                  background: activeFlow === 'maintenance' ? '#d97706' : 'transparent',
                  color: activeFlow === 'maintenance' ? '#ffffff' : '#475569',
                  fontWeight: activeFlow === 'maintenance' ? '800' : '600',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                <Wrench size={14} />
                Maintenance
              </button>
            </div>
          </div>

          {/* Sub-Persona Choice for Faculty & Staff */}
          {activeFlow === 'faculty_staff' && (
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '16px',
              background: '#eff6ff',
              padding: '8px 10px',
              borderRadius: '10px',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#1e40af' }}>
                Account Type:
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => handleSelectPersona(TEST_PERSONAS.find(p => p.key === 'faculty'))}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: selectedPersonaKey === 'faculty' ? '800' : '600',
                    border: 'none',
                    background: selectedPersonaKey === 'faculty' ? '#001f9c' : '#ffffff',
                    color: selectedPersonaKey === 'faculty' ? '#ffffff' : '#1e293b',
                    cursor: 'pointer'
                  }}
                >
                  🎓 Faculty Requisitioner
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPersona(TEST_PERSONAS.find(p => p.key === 'staff'))}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: selectedPersonaKey === 'staff' ? '800' : '600',
                    border: 'none',
                    background: selectedPersonaKey === 'staff' ? '#001f9c' : '#ffffff',
                    color: selectedPersonaKey === 'staff' ? '#ffffff' : '#1e293b',
                    cursor: 'pointer'
                  }}
                >
                  💼 Staff / Custodian
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="auth-error-banner">
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>{error}</div>
            </div>
          )}

          {/* Credentials Form */}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">
                Institutional Email Address
              </label>
              <div className="input-with-icon-wrapper">
                <Mail size={17} className="input-leading-icon" />
                <input
                  id="login-email"
                  type="text"
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. user@dumangas.isatu.edu.ph"
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '8px' }}>
              <label className="form-label" htmlFor="login-password">
                Password / Security PIN
              </label>
              <div className="input-with-icon-wrapper">
                <Lock size={17} className="input-leading-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div className="form-options-row">
              <label className="custom-checkbox-label">
                <input
                  type="checkbox"
                  className="custom-checkbox-input"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember this workstation</span>
              </label>

              <button
                type="button"
                className="forgot-link-btn"
                onClick={() => {
                  setForgotEmail(email);
                  setForgotSubmitted(false);
                  setForgotPassword('');
                  setForgotConfirmPassword('');
                  setForgotError('');
                  setIsForgotModalOpen(true);
                }}
              >
                Forgot PIN?
              </button>
            </div>

            <button
              type="submit"
              className="btn btn-primary login-submit-btn"
              style={{
                background: activeFlow === 'maintenance' ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' : undefined
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="badge-dot" style={{ background: '#ffffff', animation: 'spin 1s infinite linear' }}></div>
                  Authenticating...
                </div>
              ) : (
                <>
                  <Lock size={16} />
                  Sign In to PDAS Portal
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Register Prompt Callout */}
          <div className="login-register-callout">
            <div style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '8px' }}>
              Need a campus account or faculty access?
            </div>
            <button
              type="button"
              className="register-prompt-btn"
              onClick={() => setIsRegisterOpen(true)}
            >
              <UserPlus size={16} />
              Register Account & Submit Institutional ID
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password / PIN Recovery Modal */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title="Account Recovery & PIN Reset"
        maxWidth="460px"
      >
        {forgotSubmitted ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: '#ecfdf5',
              color: '#059669',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '14px'
            }}>
              <CheckCircle2 size={30} />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
              Reset Link Dispatched
            </h3>
            <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: '1.5', marginBottom: '20px' }}>
              A security verification link has been sent to <strong>{forgotEmail}</strong>. Please check your ISAT U institutional mailbox.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => setIsForgotModalOpen(false)}
            >
              Return to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgotSubmit}>
            <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: '1.5', marginBottom: '16px' }}>
              Enter your registered institutional email to receive password reset instructions.
            </p>
            <div className="form-group">
              <label className="form-label">Registered Institutional Email</label>
              <input
                type="email"
                className="form-input"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="e.g. user@dumangas.isatu.edu.ph"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">New password</label>
              <input type="password" className="form-input" value={forgotPassword} onChange={(e) => setForgotPassword(e.target.value)} required minLength={6} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm new password</label>
              <input type="password" className="form-input" value={forgotConfirmPassword} onChange={(e) => setForgotConfirmPassword(e.target.value)} required minLength={6} />
            </div>
            {forgotError && <p style={{ color: '#dc2626', fontSize: '13px', marginTop: '10px' }}>{forgotError}</p>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setIsForgotModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2 }}
              >
                Send Reset Link
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Registration Modal */}
      <RegisterModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSwitchToLogin={() => setIsRegisterOpen(false)}
      />
    </div>
  );
};
