import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../components/ui/Toast';
import { ProfilePhotoPicker } from '../../components/common/ProfilePhotoPicker';
import { apiCreateUser } from '../../backend/api';

// ─── Downscale helper ────────────────────────────────────────────────────────
function readAndDownscale(file, maxPx = 400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The image could not be read.'));
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error('The image could not be decoded.'));
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ─── Searchable select ───────────────────────────────────────────────────────
function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Search or type a value…',
  getLabel = (option) => (typeof option === 'string' ? option : option?.name || option?.label || ''),
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const query = (value || '').trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return options;
    return (options || []).filter((option) => getLabel(option).toLowerCase().includes(query));
  }, [getLabel, options, query]);

  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        type="text"
        className="form-input"
        placeholder={placeholder}
        value={value || ''}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="registration-select-menu">
          {filtered.map((option, index) => {
            const label = getLabel(option);
            return (
              <button
                key={`${label}-${index}`}
                type="button"
                className={`registration-select-option${label === value ? ' is-selected' : ''}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(label);
                  setOpen(false);
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Role config ───────────────────────────────────────────────────────────
const ROLES = [
  {
    value: 'faculty',
    label: 'Faculty',
    desc: 'Teaching & academic personnel',
  },
  {
    value: 'staff',
    label: 'Administrative Staff',
    desc: 'Office & support personnel',
  },
  {
    value: 'maintenance',
    label: 'Maintenance Personnel',
    desc: 'Technicians & facility crew',
  },
  {
    value: 'campus_admin',
    label: 'Campus Administrator',
    desc: 'Executive work order approver',
  },
];

const SPECIALIZATIONS = [
  'Electrical & HVAC',
  'Plumbing & Drainage',
  'Carpentry & Masonry',
  'Network & IT Infrastructure',
  'General Campus Maintenance',
];

const GENDERS = ['Male', 'Female', 'Prefer not to say'];

const INITIAL_FORM = {
  role: 'faculty',
  firstName: '',
  middleName: '',
  lastName: '',
  extName: '',
  gender: '',
  contactNumber: '',
  idNumber: '',
  email: '',
  password: '',
  confirmPassword: '',
  department: '',
  office: '',
  academicRank: '',
  specialization: 'General Campus Maintenance',
  availabilityStatus: 'available',
  idPhotoUrl: '',
};

function SectionHeading({ title, subtitle }) {
  return (
    <div
      style={{
        paddingBottom: '10px',
        marginBottom: '14px',
        borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: '13.5px',
          fontWeight: '700',
          color: '#0f172a',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h3>
      {subtitle && (
        <p
          style={{
            margin: '3px 0 0 0',
            fontSize: '12px',
            color: '#64748b',
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function UserRegistrationForm({
  variant = 'page',
  onClose,
  onNavigate,
  onRegistered,
}) {
  const { departments = [], offices = [], refreshUserData } = useData() || {};
  const { toast } = useToast() || {};
  const isModal = variant === 'modal';

  const [form, setForm] = useState({ ...INITIAL_FORM });
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoName, setPhotoName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const formTopRef = useRef(null);
  const firstNameRef = useRef(null);

  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const focusFormStart = () => {
    if (formTopRef.current) {
      formTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePhotoSelected = async (file) => {
    if (!file) return;
    setError('');
    try {
      const dataUrl = await readAndDownscale(file);
      setPhotoPreview(dataUrl);
      setPhotoName(file.name);
      setField('idPhotoUrl', dataUrl);
    } catch {
      handlePhotoError('That photo could not be read. Please try a different image.');
    }
  };

  const handlePhotoError = (message) => {
    setError(message);
    if (message && typeof toast === 'function') toast(message, 'error');
  };

  const handleRemovePhoto = () => {
    setPhotoPreview('');
    setPhotoName('');
    setField('idPhotoUrl', '');
  };

  const validate = () => {
    if (!form.firstName.trim()) return 'First name is required.';
    if (!form.lastName.trim()) return 'Last name is required.';
    if (!form.idNumber.trim()) return 'ID number is required.';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return 'A valid email address is required.';
    }
    if (!form.password || form.password.length < 8) {
      return 'Password must be at least 8 characters.';
    }
    if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      return 'Password must include a letter and a number.';
    }
    if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      if (typeof toast === 'function') toast(validationError, 'error');
      focusFormStart();
      return;
    }

    setSubmitting(true);
    try {
      await apiCreateUser({
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || null,
        lastName: form.lastName.trim(),
        extName: form.extName.trim() || null,
        gender: form.gender || null,
        contactNumber: form.contactNumber.trim() || null,
        idNumber: form.idNumber.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        department: form.role === 'faculty' ? (form.department.trim() || null) : null,
        office: (form.role === 'staff' || form.role === 'campus_admin') ? (form.office.trim() || null) : null,
        academicRank: (form.role === 'faculty' || form.role === 'staff') ? (form.academicRank.trim() || null) : null,
        specialization: form.role === 'maintenance' ? form.specialization : null,
        availabilityStatus: form.role === 'maintenance' ? form.availabilityStatus : null,
        idPhotoUrl: form.idPhotoUrl || null,
      });

      if (typeof toast === 'function') toast('User account created successfully.', 'success');

      const account = {
        name: [form.firstName, form.middleName, form.lastName, form.extName]
          .filter(Boolean)
          .join(' ')
          .trim(),
        email: form.email.trim().toLowerCase(),
        role: ROLES.find((role) => role.value === form.role)?.label || form.role,
        academicRank: form.academicRank.trim(),
        idNumber: form.idNumber.trim(),
      };

      setSuccessData(account);

      if (typeof refreshUserData === 'function') {
        refreshUserData().catch(() => {});
      }
      if (typeof onRegistered === 'function') onRegistered(account);
    } catch (requestError) {
      const message = requestError.message || 'Failed to create user. Please try again.';
      setError(message);
      if (typeof toast === 'function') toast(message, 'error');
      focusFormStart();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterAnother = () => {
    setSuccessData(null);
    setForm({ ...INITIAL_FORM });
    setPhotoPreview('');
    setPhotoName('');
    setError('');
    setShowPassword(false);
    requestAnimationFrame(() => firstNameRef.current?.focus());
  };

  const sectionClass = isModal ? 'registration-section' : 'content-card';
  const sectionStyle = isModal ? undefined : { marginBottom: '20px' };

  // ── Success screen ────────────────────────────────────────────────────────
  if (successData) {
    return (
      <div className={isModal ? 'registration-success registration-success--modal' : 'registration-success'}>
        <div className="registration-success-icon">
          <CheckCircle2 size={38} aria-hidden="true" />
        </div>
        <h2 className="registration-success-title">Account Created Successfully</h2>
        <p className="registration-success-copy">
          The personnel account is active immediately. Share the sign-in details below with the new user.
        </p>

        <div className="registration-success-summary">
          {[
            { label: 'Full Name', value: successData.name },
            { label: 'Institutional ID', value: successData.idNumber },
            { label: 'Email', value: successData.email },
            { label: 'Role', value: successData.role },
            ...(successData.academicRank
              ? [{ label: 'Academic Rank', value: successData.academicRank }]
              : []),
          ].map(({ label, value }) => (
            <div className="registration-success-row" key={label}>
              <span className="registration-success-label">{label}</span>
              <span className="registration-success-value">{value}</span>
            </div>
          ))}
        </div>

        <div className="registration-success-actions">
          <button type="button" className="btn btn-secondary" onClick={handleRegisterAnother}>
            <RefreshCw size={15} /> Register Another User
          </button>
          {isModal ? (
            <button type="button" className="btn btn-primary" onClick={() => onClose?.()}>
              <CheckCircle2 size={15} /> Done
            </button>
          ) : (
            typeof onNavigate === 'function' && (
              <button type="button" className="btn btn-primary" onClick={() => onNavigate('user-management')}>
                <Users size={15} /> View Personnel Directory
              </button>
            )
          )}
        </div>
      </div>
    );
  }

  // ── Registration form ─────────────────────────────────────────────────────
  return (
    <div className={`registration-form${isModal ? ' registration-form--modal' : ''}`}>
      {!isModal && (
        <div className="page-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 className="page-title">User Registration</h1>
              <span className="registration-superadmin-badge">Super Admin Only</span>
            </div>
            <p className="page-subtitle">
              Create a new personnel account. Accounts are immediately active — no approval queue.
            </p>
          </div>
        </div>
      )}

      <form ref={formTopRef} onSubmit={handleSubmit} noValidate>
        {error && (
          <div className={`registration-error${isModal ? ' registration-error--modal' : ''}`} role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* ── SECTION 1: Role Selection ── */}
        <section className={sectionClass} style={sectionStyle}>
          <SectionHeading
            title="Personnel Role"
            subtitle="Select the account classification to configure institutional fields and access scope."
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '10px',
            }}
          >
            {ROLES.map((role) => {
              const selected = form.role === role.value;
              return (
                <button
                  key={role.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setField('role', role.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: selected ? '1.5px solid #071746' : '1.5px solid #cbd5e1',
                    background: 'var(--bg-card)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: selected ? '5px solid #071746' : '1.5px solid #94a3b8',
                      background: '#ffffff',
                      flexShrink: 0,
                      marginTop: '2px',
                      boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '13.5px',
                        fontWeight: '700',
                        color: '#0f172a',
                        lineHeight: 1.25,
                      }}
                    >
                      {role.label}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '12px',
                        color: '#64748b',
                        marginTop: '2px',
                        lineHeight: 1.35,
                      }}
                    >
                      {role.desc}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── SECTION 2: Personal Information ── */}
        <section className={sectionClass} style={sectionStyle}>
          <SectionHeading
            title="Personal Information"
            subtitle="Use the full legal name recorded in the institution's personnel records."
          />

          <div className="registration-field-grid">
            <div className="form-group">
              <label className="form-label">First Name <span className="label-required">*</span></label>
              <input
                ref={firstNameRef}
                className="form-input"
                type="text"
                value={form.firstName}
                onChange={(event) => setField('firstName', event.target.value)}
                placeholder="Juan"
                autoComplete="given-name"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Middle Name</label>
              <input
                className="form-input"
                type="text"
                value={form.middleName}
                onChange={(event) => setField('middleName', event.target.value)}
                placeholder="Santos"
                autoComplete="additional-name"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name <span className="label-required">*</span></label>
              <input
                className="form-input"
                type="text"
                value={form.lastName}
                onChange={(event) => setField('lastName', event.target.value)}
                placeholder="Dela Cruz"
                autoComplete="family-name"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Extension Name</label>
              <input
                className="form-input"
                type="text"
                value={form.extName}
                onChange={(event) => setField('extName', event.target.value)}
                placeholder="Jr., Sr., III"
                autoComplete="honorific-suffix"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select
                className="form-select"
                value={form.gender}
                onChange={(event) => setField('gender', event.target.value)}
              >
                <option value="">Select gender (optional)</option>
                {GENDERS.map((gender) => <option key={gender} value={gender}>{gender}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Contact Number</label>
              <input
                className="form-input"
                type="tel"
                value={form.contactNumber}
                onChange={(event) => setField('contactNumber', event.target.value)}
                placeholder="+63 917 123 4567"
                autoComplete="tel"
              />
            </div>
          </div>
        </section>

        {/* ── SECTION 3: Credentials ── */}
        <section className={sectionClass} style={sectionStyle}>
          <SectionHeading
            title="Credentials & Sign-In"
            subtitle="Employee ID number, institutional email address, and initial password."
          />

          <div className="registration-field-grid">
            <div className="form-group">
              <label className="form-label">ID Number <span className="label-required">*</span></label>
              <input
                className="form-input"
                type="text"
                value={form.idNumber}
                onChange={(event) => setField('idNumber', event.target.value)}
                placeholder="ISATU-EMP-2026-001"
                autoComplete="off"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address <span className="label-required">*</span></label>
              <input
                className="form-input"
                type="email"
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
                placeholder="juan.delacruz@isatu.edu.ph"
                autoComplete="email"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Temporary Password <span className="label-required">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => setField('password', event.target.value)}
                  placeholder="Temporary123"
                  autoComplete="new-password"
                  style={{ paddingRight: '44px' }}
                  required
                />
                <button
                  type="button"
                  className="registration-password-toggle"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="registration-field-hint">At least 8 characters, including a letter and a number.</p>
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password <span className="label-required">*</span></label>
              <input
                className="form-input"
                type={showPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(event) => setField('confirmPassword', event.target.value)}
                placeholder="Re-enter the temporary password"
                autoComplete="new-password"
                style={{
                  borderColor: form.confirmPassword && form.password !== form.confirmPassword ? '#ef4444' : undefined,
                }}
                required
              />
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="registration-field-error">Passwords do not match.</p>
              )}
            </div>
          </div>
        </section>

        {/* ── SECTION 4: Role-Specific Fields ── */}
        <section className={sectionClass} style={sectionStyle}>
          <SectionHeading
            title={form.role === 'faculty' ? 'Academic Assignment'
              : form.role === 'staff' ? 'Administrative Assignment'
                : form.role === 'campus_admin' ? 'Campus Admin Assignment'
                  : 'Maintenance Assignment'}
            subtitle="Department, office, or technical trade assignment."
          />

          <div className="registration-field-grid">
            {form.role === 'faculty' && (
              <>
                <div className="form-group">
                  <label className="form-label">Academic Department / College</label>
                  <SearchableSelect
                    value={form.department}
                    onChange={(value) => setField('department', value)}
                    options={departments}
                    placeholder="Select or type department / college…"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Academic Rank / Plantilla Position</label>
                  <input
                    className="form-input"
                    type="text"
                    value={form.academicRank}
                    onChange={(event) => setField('academicRank', event.target.value)}
                    placeholder="e.g. Instructor I, Assistant Professor II"
                  />
                </div>
              </>
            )}

            {form.role === 'staff' && (
              <>
                <div className="form-group">
                  <label className="form-label">Administrative Office</label>
                  <SearchableSelect
                    value={form.office}
                    onChange={(value) => setField('office', value)}
                    options={offices}
                    placeholder="Search or type office name…"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Academic Rank / Plantilla Position</label>
                  <input
                    className="form-input"
                    type="text"
                    value={form.academicRank}
                    onChange={(event) => setField('academicRank', event.target.value)}
                    placeholder="e.g. Administrative Officer II, Administrative Aide III"
                  />
                </div>
              </>
            )}

            {form.role === 'campus_admin' && (
              <div className="form-group">
                <label className="form-label">Office / Assignment</label>
                <SearchableSelect
                  value={form.office}
                  onChange={(value) => setField('office', value)}
                  options={offices}
                  placeholder="Search or type office name…"
                />
              </div>
            )}

            {form.role === 'maintenance' && (
              <>
                <div className="form-group">
                  <label className="form-label">Trade Specialization <span className="label-required">*</span></label>
                  <select
                    className="form-select"
                    value={form.specialization}
                    onChange={(event) => setField('specialization', event.target.value)}
                  >
                    {SPECIALIZATIONS.map((specialization) => (
                      <option key={specialization} value={specialization}>{specialization}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Initial Duty Status</label>
                  <select
                    className="form-select"
                    value={form.availabilityStatus}
                    onChange={(event) => setField('availabilityStatus', event.target.value)}
                  >
                    <option value="available">Available</option>
                    <option value="busy">Busy</option>
                    <option value="off_duty">Off Duty</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── SECTION 5: Profile Photo ── */}
        <section className={sectionClass} style={sectionStyle}>
          <SectionHeading
            title="Profile Photo"
            subtitle="Optional directory photo for personnel identification."
          />
          <ProfilePhotoPicker
            value={photoPreview}
            fileName={photoName}
            onSelect={handlePhotoSelected}
            onRemove={handleRemovePhoto}
            onError={handlePhotoError}
            disabled={submitting}
            hint="JPG or PNG, recommended 400×400px. Take a photo with your camera or upload one from this device."
          />
        </section>

        <div className="registration-form-actions">
          <div className="registration-form-note">
            <ShieldCheck size={15} aria-hidden="true" />
            <span>Account is created as active. Share the temporary password securely.</span>
          </div>
          <div className="registration-form-buttons">
            {isModal ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onClose?.()}
                disabled={submitting}
              >
                Cancel
              </button>
            ) : (
              typeof onNavigate === 'function' && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onNavigate('user-management')}
                  disabled={submitting}
                >
                  <Users size={15} /> View Directory
                </button>
              )
            )}
            <button
              type="submit"
              className="btn btn-primary registration-submit"
              disabled={submitting}
            >
              {submitting ? 'Creating Account…' : 'Create Account'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default UserRegistrationForm;
