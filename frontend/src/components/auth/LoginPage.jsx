import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  KeyRound,
  X,
  MapPin
} from 'lucide-react';
import { useAuth, TEST_PERSONAS } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Modal } from '../common/Modal';
import { getPendingScannedQr, resolveLocationFromQr } from '../../utils/qrLocationResolver';
import fixitLogo from '../../assets/fixit-logo-white.png';
import './FixitLogin.css';

export const LoginPage = () => {
  const { loginWithCredentials, requestPasswordReset, verifyResetCode, verifyAndResetPassword } = useAuth();
  const { requestPasswordChange, sendContactInquiry } = useData();

  // Active view: 'home' | 'about' | 'services' | 'contact' | 'login'
  const [currentView, setCurrentView] = useState('login');
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [scannedRoom, setScannedRoom] = useState(null);

  useEffect(() => {
    const raw = getPendingScannedQr();
    if (raw) {
      const hit = resolveLocationFromQr(raw);
      if (hit) {
        setScannedRoom(hit);
      }
    }
  }, []);

  // Parallax ref
  const parRef = useRef(null);

  // Email pre-fills ONLY if the user previously checked "Remember Me" and
  // successfully logged in. It must never default to a test/demo account.
  const [email, setEmail] = useState(
    () => localStorage.getItem('fixit_pdas_remembered_login_v1') || ''
  );
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => Boolean(localStorage.getItem('fixit_pdas_remembered_login_v1')));
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [pwError, setPwError] = useState(false);

  // Forgot password security authentication state (Gmail OTP)
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState('email'); // 'email' | 'otp' | 'success'
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotPass, setShowForgotPass] = useState(false);
  const [showForgotConfirmPass, setShowForgotConfirmPass] = useState(false);
  const [isForgotCapsLockOn, setIsForgotCapsLockOn] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotNotice, setForgotNotice] = useState('');
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);
  const [forgotCooldown, setForgotCooldown] = useState(0);

  // Resend OTP countdown timer
  useEffect(() => {
    let timer = null;
    if (forgotCooldown > 0) {
      timer = setInterval(() => {
        setForgotCooldown(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [forgotCooldown]);

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSent, setContactSent] = useState(false);
  const [isContactSubmitting, setIsContactSubmitting] = useState(false);

  // Subtle background mouse parallax (without 3D card tilt)
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !window.matchMedia('(hover: hover)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const handleMouseMove = (e) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      if (parRef.current) {
        parRef.current.style.setProperty('--px', `${-x * 14}px`);
        parRef.current.style.setProperty('--py', `${-y * 10}px`);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Escape key returns to 'home' when card is open
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && currentView === 'login') {
        setCurrentView('home');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView]);

  const switchView = (v) => {
    setCurrentView(v);
    setIsNavOpen(false);
    // Jump to the top with the view change. Smooth scrolling here made the
    // new section look like it was catching up to the click.
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2200);
  };

  const handleCopy = (text) => {
    try {
      navigator.clipboard.writeText(text);
    } catch {}
    showToast(`Copied ${text}`);
  };

  const handlePasswordKeyDown = (e) => {
    if (e.getModifierState) setIsCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleForgotKeyDown = (e) => {
    if (e.getModifierState) setIsForgotCapsLockOn(e.getModifierState('CapsLock'));
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    const cleanEmail = email.trim();
    const badEmail = !cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail);
    const shortPw = password.length < 6;

    setEmailError(badEmail);
    setPwError(!badEmail && shortPw);

    if (badEmail || shortPw) {
      setError(badEmail ? 'Enter your email address.' : 'Password must be at least 6 characters.');
      triggerShake();
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      // Auto-detect role if known via persona mapping, otherwise send 'auto'
      let detectedRole = 'auto';
      const persona = TEST_PERSONAS.find(p => p.email.toLowerCase() === cleanEmail.toLowerCase());
      if (persona) {
        const keyMap = {
          superadmin: 'superadmin',
          admin: 'admin',
          campus_admin: 'campus_admin',
          faculty: 'faculty_staff',
          staff: 'faculty_staff',
          maintenance: 'maintenance',
        };
        detectedRole = keyMap[persona.key] || 'faculty_staff';
      }

      const res = await loginWithCredentials(cleanEmail, password, detectedRole);
      if (!res.success) {
        const msg = res.error || '';
        if (
          msg.toLowerCase().includes('cannot reach') ||
          msg.toLowerCase().includes('failed to fetch') ||
          msg.toLowerCase().includes('networkerror') ||
          msg.toLowerCase().includes('not reachable')
        ) {
          setError('The server is not running. Please check your backend connection.');
        } else {
          setError(msg || 'Invalid email or password.');
        }
        triggerShake();
      } else if (rememberMe) {
        localStorage.setItem('fixit_pdas_remembered_login_v1', cleanEmail);
      } else {
        localStorage.removeItem('fixit_pdas_remembered_login_v1');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestOtp = async (e) => {
    e?.preventDefault();
    setForgotError('');
    setForgotNotice('');
    const clean = forgotEmail.trim().toLowerCase();
    if (!clean || !/^\S+@\S+\.\S+$/.test(clean)) {
      setForgotError('Please enter a valid email address.');
      return;
    }

    setIsForgotSubmitting(true);
    const res = await requestPasswordReset(clean);
    setIsForgotSubmitting(false);

    if (!res.success) {
      setForgotError(res.error || 'Failed to dispatch verification code. Please try again.');
      return;
    }

    setForgotNotice(`✓ Verification code sent to ${clean}. Please check your Gmail inbox and spam folder.`);
    setForgotStep('otp');
    setForgotCooldown(60);
  };

  const handleResendOtp = async () => {
    if (forgotCooldown > 0 || isForgotSubmitting) return;
    setForgotError('');
    setForgotNotice('');
    setIsForgotSubmitting(true);
    const res = await requestPasswordReset(forgotEmail.trim().toLowerCase());
    setIsForgotSubmitting(false);

    if (!res.success) {
      setForgotError(res.error || 'Failed to resend code.');
      return;
    }

    setForgotNotice(`✓ A new verification code has been sent to ${forgotEmail}.`);
    setForgotCooldown(60);
  };

  const handleVerifyOtpCode = async (e) => {
    e?.preventDefault();
    setForgotError('');
    setForgotNotice('');

    const cleanOtp = forgotOtp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setForgotError('Please enter the 6-digit verification code.');
      return;
    }

    setIsForgotSubmitting(true);
    const res = await verifyResetCode(forgotEmail.trim().toLowerCase(), cleanOtp);
    setIsForgotSubmitting(false);

    if (!res.success) {
      setForgotError(res.error || 'Incorrect verification code. Please check your Gmail.');
      return;
    }

    // Code verified! Now advance to Step 3: create new password
    setForgotNotice('✓ Verification code confirmed! Please create your new secure password.');
    setForgotStep('newPassword');
  };

  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotNotice('');

    const cleanOtp = forgotOtp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setForgotError('Verification session invalid. Please re-enter your code.');
      setForgotStep('otp');
      return;
    }

    if (forgotPassword.length < 8 || !/[A-Za-z]/.test(forgotPassword) || !/[0-9]/.test(forgotPassword)) {
      setForgotError('Password must be at least 8 characters long and include both letters and numbers.');
      return;
    }

    if (forgotPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match. Please verify both fields.');
      return;
    }

    setIsForgotSubmitting(true);
    const res = await verifyAndResetPassword(forgotEmail.trim().toLowerCase(), cleanOtp, forgotPassword);
    setIsForgotSubmitting(false);

    if (!res.success) {
      setForgotError(res.error || 'Failed to update password. Please try again.');
      return;
    }

    setForgotStep('success');
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    const ok = contactName.trim() && /^\S+@\S+\.\S+$/.test(contactEmail) && contactMessage.trim();
    if (!ok) {
      showToast('Fill in your name, a valid email and a message.');
      return;
    }
    setIsContactSubmitting(true);
    try {
      if (sendContactInquiry) {
        await sendContactInquiry({
          name: contactName.trim(),
          email: contactEmail.trim(),
          message: contactMessage.trim()
        });
      }
      setContactSent(true);
      showToast('Your message has been sent to the System Administrator.');
    } catch (err) {
      console.error('Contact submission error:', err);
      showToast(err?.message || 'Failed to send message. Please try again.');
    } finally {
      setIsContactSubmitting(false);
    }
  };

  return (
    <div className="fixit-landing-page">
      {/* Background layer with subtle institutional backdrop */}
      <div className="par" id="par" ref={parRef}>
        <div className="bg"></div>
      </div>
      <div className="veil"></div>

      {/* Header */}
      <header>
        <a className="logo" onClick={() => switchView('home')} aria-label="FixIT home">
          <img alt="FixIT" src={fixitLogo} />
        </a>
        <nav className={isNavOpen ? 'open' : ''}>
          <a
            className={currentView === 'home' ? 'on' : ''}
            onClick={() => switchView('home')}
          >
            Home
          </a>
          <a
            className={currentView === 'about' ? 'on' : ''}
            onClick={() => switchView('about')}
          >
            About
          </a>
          <a
            className={currentView === 'services' ? 'on' : ''}
            onClick={() => switchView('services')}
          >
            Services
          </a>
          <a
            className={currentView === 'contact' ? 'on' : ''}
            onClick={() => switchView('contact')}
          >
            Contact
          </a>
          <a
            className={`btn ${currentView === 'login' ? 'on' : ''}`}
            onClick={() => switchView('login')}
          >
            Login
          </a>
        </nav>
        <button
          className="burger"
          aria-label="Toggle Navigation Menu"
          onClick={() => setIsNavOpen(prev => !prev)}
        >
          <svg viewBox="0 0 24 24">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </header>

      {/* Main Views Container */}
      <main data-v={currentView}>
        {/* View: Home */}
        <section className="view hero" hidden={currentView !== 'home'}>
          <h2>Report it. Track it. Get it fixed.</h2>
          <p>FixIT is the facility issue tracker of ISAT U Dumangas Campus. Log a concern, follow its approval, and see when maintenance closes it.</p>
          <div className="cta">
            <a className="b1" onClick={() => switchView('login')}>Log in</a>
            <a className="b2" onClick={() => switchView('services')}>See what FixIT does</a>
          </div>
          <ol className="flow">
            <li><b>Report</b>Faculty and staff file a facility concern.</li>
            <li><b>Approve</b>An approver reviews and prioritizes it.</li>
            <li><b>Repair</b>Maintenance gets the job and updates progress.</li>
            <li><b>Close</b>Everyone sees the result in the history.</li>
          </ol>
        </section>

        {/* View: About */}
        <section className="view glass" hidden={currentView !== 'about'}>
          <h2>About FixIT</h2>
          <p className="lead">FixIT (Facility Issue eXpress and Integrated Tracking System) replaces scattered messages and paper slips with one tracked request for every facility concern on campus. It is run with the Planning, Development, and Auxiliary Services office of ISAT U Dumangas Campus.</p>
          <h3>Who uses it</h3>
          <div className="grid">
            <div className="item"><b>Faculty and staff</b><span>Report broken, unsafe or missing facilities and follow the status.</span></div>
            <div className="item"><b>Approvers</b><span>Review requests, set priority and release them for repair.</span></div>
            <div className="item"><b>Maintenance</b><span>Receive assigned jobs, update progress and mark work done.</span></div>
            <div className="item"><b>Administrators</b><span>Manage accounts, facilities and campus-wide reports.</span></div>
          </div>
        </section>

        {/* View: Services */}
        <section className="view glass" hidden={currentView !== 'services'}>
          <h2>Services</h2>
          <p className="lead">Everything a facility request needs, from the first report to the final record.</p>
          <div className="grid">
            <div className="item"><b>Issue reporting</b><span>File a concern with location, details and a photo in a minute.</span></div>
            <div className="item"><b>Live status tracking</b><span>See whether a request is pending, approved, assigned or done.</span></div>
            <div className="item"><b>Approval workflow</b><span>Requests reach the right approver before work begins.</span></div>
            <div className="item"><b>Job assignment</b><span>Maintenance staff are assigned and can report progress.</span></div>
            <div className="item"><b>Notifications</b><span>Get alerts when your request changes status.</span></div>
            <div className="item"><b>Reports and history</b><span>Review past repairs by building, room or date.</span></div>
          </div>
        </section>

        {/* View: Contact */}
        <section className="view glass" hidden={currentView !== 'contact'}>
          <h2>Contact us</h2>
          <p className="lead">Questions about your account or a request? Reach the FixIT team through any channel below.</p>
          <div className="cols">
            <div className="chs">
              <a className="ch" href="https://facebook.com" target="_blank" rel="noopener noreferrer">
                <span className="ic"><svg viewBox="0 0 24 24"><path d="M14 8h3V4.5h-3A4.5 4.5 0 0 0 9.5 9v2H7v3.5h2.5V21H13v-6.5h3l.5-3.5H13V9a1 1 0 0 1 1-1Z"/></svg></span>
                <span><small>Facebook</small><b>FixIT ISAT U DC</b></span>
              </a>
              <a className="ch" href="https://instagram.com" target="_blank" rel="noopener noreferrer">
                <span className="ic"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/></svg></span>
                <span><small>Instagram</small><b>@fixitdc</b></span>
              </a>
              <button className="ch" type="button" onClick={() => handleCopy('fixit@isatu.edu.ph')}>
                <span className="ic"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg></span>
                <span><small>Email (tap to copy)</small><b>fixit@isatu.edu.ph</b></span>
              </button>
              <button className="ch" type="button" onClick={() => handleCopy('(033) 000-0000')}>
                <span className="ic"><svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/></svg></span>
                <span><small>Phone (tap to copy)</small><b>(033) 000-0000</b></span>
              </button>
              <div className="ch">
                <span className="ic"><svg viewBox="0 0 24 24"><path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg></span>
                <span><small>Office</small><b>Planning, Development, and Auxiliary Services, ISAT U Dumangas Campus</b></span>
              </div>
              <div className="ch">
                <span className="ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>
                <span><small>Office hours</small><b>Monday to Friday, 8:00 AM to 5:00 PM</b></span>
              </div>
            </div>
            <div className={`cf ${contactSent ? 'sent' : ''}`}>
              <form onSubmit={handleContactSubmit} noValidate>
                <h3 style={{ marginTop: 0 }}>Send a message</h3>
                <input
                  placeholder="Your name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  autoComplete="name"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  autoComplete="email"
                />
                <textarea
                  placeholder="How can we help?"
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                />
                <button className="go" type="submit" disabled={isContactSubmitting}>
                  {isContactSubmitting ? 'Sending...' : 'Send message'}
                </button>
              </form>
              <div className="ok">
                <b>Message sent</b>
                The FixIT team will reply to your email within two working days.
              </div>
            </div>
          </div>
        </section>

        {/* View: Glass Login Card */}
        <section
          className={`card ${currentView !== 'login' ? 'closed' : ''} ${isShaking ? 'shake' : ''}`}
          aria-labelledby="fixit-login-title"
        >
          <button
            className="x"
            type="button"
            onClick={() => switchView('home')}
            aria-label="Close login card"
          >
            <X size={18} />
          </button>

          <h1 id="fixit-login-title" style={{ '--i': 0 }}>Login</h1>
          <p className="campus" style={{ '--i': 1 }}>ISAT U Dumangas Campus</p>

          {scannedRoom && (
            <div style={{
              background: 'rgba(239, 246, 255, 0.95)',
              border: '1.5px solid #93c5fd',
              borderRadius: '10px',
              padding: '10px 12px',
              margin: '8px 0 14px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textAlign: 'left',
              boxShadow: '0 4px 12px rgba(0, 31, 156, 0.12)'
            }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: '#001f9c', color: '#ffffff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <MapPin size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '10px', fontWeight: '800', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  📍 Scanned Room Detected
                </div>
                <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {scannedRoom.building} — {scannedRoom.room}
                </div>
                <div style={{ fontSize: '11px', color: '#475569' }}>
                  Sign in to file your maintenance request for this location.
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ display: 'contents' }}>
            {/* Email Field with Floating Label */}
            <div className={`f ${emailError ? 'err' : ''} ${email ? 'active' : ''}`} style={{ '--i': 2 }}>
              <input
                id="login-em"
                type="email"
                placeholder=" "
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(false);
                  if (error) setError('');
                }}
                required
              />
              <label htmlFor="login-em">Email</label>
              <svg className="i" viewBox="0 0 24 24">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
            </div>

            {/* Password Field with Floating Label & Toggle */}
            <div className={`f ${pwError ? 'err' : ''} ${password ? 'active' : ''}`} style={{ '--i': 3 }}>
              <input
                id="login-pw"
                type={showPassword ? 'text' : 'password'}
                placeholder=" "
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (pwError) setPwError(false);
                  if (error) setError('');
                }}
                onKeyDown={handlePasswordKeyDown}
                onKeyUp={handlePasswordKeyDown}
                required
              />
              <label htmlFor="login-pw">Password</label>
              <svg className="i" viewBox="0 0 24 24">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              <button
                type="button"
                className="eye"
                onClick={() => setShowPassword(p => !p)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24">
                    <path d="M3 3l18 18M10.6 6.2A9.6 9.6 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 7.6A16.6 16.6 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 4-.9M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {/* Caps lock warning if active */}
            {isCapsLockOn && (
              <div className="caps-warn" role="alert">
                <AlertCircle size={13} />
                <span>Caps Lock is on</span>
              </div>
            )}

            {/* Error Message banner */}
            <div className={`msg ${error ? 'show' : ''}`} role="alert" style={{ '--i': 4 }}>
              {error}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="row" style={{ '--i': 4 }}>
              <label className="chk">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                Remember me
              </label>
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setForgotEmail(email || '');
                  setForgotStep('email');
                  setForgotOtp('');
                  setForgotPassword('');
                  setForgotConfirmPassword('');
                  setForgotError('');
                  setForgotNotice('');
                  setShowForgotPass(false);
                  setShowForgotConfirmPass(false);
                  setIsForgotModalOpen(true);
                }}
              >
                Forgot Password?
              </button>
            </div>

            {/* Submit Button with Loading Spinner */}
            <button
              className={`go ${isLoading ? 'load' : ''}`}
              type="submit"
              disabled={isLoading}
              style={{ '--i': 5 }}
            >
              <span className="t">Login</span>
              <span className="sp"></span>
            </button>

            {/* Sign-in help */}
            <p className="support-hint" style={{ '--i': 6 }}>
              Trouble signing in?{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => switchView('contact')}
              >
                Contact the PDAS office.
              </button>
            </p>
          </form>
        </section>
      </main>

      {/* Landing Toast */}
      <div className={`landing-toast ${toastMsg ? 'show' : ''}`}>
        {toastMsg}
      </div>

      {/* ── Forgot Password Modal (Gmail Security Authentication) ── */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title={
          forgotStep === 'success'
            ? 'Password Reset Complete'
            : forgotStep === 'newPassword'
            ? 'Create New Password'
            : forgotStep === 'otp'
            ? 'Verify Security Code'
            : 'Reset Password'
        }
        maxWidth="480px"
      >
        {forgotStep === 'success' ? (
          <div className="lp-reset-success" style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ color: '#16a34a', display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
              <CheckCircle2 size={44} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '19px', fontWeight: 700, color: '#0f172a' }}>
              Password Reset Successful
            </h3>
            <p style={{ margin: '0 0 20px', color: '#475569', fontSize: '14px', lineHeight: 1.6 }}>
              The password for <strong>{forgotEmail}</strong> has been successfully updated via Gmail security verification. You can now sign in with your new password.
            </p>
            <button
              type="button"
              className="go"
              style={{ width: '100%', marginTop: '8px' }}
              onClick={() => {
                setIsForgotModalOpen(false);
                setEmail(forgotEmail);
                setPassword(forgotPassword);
              }}
            >
              Sign In With New Password
            </button>
          </div>
        ) : forgotStep === 'newPassword' ? (
          <form onSubmit={handleSetNewPassword}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', lineHeight: 1.5 }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>✓ Identity verified! Please choose a new secure password for <strong>{forgotEmail}</strong>.</span>
            </div>

            {/* New Password */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#0f172a' }}>
                New Password *
              </label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #cbd5e1', borderRadius: '8px', padding: '9px 12px', background: '#fff' }}>
                <Lock size={16} color="#64748b" style={{ marginRight: '8px' }} />
                <input
                  type={showForgotPass ? 'text' : 'password'}
                  style={{ width: '100%', border: 'none', outline: 'none', fontSize: '14px', color: '#0f172a' }}
                  value={forgotPassword}
                  onChange={(e) => setForgotPassword(e.target.value)}
                  onKeyDown={handleForgotKeyDown}
                  onKeyUp={handleForgotKeyDown}
                  placeholder="Min. 8 characters with letters & numbers"
                  required
                  minLength={8}
                  autoFocus
                />
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  onClick={() => setShowForgotPass(!showForgotPass)}
                  aria-label={showForgotPass ? 'Hide password' : 'Show password'}
                >
                  {showForgotPass ? <EyeOff size={16} color="#6b7280" /> : <Eye size={16} color="#6b7280" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#0f172a' }}>
                Confirm New Password *
              </label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #cbd5e1', borderRadius: '8px', padding: '9px 12px', background: '#fff' }}>
                <Lock size={16} color="#64748b" style={{ marginRight: '8px' }} />
                <input
                  type={showForgotConfirmPass ? 'text' : 'password'}
                  style={{ width: '100%', border: 'none', outline: 'none', fontSize: '14px', color: '#0f172a' }}
                  value={forgotConfirmPassword}
                  onChange={(e) => setForgotConfirmPassword(e.target.value)}
                  onKeyDown={handleForgotKeyDown}
                  onKeyUp={handleForgotKeyDown}
                  placeholder="Re-type new password"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  onClick={() => setShowForgotConfirmPass(!showForgotConfirmPass)}
                  aria-label={showForgotConfirmPass ? 'Hide password' : 'Show password'}
                >
                  {showForgotConfirmPass ? <EyeOff size={16} color="#6b7280" /> : <Eye size={16} color="#6b7280" />}
                </button>
              </div>
              {forgotConfirmPassword && (
                <div style={{ fontSize: '12px', marginTop: '6px', color: forgotPassword === forgotConfirmPassword ? '#16a34a' : '#dc2626', fontWeight: 500 }}>
                  {forgotPassword === forgotConfirmPassword ? '✓ Passwords match' : '✕ Passwords do not match'}
                </div>
              )}
            </div>

            {forgotError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{forgotError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                type="button"
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 500, fontSize: '13px' }}
                onClick={() => setIsForgotModalOpen(false)}
                disabled={isForgotSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="go"
                style={{ height: '38px', padding: '0 20px', width: 'auto', fontSize: '14px' }}
                disabled={isForgotSubmitting}
              >
                {isForgotSubmitting ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </form>
        ) : forgotStep === 'otp' ? (
          <form onSubmit={handleVerifyOtpCode}>
            {forgotNotice && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', lineHeight: 1.5 }}>
                <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{forgotNotice}</span>
              </div>
            )}

            <p style={{ fontSize: '13.5px', color: '#475569', margin: '0 0 16px', lineHeight: 1.5 }}>
              Enter the 6-digit verification code sent to <strong>{forgotEmail}</strong>.
            </p>

            {/* 6-Digit Verification Code */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                  6-Digit Verification Code *
                </label>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '12px',
                    color: forgotCooldown > 0 ? '#94a3b8' : '#001f9c',
                    fontWeight: 600,
                    cursor: forgotCooldown > 0 ? 'default' : 'pointer',
                    padding: 0
                  }}
                  onClick={handleResendOtp}
                  disabled={forgotCooldown > 0 || isForgotSubmitting}
                >
                  {forgotCooldown > 0 ? `Resend code in ${forgotCooldown}s` : 'Resend Code'}
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #001f9c', borderRadius: '10px', padding: '12px 14px', background: '#f8faff' }}>
                <KeyRound size={20} color="#001f9c" style={{ marginRight: '12px', flexShrink: 0 }} />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  style={{
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    fontSize: '24px',
                    fontWeight: 800,
                    letterSpacing: '8px',
                    fontFamily: 'monospace',
                    background: 'transparent',
                    color: '#001f9c'
                  }}
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  required
                  autoFocus
                />
              </div>
            </div>

            {forgotError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{forgotError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
              <button
                type="button"
                style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '13px', color: '#475569', fontWeight: 600 }}
                onClick={() => {
                  setForgotStep('email');
                  setForgotError('');
                  setForgotNotice('');
                }}
                disabled={isForgotSubmitting}
              >
                ← Change Email
              </button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 500, fontSize: '13px' }}
                  onClick={() => setIsForgotModalOpen(false)}
                  disabled={isForgotSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="go"
                  style={{ height: '38px', padding: '0 20px', width: 'auto', fontSize: '14px' }}
                  disabled={isForgotSubmitting || forgotOtp.trim().length !== 6}
                >
                  {isForgotSubmitting ? 'Verifying…' : 'Verify Code'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRequestOtp}>
            <p style={{ fontSize: '14px', color: '#475569', margin: '0 0 16px', lineHeight: 1.6 }}>
              Enter your registered FixIT account email address. We will send a secure 6-digit verification code to authenticate your identity.
            </p>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#0f172a' }}>
                Registered Email Address *
              </label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #cbd5e1', borderRadius: '8px', padding: '9px 12px', background: '#fff' }}>
                <Mail size={16} color="#64748b" style={{ marginRight: '8px', flexShrink: 0 }} />
                <input
                  type="email"
                  style={{ width: '100%', border: 'none', outline: 'none', fontSize: '14px', color: '#0f172a' }}
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  required
                  autoFocus
                />
              </div>
            </div>

            {forgotError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{forgotError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                type="button"
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 500, fontSize: '13px' }}
                onClick={() => setIsForgotModalOpen(false)}
                disabled={isForgotSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="go"
                style={{ height: '38px', padding: '0 20px', width: 'auto', fontSize: '14px' }}
                disabled={isForgotSubmitting}
              >
                {isForgotSubmitting ? 'Sending Code…' : 'Send Verification Code'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default LoginPage;
