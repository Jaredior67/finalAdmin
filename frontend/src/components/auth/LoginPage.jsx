import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  UserPlus, 
  CheckCircle2, 
  KeyRound
} from 'lucide-react';
import { useAuth, TEST_PERSONAS } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { RegisterModal } from './RegisterModal';
import { Modal } from '../common/Modal';
import { Spinner } from '../ui/Spinner';
import { useToast } from '../ui/Toast';
// Use the official FixIT brand mark for the dedicated login experience so the
// signage, portal, and authenticated app all read as a single product family.
import fixitLogo from '../../assets/fixit-official-logo.png';

const ROLES = [
  { id: 'admin',         label: 'Administrator'  },
  { id: 'campus_admin',  label: 'Approver'       },
  { id: 'faculty_staff', label: 'Faculty/Staff'  },
  { id: 'maintenance',   label: 'Maintenance'    },
];

// Field-level messages are UI state only; the server response still lands in
// `error`. A shared empty object keeps clears free of new allocations.
const EMPTY_FIELD_ERRORS = { email: '', password: '' };

const ROLE_NAV_KEYS = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];

export const LoginPage = () => {
  const { loginWithCredentials, resetPassword } = useAuth();
  const { requestPasswordChange } = useData();
  
  const [activeFlow, setActiveFlow] = useState('admin');
  // Seed the sample institutional address so the field is not blank on first
  // load. Selecting a role already fills it, so this is the same value with the
  // initial click removed.
  const [email, setEmail] = useState(
    () => localStorage.getItem('fixit_pdas_remembered_login_v1')
      || TEST_PERSONAS.find(item => item.key === 'admin')?.email
      || ''
  );
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => Boolean(localStorage.getItem('fixit_pdas_remembered_login_v1')));
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [fieldErrors, setFieldErrors] = useState(EMPTY_FIELD_ERRORS);

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotPass, setShowForgotPass] = useState(false);
  const [showForgotConfirmPass, setShowForgotConfirmPass] = useState(false);
  const [isForgotCapsLockOn, setIsForgotCapsLockOn] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  const handlePasswordKeyDown = (e) => {
    if (e.getModifierState) setIsCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleForgotKeyDown = (e) => {
    if (e.getModifierState) setIsForgotCapsLockOn(e.getModifierState('CapsLock'));
  };

  /* Roving-tabindex radiogroup keyboard model: exactly one radio is tabbable
     and the arrow keys both move focus and commit the selection, so the group
     behaves identically for keyboard, mouse and screen-reader users. Home/End
     jump to the ends. Focus is re-pointed after state settles so the newly
     checked radio takes the tab stop. */
  const handleRoleKeyDown = (e) => {
    if (!ROLE_NAV_KEYS.includes(e.key)) return;
    const radios = Array.from(e.currentTarget.querySelectorAll('[role="radio"]'));
    if (!radios.length) return;
    e.preventDefault();
    const current = radios.findIndex((el) => el.getAttribute('aria-checked') === 'true');
    let next = current;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1) % radios.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (current - 1 + radios.length) % radios.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = radios.length - 1;
    if (next === current) return;
    handleSelectFlow(ROLES[next].id);
    requestAnimationFrame(() => radios[next]?.focus());
  };

  const handleSelectFlow = (flowType) => {
    setActiveFlow(flowType);
    setError('');
    setFieldErrors(EMPTY_FIELD_ERRORS);
    setPassword('');
    const keyMap = {
      admin: 'admin',
      campus_admin: 'campus_admin',
      faculty_staff: 'faculty',
      maintenance: 'maintenance',
    };
    const p = TEST_PERSONAS.find(item => item.key === keyMap[flowType]);
    setEmail(p?.email || '');
  };

  /* Joins only the ids that are actually rendered, so aria-describedby never
     points at a node the current state has removed. */
  const joinIds = (...ids) => ids.filter(Boolean).join(' ') || undefined;

  const handleSubmit = (e) => {
    e.preventDefault();
    // The button also carries disabled={isLoading}, but that only takes effect
    // after a re-render; this closes the same-tick double submit outright.
    if (isLoading) return;
    const cleanEmail = email.trim();
    const nextFieldErrors = { email: '', password: '' };
    if (!cleanEmail) nextFieldErrors.email = 'Please enter your institutional email address.';
    if (!password)   nextFieldErrors.password = 'Please enter your account password.';
    // Client-side misses are shown against the offending field; only a failed
    // round trip reaches the live banner below the fields.
    if (nextFieldErrors.email || nextFieldErrors.password) {
      setFieldErrors(nextFieldErrors);
      return;
    }
    setFieldErrors(EMPTY_FIELD_ERRORS);
    setIsLoading(true);
    setError('');
    (async () => {
      try {
        const res = await loginWithCredentials(cleanEmail, password, activeFlow);
        if (!res.success) {
          const msg = res.error || '';
          if (
            msg.toLowerCase().includes('cannot reach') ||
            msg.toLowerCase().includes('failed to fetch') ||
            msg.toLowerCase().includes('networkerror') ||
            msg.toLowerCase().includes('not reachable')
          ) {
            setError('The server is not running. Double-click start-dev.bat in the project folder, then try again.');
          } else {
            setError(msg || 'Incorrect email or password. Please check your credentials.');
          }
        } else if (rememberMe) {
          localStorage.setItem('fixit_pdas_remembered_login_v1', cleanEmail);
        } else {
          localStorage.removeItem('fixit_pdas_remembered_login_v1');
        }
      } finally {
        setIsLoading(false);
      }
    })();
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    if (!forgotEmail.trim()) { setForgotError('Please enter your registered institutional email.'); return; }
    if (forgotPassword.length < 6) { setForgotError('Password must contain at least 6 characters.'); return; }
    if (forgotPassword !== forgotConfirmPassword) { setForgotError('Passwords do not match. Please verify both fields.'); return; }
    setIsForgotSubmitting(true);
    const result = await resetPassword(forgotEmail.trim(), forgotPassword);
    setIsForgotSubmitting(false);
    if (!result.success) { setForgotError(result.error || 'Failed to reset password. Please try again.'); return; }
    requestPasswordChange(forgotEmail.trim());
    setForgotSubmitted(true);
  };

  return (
    <div className="lp-root">

      {/* ── Left brand panel ────────────────────────────────────────────
          The mark and system name stay centred above the footer. */}
      <aside className="lp-brand">
        <div className="lp-brand-mid">
          <img src={fixitLogo} alt="FixIT logo" className="lp-brand-mark" />

          <p className="lp-brand-portal">Facility Issue eXpress and Integrated Tracking System</p>
        </div>

        <footer className="lp-brand-footer">Planning, Development, and Auxiliary Services</footer>
      </aside>

      {/* ── Right form panel ── */}
      <main className="lp-form-panel">
        <div className="lp-form-wrap">

          {/* Stand-in for the navy panel once it is hidden below 900px, so the
              mark still sits on the same axis as the form column. */}
          <div className="lp-compact-brand">
            <img src={fixitLogo} alt="FixIT logo" className="lp-compact-mark" />
          </div>

          {/* Heading */}
          <div className="lp-form-head">
            <p className="lp-eyebrow">ISAT U Dumangas Campus</p>
            <h1 className="lp-form-title">Sign in</h1>
            <p className="lp-form-subtitle">Choose your role and enter your credentials.</p>
          </div>

          {/* Role selector.
              A radiogroup is the correct pattern for mutually exclusive
              choices: one tab stop for the whole group, arrow keys to move and
              select, Home/End to jump. Roving tabindex lives on aria-checked so
              only the checked radio is reachable with Tab. Selection still
              routes through handleSelectFlow, so persona seeding and the
              password clear behave exactly as before. */}
          <div className="lp-role-section">
            <span className="lp-role-label" id="lp-role-label">Sign in as</span>
            <div
              className="lp-role-tabs"
              role="radiogroup"
              aria-labelledby="lp-role-label"
              onKeyDown={handleRoleKeyDown}
            >
              {ROLES.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  role="radio"
                  aria-checked={activeFlow === role.id}
                  tabIndex={activeFlow === role.id ? 0 : -1}
                  className={`lp-role-tab${activeFlow === role.id ? ' lp-role-tab--active' : ''}`}
                  onClick={() => handleSelectFlow(role.id)}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>

          {/* Credentials Form. The live region lives inside the form directly
              above the submit button so the announcement sits where the user
              is looking, and it persists so inserting a message is announced. */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="lp-field">
              <label className="lp-label" htmlFor="login-email">Institutional email</label>
              <div className="lp-input-wrap">
                <Mail size={15} className="lp-input-icon" aria-hidden="true" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  className="lp-input"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: '' }));
                  }}
                  placeholder="name@isatu.edu.ph"
                  aria-invalid={fieldErrors.email ? true : undefined}
                  aria-describedby={joinIds(fieldErrors.email && 'login-email-error', error && 'login-status')}
                  required
                />
              </div>
              {fieldErrors.email && (
                <p className="lp-field-error" id="login-email-error">{fieldErrors.email}</p>
              )}
            </div>

            <div className="lp-field">
              <label className="lp-label" htmlFor="login-password">Password</label>
              <div className="lp-input-wrap">
                <Lock size={15} className="lp-input-icon" aria-hidden="true" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="lp-input lp-input--pw"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: '' }));
                  }}
                  onKeyDown={handlePasswordKeyDown}
                  onKeyUp={handlePasswordKeyDown}
                  placeholder="Enter password"
                  aria-invalid={fieldErrors.password ? true : undefined}
                  aria-describedby={joinIds(
                    fieldErrors.password && 'login-password-error',
                    isCapsLockOn && 'lp-capslock',
                    error && 'login-status',
                  )}
                  required
                />
                <button
                  type="button"
                  className="lp-eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="lp-field-error" id="login-password-error">{fieldErrors.password}</p>
              )}
              {isCapsLockOn && (
                <div className="lp-capslock-warn" id="lp-capslock">
                  <AlertCircle size={12} aria-hidden="true" />
                  <span>Caps Lock is on</span>
                </div>
              )}
            </div>

            <div className="lp-options-row">
              <label className="lp-checkbox-label" htmlFor="login-remember">
                <input
                  id="login-remember"
                  type="checkbox"
                  className="lp-checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                className="lp-forgot-btn"
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

            {/* Failed logins only — field-level messages sit under their own
                input. The wrapper is always mounted so the polite live region
                exists before a message arrives, which is what makes the
                insertion announced instead of the region itself. */}
            <div className="lp-error-slot" aria-live="polite">
              {error && (
                <div className="lp-error-banner" id="login-status">
                  <AlertCircle size={15} className="lp-error-icon" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <button type="submit" className="lp-submit-btn" disabled={isLoading}>
              {isLoading ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Spinner size={18} color="#ffffff" />
                  <span>Signing in…</span>
                </div>
              ) : (
                'Sign in'
              )}
            </button>
            {/* A submit button inside a form triggers on Enter, but a pointer
                click on a disabled button must not be swallowed silently —
                during the round trip the label already reads "Signing in…". */}
          </form>

          {/* Register — clearly secondary: outlined, below a labelled rule */}
          <div className="lp-register-wrap">
            <div className="lp-divider-label">
              <span>New to the portal?</span>
            </div>
            <button
              type="button"
              className="lp-register-btn"
              onClick={() => setIsRegisterOpen(true)}
            >
              <UserPlus size={14} aria-hidden="true" />
              Create an account
            </button>
          </div>

        </div>
      </main>

      {/* ── Forgot Password Modal ── */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title="Reset Account Password"
        maxWidth="460px"
      >
        {forgotSubmitted ? (
          <div className="lp-reset-success">
            <div className="lp-reset-success-icon">
              <CheckCircle2 size={28} />
            </div>
            <h3 className="lp-reset-success-title">Password Reset Successful</h3>
            <p className="lp-reset-success-msg">
              The password for <strong>{forgotEmail}</strong> was changed. Sign in with the new one.
            </p>
            <button
              type="button"
              className="lp-submit-btn"
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
            <p className="lp-modal-hint">
              Enter your registered institutional email and create a new secure password.
            </p>

            <div className="lp-field">
              <label className="lp-label" htmlFor="forgot-email">Institutional email</label>
              <div className="lp-input-wrap">
                <Mail size={15} className="lp-input-icon" />
                <input
                  id="forgot-email"
                  type="email"
                  className="lp-input"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@isatu.edu.ph"
                  required
                />
              </div>
            </div>

            <div className="lp-field">
              <label className="lp-label" htmlFor="forgot-password">New Password</label>
              <div className="lp-input-wrap">
                <Lock size={15} className="lp-input-icon" />
                <input
                  id="forgot-password"
                  type={showForgotPass ? 'text' : 'password'}
                  className="lp-input lp-input--pw"
                  value={forgotPassword}
                  onChange={(e) => setForgotPassword(e.target.value)}
                  onKeyDown={handleForgotKeyDown}
                  onKeyUp={handleForgotKeyDown}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="lp-eye-btn"
                  onClick={() => setShowForgotPass(!showForgotPass)}
                  aria-label={showForgotPass ? 'Hide password' : 'Show password'}
                  aria-pressed={showForgotPass}
                >
                  {showForgotPass ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div className="lp-field">
              <label className="lp-label" htmlFor="forgot-confirm">Confirm New Password</label>
              <div className="lp-input-wrap">
                <KeyRound size={15} className="lp-input-icon" />
                <input
                  id="forgot-confirm"
                  type={showForgotConfirmPass ? 'text' : 'password'}
                  className="lp-input lp-input--pw"
                  value={forgotConfirmPassword}
                  onChange={(e) => setForgotConfirmPassword(e.target.value)}
                  onKeyDown={handleForgotKeyDown}
                  onKeyUp={handleForgotKeyDown}
                  placeholder="Re-type new password"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="lp-eye-btn"
                  onClick={() => setShowForgotConfirmPass(!showForgotConfirmPass)}
                  aria-label={showForgotConfirmPass ? 'Hide password' : 'Show password'}
                  aria-pressed={showForgotConfirmPass}
                >
                  {showForgotConfirmPass ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                </button>
              </div>
              {forgotConfirmPassword && (
                <div className={`lp-pw-match ${forgotPassword === forgotConfirmPassword ? 'lp-pw-match--ok' : 'lp-pw-match--err'}`}>
                  {forgotPassword === forgotConfirmPassword
                    ? <><CheckCircle2 size={12} /> Passwords match</>
                    : <><AlertCircle size={12} /> Passwords do not match</>
                  }
                </div>
              )}
              {isForgotCapsLockOn && (
                <div className="lp-capslock-warn">
                  <AlertCircle size={12} /><span>Caps Lock is on</span>
                </div>
              )}
            </div>

            {forgotError && (
              <div className="lp-error-banner" role="alert">
                <AlertCircle size={15} className="lp-error-icon" />
                <span>{forgotError}</span>
              </div>
            )}

            <div className="lp-modal-actions">
              <button
                type="button"
                className="lp-modal-cancel-btn"
                onClick={() => setIsForgotModalOpen(false)}
                disabled={isForgotSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="lp-submit-btn lp-submit-btn--flex2"
                disabled={isForgotSubmitting}
              >
                {isForgotSubmitting ? 'Updating…' : 'Update Password'}
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
