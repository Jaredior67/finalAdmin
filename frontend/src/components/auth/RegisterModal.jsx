import React, { useState, useEffect, useRef, useMemo } from 'react';
import { UserPlus, CheckCircle2, AlertCircle, Eye, EyeOff, ShieldCheck, Search, Building2, ChevronDown, Check, X } from 'lucide-react';
import { Modal } from '../common/Modal';
import { ProfilePhotoPicker } from '../common/ProfilePhotoPicker';
import { useData } from '../../context/DataContext';
import { apiGetRegistrationStatus, apiCreateUser } from '../../backend/api';
import { Spinner } from '../ui/Spinner';

/**
 * Outcome panel shown to an applicant who has not been given an account yet.
 *
 * The decision itself lives on `registration_requests`, and this is the only
 * route by which it can reach the person it concerns: there is no `users` row
 * to sign in with, and a `notifications` row cannot be addressed to someone who
 * is not a user.
 */
function RegistrationStatusNotice({ result }) {
  const status = result?.status;
  const styles = {
    approved: { bg: '#ecfdf5', border: '#6ee7b7', color: '#047857', title: 'Approved' },
    pending: { bg: '#fffbeb', border: '#fcd34d', color: '#92400e', title: 'Awaiting Administrator review' },
    rejected: { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', title: 'Not approved' },
    not_found: { bg: 'var(--bg-sunken)', border: '#e2e8f0', color: '#64748b', title: 'No application found' },
  };
  const tone = styles[status] || styles.not_found;

  const message =
    status === 'approved'
      ? 'The account is active — you can sign in now.'
      : status === 'pending'
        ? 'The PDAS Administrator has not finished reviewing this application yet.'
        : status === 'rejected'
          ? (result.reason || 'The application was not approved. Contact the PDAS Administrator for details.')
          : 'Nothing is on file for that address. Check the spelling, or register again.';

  return (
    <div style={{
      marginTop: '10px',
      padding: '11px 13px',
      background: tone.bg,
      border: `1px solid ${tone.border}`,
      borderRadius: '8px',
      color: tone.color
    }}>
      <div style={{ fontWeight: '700', fontSize: '12.5px', marginBottom: '3px' }}>{tone.title}</div>
      <div style={{ fontSize: '12.5px', lineHeight: 1.5 }}>{message}</div>
      {status === 'rejected' && result.reviewedAt && (
        <div style={{ fontSize: '11.5px', marginTop: '5px', opacity: 0.85 }}>
          Reviewed {new Date(result.reviewedAt).toLocaleString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
          })}
        </div>
      )}
    </div>
  );
}

/**
 * SearchableOfficeSelect
 * Allows applicants to search through campus offices via typing / autocomplete,
 * select one from suggestions, or type a custom office name directly if not listed.
 */
function SearchableOfficeSelect({
  value,
  onChange,
  options = [],
  placeholder = "Search office or type office name...",
  required = true,
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const query = (value || '').trim().toLowerCase();

  const filteredOptions = useMemo(() => {
    if (!query) return options;
    return options.filter((opt) => opt.toLowerCase().includes(query));
  }, [options, query]);

  const exactMatch = options.some(
    (opt) => opt.toLowerCase() === (value || '').trim().toLowerCase()
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(filteredOptions.length - 1);
      } else {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
      }
    } else if (e.key === 'Enter') {
      if (isOpen) {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          onChange(filteredOptions[highlightedIndex]);
          setIsOpen(false);
          setHighlightedIndex(-1);
        } else if (value && value.trim()) {
          setIsOpen(false);
          setHighlightedIndex(-1);
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-combobox-item]');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (officeName) => {
    onChange(officeName);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(true);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const highlightMatch = (text, q) => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span style={{ fontWeight: '800', color: '#001f9c', textDecoration: 'underline' }}>
          {text.slice(idx, idx + q.length)}
        </span>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div style={{
          position: 'absolute',
          left: '11px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'none',
          zIndex: 2
        }}>
          <Search size={16} />
        </div>

        <input
          ref={inputRef}
          type="text"
          className="form-input"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          required={required}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          style={{
            paddingLeft: '34px',
            paddingRight: value ? '56px' : '32px',
            borderColor: isOpen ? '#001f9c' : undefined,
            boxShadow: isOpen ? '0 0 0 3px rgba(0, 31, 156, 0.12)' : undefined
          }}
          autoComplete="off"
        />

        <div style={{
          position: 'absolute',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          zIndex: 2
        }}>
          {value && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear office"
              title="Clear office"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; }}
            >
              <X size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsOpen((prev) => !prev);
              inputRef.current?.focus();
            }}
            aria-label={isOpen ? "Close office suggestions" : "Open office suggestions"}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#64748b',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease, color 0.15s ease'
            }}
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          ref={listRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 100,
            background: '#ffffff',
            border: '1.5px solid #cbd5e1',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.1)',
            maxHeight: '230px',
            overflowY: 'auto',
            padding: '4px'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            fontSize: '11px',
            fontWeight: '700',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            borderBottom: '1px solid #f1f5f9'
          }}>
            <span>
              {query
                ? `Matching Offices (${filteredOptions.length})`
                : `Campus Offices (${options.length})`}
            </span>
            <span style={{ fontSize: '10.5px', fontWeight: '500', color: '#94a3b8', textTransform: 'none' }}>
              Type to filter or enter custom
            </span>
          </div>

          {value && value.trim() && !exactMatch && (
            <div
              onClick={() => {
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                margin: '3px 0',
                borderRadius: '6px',
                background: 'var(--bg-sunken)',
                border: '1px dashed #cbd5e1',
                cursor: 'pointer',
                fontSize: '12.5px',
                color: '#0f172a'
              }}
              title="Click to use what you typed"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <span style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: '#e0f2fe',
                  color: '#0369a1',
                  flexShrink: 0
                }}>
                  Custom
                </span>
                <span style={{ fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Use: "{value.trim()}"
                </span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', flexShrink: 0 }}>
                Press Enter / Click to use
              </span>
            </div>
          )}

          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => {
              const isSelected = (value || '').trim().toLowerCase() === opt.toLowerCase();
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={opt}
                  data-combobox-item
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    color: isSelected ? '#001f9c' : '#1e293b',
                    background: isSelected
                      ? '#eff6ff'
                      : isHighlighted
                        ? 'var(--bg-sunken)'
                        : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.12s ease',
                    fontWeight: isSelected ? '700' : '500'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <Building2 size={14} style={{ color: isSelected ? '#001f9c' : '#94a3b8', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', lineHeight: 1.35 }}>
                      {highlightMatch(opt, query)}
                    </span>
                  </div>
                  {isSelected && (
                    <Check size={14} style={{ color: '#001f9c', flexShrink: 0, marginLeft: '6px' }} />
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ padding: '12px 10px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
              <div>No predefined office found matching "<strong>{value}</strong>"</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                Your custom office "{value.trim()}" will be registered.
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '5px' }}>
        💡 Choose from the campus list or type your specific office if not listed.
      </div>
    </div>
  );
}

export const RegisterModal = ({ isOpen, onClose, onSwitchToLogin, isAdmin = false, onUserCreated }) => {
  const { registerUser, offices, departments } = useData();

  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    extName: '',
    idNumber: '',
    userType: 'Faculty', // 'Faculty' | 'Administrative Staff' | 'Maintenance' | 'Campus Admin'
    department: 'BSIT',
    office: '',
    specialization: 'Electrical & HVAC',
    gender: 'Male',
    gmail: '',
    contactNumber: '',
    password: ''
  });
  const [confirmPassword, setConfirmPassword] = useState('');

  const [idFile, setIdFile] = useState(null);
  const [idPreview, setIdPreview] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // RA 10173 (Data Privacy Act) consent. For self-registration it requires explicit opt-in;
  // for Super Admin account provisioning, administrator authorization is active.
  const [consentGiven, setConsentGiven] = useState(Boolean(isAdmin));
  // Applicant-facing outcome lookup. Before this existed an applicant had no
  // way to learn that their application was rejected — they could not sign in
  // (no account yet) and no notification could be addressed to them.
  const [statusEmail, setStatusEmail] = useState('');
  const [statusResult, setStatusResult] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);



  /* The ID photo travels as a base64 data-URL inside the registration payload.
     A phone camera delivers 3–8MB, which becomes 4–11MB of base64 — far past
     what any column should carry and slow enough to stall the upload. Downscale
     to a reviewer-readable size first and step quality down only if the result
     is still over budget. */
  const MAX_IMAGE_DIMENSION = 1024;
  const MAX_IMAGE_DATA_URL_CHARS = 700 * 1024;

  const readAndDownscale = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('The image could not be read.'));
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          try {
            const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
            const width = Math.max(1, Math.round(img.width * scale));
            const height = Math.max(1, Math.round(img.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            let quality = 0.82;
            let dataUrl = canvas.toDataURL('image/jpeg', quality);
            while (dataUrl.length > MAX_IMAGE_DATA_URL_CHARS && quality > 0.4) {
              quality -= 0.15;
              dataUrl = canvas.toDataURL('image/jpeg', quality);
            }
            resolve(dataUrl);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('Image could not be decoded.'));
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

  const handlePhotoFile = async (file) => {
    if (!file) return;
    setError('');
    try {
      const dataUrl = await readAndDownscale(file);
      setIdFile(file);
      setIdPreview(dataUrl);
    } catch {
      setError('That photo could not be read. Please try a different file.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('First name and Last name are required.');
      return;
    }
    if (!formData.idNumber.trim()) {
      setError('ID number is required.');
      return;
    }
    if (!formData.gmail.trim() || !formData.gmail.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }
    if (formData.userType === 'Administrative Staff' && !formData.office.trim()) {
      setError('Please select or type your administrative office.');
      return;
    }
    // Must mirror passwordError() in backend/src/routes/authRoutes.js. The server
    // enforced 8+/letter/number while this form only asked for 6 characters, so a
    // valid-looking registration could still bounce with a message about rules the
    // applicant was never shown.
    if (formData.password.length < 8) {
      setError('Create a password with at least 8 characters.');
      return;
    }
    if (!/[A-Za-z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
      setError('Password must include at least one letter and one number.');
      return;
    }
    if (formData.password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter your confirm password.');
      return;
    }
    if (!idPreview && !idFile) {
      setError('Please attach a photo to be used as your profile.');
      return;
    }
    if (!consentGiven && !isAdmin) {
      setError('Please accept the Data Privacy notice before submitting your application.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      if (isAdmin) {
        let backendRole = 'faculty';
        if (formData.userType === 'Administrative Staff' || formData.userType === 'Staff') {
          backendRole = 'staff';
        } else if (formData.userType === 'Maintenance' || formData.userType === 'Technician') {
          backendRole = 'maintenance';
        } else if (formData.userType === 'Campus Admin') {
          backendRole = 'campus_admin';
        }

        await apiCreateUser({
          firstName: formData.firstName.trim(),
          middleName: formData.middleName.trim() || null,
          lastName: formData.lastName.trim(),
          extName: formData.extName.trim() || null,
          idNumber: formData.idNumber.trim(),
          email: formData.gmail.trim(),
          password: formData.password,
          role: backendRole,
          department: (backendRole === 'faculty' || backendRole === 'campus_admin') ? (formData.department?.trim() || null) : null,
          office: (backendRole === 'staff' || backendRole === 'campus_admin') ? (formData.office?.trim() || null) : null,
          contactNumber: formData.contactNumber?.trim() || null,
          gender: formData.gender || null,
          idPhotoUrl: idPreview,
          specialization: backendRole === 'maintenance' ? (formData.specialization || 'General Campus Facility') : null,
        });

        if (onUserCreated) {
          await onUserCreated();
        }
        setSubmitted(true);
      } else {
        // Map display label to backend role string.
        // Supervisor status is granted by the PDAS Admin after approval — it is
        // never self-declared during registration.
        const backendRole = formData.userType === 'Administrative Staff' ? 'staff' : 'faculty';
        await registerUser({
          ...formData,
          role: backendRole,
          isSupervisor: false,
          is_supervisor: 0,
          idFileName: idFile ? idFile.name : 'Attached_Photo_of_ID.jpg',
          idPreviewUrl: idPreview,
          idPhotoUrl: idPreview,
          // Timestamped at the moment the applicant ticks the box; the server
          // records it on registration_requests and copies it to users on approval.
          consentAt: consentGiven ? new Date().toISOString() : null
        });
        setSubmitted(true);
      }
    } catch (requestError) {
      setError(requestError.message || (isAdmin ? 'User could not be created.' : 'Registration could not be submitted.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* Look up the outcome of an application by the address it was filed with.
     The server answers with only what is already stored against that row, so
     this cannot be used to read anything else. */
  const handleCheckStatus = async () => {
    const email = (statusEmail || '').trim();
    if (!email || !email.includes('@')) {
      setStatusError('Enter the email address you registered with.');
      return;
    }
    setStatusBusy(true);
    setStatusError('');
    setStatusResult(null);
    try {
      setStatusResult(await apiGetRegistrationStatus(email));
    } catch (requestError) {
      setStatusError(requestError.message || 'The status could not be checked right now. Try again shortly.');
    } finally {
      setStatusBusy(false);
    }
  };

  const handleResetAndClose = () => {
    setSubmitted(false);
    setError('');
    setStatusEmail('');
    setStatusResult(null);
    setStatusError('');
    setConfirmPassword('');
    setFormData({
      firstName: '',
      middleName: '',
      lastName: '',
      extName: '',
      idNumber: '',
      userType: 'Faculty',
      department: departments[0] || 'BSIT',
      office: '',
      specialization: 'Electrical & HVAC',
      gender: 'Male',
      gmail: '',
      contactNumber: '',
      password: ''
    });
    setIdFile(null);
    setIdPreview(null);
    setConsentGiven(Boolean(isAdmin));
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleResetAndClose}
      onBack={handleResetAndClose}
      title={isAdmin ? "Super Admin — Register User Account" : "ISAT U Dumangas Account Registration"}
      maxWidth="680px"
    >
      {submitted ? (
        isAdmin ? (
          <div style={{ textAlign: 'center', padding: '16px 8px' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: '#ecfdf5',
              color: '#059669',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '14px'
            }}>
              <CheckCircle2 size={34} />
            </div>

            <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
              User Account Registered &amp; Activated!
            </h3>
            <p style={{ fontSize: '13.5px', color: '#64748b', margin: '0 auto 18px auto', maxWidth: '480px' }}>
              The account for <strong>{formData.firstName} {formData.lastName}</strong> ({formData.gmail}) has been registered and activated. The user can sign in immediately with their credentials.
            </p>

            <div style={{
              background: 'var(--bg-sunken)',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px 16px',
              fontSize: '12.5px',
              color: '#334155',
              marginBottom: '22px',
              textAlign: 'left'
            }}>
              <div style={{ fontWeight: '700', color: '#001f9c', marginBottom: '8px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em' }}>
                Account Information:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                <div>• Name: <strong>{formData.firstName} {formData.middleName ? formData.middleName + ' ' : ''}{formData.lastName}{formData.extName ? ' ' + formData.extName : ''}</strong></div>
                <div>• ID Number: <strong>{formData.idNumber}</strong></div>
                <div>• Role: <strong>{formData.userType}</strong></div>
                <div>• Email: <strong>{formData.gmail}</strong></div>
                {formData.contactNumber && <div>• Contact: <strong>{formData.contactNumber}</strong></div>}
                <div>• Gender: <strong>{formData.gender}</strong></div>
                {formData.userType === 'Faculty' ? (
                  <div>• Department: <strong>{formData.department}</strong></div>
                ) : formData.userType === 'Administrative Staff' ? (
                  <div>• Office: <strong>{formData.office}</strong></div>
                ) : formData.userType === 'Maintenance' ? (
                  <div>• Specialization: <strong>{formData.specialization || 'General Campus Facility'}</strong></div>
                ) : null}
                <div style={{ gridColumn: '1 / -1' }}>• Profile Photo: <strong style={{ color: '#059669' }}>Saved as User Avatar</strong></div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleResetAndClose}
              style={{ minWidth: '220px', padding: '10px 24px', fontSize: '13.5px', fontWeight: '700' }}
            >
              Done — Return to User Management
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 8px' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: '#ecfdf5',
              color: '#059669',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '14px'
            }}>
              <CheckCircle2 size={34} />
            </div>

            <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
              Account Application Submitted!
            </h3>
            <p style={{ fontSize: '13.5px', color: '#64748b', margin: '0 auto 18px auto', maxWidth: '480px' }}>
              Thank you for registering with the FixIT Campus Facility Management System.
            </p>

            <div style={{
              background: '#fffbeb',
              border: '1.5px solid #fde68a',
              borderRadius: '12px',
              padding: '16px 18px',
              textAlign: 'left',
              marginBottom: '18px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#fef3c7',
                color: '#b45309',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '2px'
              }}>
                <ShieldCheck size={18} />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#92400e', marginBottom: '4px' }}>
                  Pending Administrator Confirmation
                </div>
                <p style={{ fontSize: '12.5px', color: '#78350f', lineHeight: '1.5', margin: 0 }}>
                  The PDAS Administrator reviews every account before it can be used. They will check your institutional ID and activate it.
                </p>
                <div style={{ fontSize: '11.5px', color: '#b45309', marginTop: '6px', fontWeight: '600' }}>
                  Once approved you can sign in with {formData.gmail}.
                </div>
              </div>
            </div>

            <div style={{
              background: 'var(--bg-sunken)',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px 16px',
              fontSize: '12.5px',
              color: '#334155',
              marginBottom: '22px',
              textAlign: 'left'
            }}>
              <div style={{ fontWeight: '700', color: '#001f9c', marginBottom: '8px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em' }}>
                Registration Details Submitted:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                <div>• Name: <strong>{formData.firstName} {formData.middleName ? formData.middleName + ' ' : ''}{formData.lastName}{formData.extName ? ' ' + formData.extName : ''}</strong></div>
                <div>• ID Number: <strong>{formData.idNumber}</strong></div>
                <div>• Role: <strong>{formData.userType}</strong></div>
                <div>• Email: <strong>{formData.gmail}</strong></div>
                {formData.contactNumber && <div>• Contact: <strong>{formData.contactNumber}</strong></div>}
                <div>• Gender: <strong>{formData.gender}</strong></div>
                {formData.userType === 'Faculty' ? (
                  <div>• Department: <strong>{formData.department}</strong></div>
                ) : (
                  <div>• Office: <strong>{formData.office}</strong></div>
                )}
                <div style={{ gridColumn: '1 / -1' }}>• Profile Photo: <strong style={{ color: '#059669' }}>Uploaded for user profile</strong></div>
              </div>
            </div>

            {/* Outcome lookup — the only route by which the decision reaches the
                applicant, who cannot sign in until it is made. */}
            <div style={{
              background: 'var(--bg-sunken)',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px 18px',
              textAlign: 'left',
              marginBottom: '22px'
            }}>
              <div style={{
                fontWeight: '700', color: '#001f9c', marginBottom: '4px',
                textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.04em'
              }}>
                Check application status
              </div>
              <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 10px', lineHeight: 1.5 }}>
                Come back any time with the address you registered here and you will see whether the
                account has been approved, is still under review, or was not approved and why.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="email"
                  className="form-input"
                  placeholder="you@gmail.com"
                  value={statusEmail || formData.gmail}
                  onChange={(e) => setStatusEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCheckStatus(); } }}
                  aria-label="Registered email address"
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCheckStatus}
                  disabled={statusBusy}
                  style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  {statusBusy ? 'Checking…' : 'Check'}
                </button>
              </div>

              {statusError && (
                <div style={{ fontSize: '12.5px', color: '#b91c1c', marginTop: '9px' }}>
                  {statusError}
                </div>
              )}

              {statusResult && <RegistrationStatusNotice result={statusResult} />}
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleResetAndClose}
              style={{ minWidth: '220px', padding: '10px 24px', fontSize: '13.5px', fontWeight: '700' }}
            >
              Understood — Return to Sign In
            </button>
          </div>
        )
      ) : (
        <form onSubmit={handleSubmit}>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
            {isAdmin
              ? 'Super Administrator Provisioning: Register and immediately activate campus user accounts.'
              : 'Register to file facility requests. PDAS reviews each submission.'}
          </p>

          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* 1. Name Row */}
          <div className="form-grid-names" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Maria"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Middle Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Cruz"
                value={formData.middleName}
                onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Santos"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Ext. Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Jr., Sr., III"
                value={formData.extName}
                onChange={(e) => setFormData({ ...formData, extName: e.target.value })}
              />
            </div>
          </div>

          {/* 2. Classification & Gender */}
          <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Account Classification *</label>
              <select
                className="form-select"
                value={formData.userType}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({
                    ...formData,
                    userType: val,
                    department: (val === 'Faculty' || val === 'Campus Admin') ? (departments[0] || 'BSIT') : '',
                    office: val === 'Administrative Staff' ? (formData.office || '') : ''
                  });
                }}
                required
              >
                <option value="Faculty">Faculty Member</option>
                <option value="Administrative Staff">Administrative Staff</option>
                {isAdmin && <option value="Maintenance">Maintenance Personnel / Technician</option>}
                {isAdmin && <option value="Campus Admin">Campus Admin / Executive Approver</option>}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Gender *</label>
              <select
                className="form-select"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                required
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>

          {/* 4. Department (Faculty) / Office (Staff) / Specialization (Maintenance) */}
          {formData.userType === 'Faculty' ? (
            <div className="form-group">
              <label className="form-label">
                Academic Department *
              </label>
              <select
                className="form-select"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                required
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          ) : formData.userType === 'Administrative Staff' ? (
            <div className="form-group">
              <label className="form-label">
                Administrative Office *
              </label>
              <SearchableOfficeSelect
                value={formData.office}
                onChange={(newOffice) => setFormData({ ...formData, office: newOffice })}
                options={offices}
                placeholder="Search office or type office name..."
                required
              />
            </div>
          ) : formData.userType === 'Maintenance' ? (
            <div className="form-group">
              <label className="form-label">
                Trade Specialization *
              </label>
              <select
                className="form-select"
                value={formData.specialization || 'General Campus Facility'}
                onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                required
              >
                <option value="Electrical & HVAC">Electrical &amp; HVAC Systems</option>
                <option value="Plumbing & Drainage">Plumbing &amp; Water Systems</option>
                <option value="Carpentry & Masonry">Carpentry &amp; Structural Masonry</option>
                <option value="Network & IT Infrastructure">Network &amp; IT Hardware</option>
                <option value="General Campus Facility">General Campus Maintenance</option>
              </select>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">
                Office / Assignment
              </label>
              <SearchableOfficeSelect
                value={formData.office}
                onChange={(newOffice) => setFormData({ ...formData, office: newOffice })}
                options={offices}
                placeholder="e.g. Office of the Campus Administrator"
              />
            </div>
          )}

          {/* 5. ID Number & Email */}
          <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">ID Number *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 2026-0012"
                value={formData.idNumber}
                onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email *</label>
              <input
                type="email"
                className="form-input"
                placeholder="e.g. username@gmail.com"
                value={formData.gmail}
                onChange={(e) => setFormData({ ...formData, gmail: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Contact Number *</label>
            <input
              type="tel"
              className="form-input"
              placeholder="e.g. 09123456789"
              value={formData.contactNumber}
              onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Create Password *</label>
            <div className="input-with-icon-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="At least 8 characters, with a letter and a number"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                minLength={8}
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
            {/* Live mirror of passwordError() in backend/src/routes/authRoutes.js.
                The rules were enforced server-side only, so an applicant could
                submit a "valid-looking" form and get bounced by wording they had
                never been shown. */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', marginTop: '7px' }}>
              {[
                { ok: formData.password.length >= 8, label: 'At least 8 characters' },
                { ok: /[A-Za-z]/.test(formData.password), label: 'Contains a letter' },
                { ok: /[0-9]/.test(formData.password), label: 'Contains a number' }
              ].map((rule) => (
                <span
                  key={rule.label}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    fontSize: '11.5px',
                    fontWeight: rule.ok ? '700' : '500',
                    color: rule.ok ? '#059669' : '#94a3b8'
                  }}
                >
                  <CheckCircle2 size={13} />
                  {rule.label}
                </span>
              ))}
            </div>
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label className="form-label">Confirm Password *</label>
            <div className="input-with-icon-wrapper">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', marginTop: '7px' }}>
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  fontSize: '11.5px',
                  fontWeight: (confirmPassword && confirmPassword === formData.password) ? '700' : '500',
                  color: (confirmPassword && confirmPassword === formData.password) ? '#059669' : '#94a3b8'
                }}
              >
                <CheckCircle2 size={13} />
                Passwords match
              </span>
            </div>
          </div>

          {/* 6. Profile Photo */}
          <div className="form-group">
            <label className="form-label">
              Profile Photo *
            </label>
            <ProfilePhotoPicker
              value={idPreview || ''}
              fileName={idFile?.name || ''}
              onSelect={handlePhotoFile}
              onRemove={() => {
                setIdFile(null);
                setIdPreview(null);
                setError('');
              }}
              onError={setError}
              disabled={isSubmitting}
              hint="PNG, JPG or JPEG (max 10MB). You can take a photo with your camera or upload one from this device."
            />
          </div>

          {/* 7. Data Privacy Act consent (RA 10173) */}
          <div style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
            marginTop: '16px',
            padding: '14px 16px',
            background: 'var(--bg-sunken)',
            border: '1px solid #cbd5e1',
            borderRadius: '10px'
          }}>
            <input
              type="checkbox"
              id="reg-consent"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: '#001f9c', flexShrink: 0 }}
            />
            <label htmlFor="reg-consent" style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.55', cursor: 'pointer' }}>
              <span style={{ fontWeight: '700', display: 'block', marginBottom: '3px', color: '#0f172a' }}>
                {isAdmin ? 'Super Administrator Provisioning Authorization *' : 'Data Privacy Notice (RA 10173) *'}
              </span>
              {isAdmin
                ? 'I certify as Super Administrator that this user profile, ID number, and profile photo are verified and authorized for immediate account activation in FixIT.'
                : 'I consent to the collection and processing of the personal information in this application — my name, ID number, contact details, and profile photo — for identity verification and account administration by the PDAS Administrator of ISAT U Dumangas. The information is used only for those purposes and is not shared outside the institution.'}
            </label>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {onSwitchToLogin && (
              <button
                type="button"
                onClick={onSwitchToLogin}
                style={{ background: 'none', border: 'none', color: '#001f9c', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                ← Back to Sign In
              </button>
            )}

            <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleResetAndClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Spinner size={16} color="#ffffff" /> : <UserPlus size={16} />}
                {isSubmitting ? (isAdmin ? 'Registering User…' : 'Submitting…') : (isAdmin ? 'Register & Activate User' : 'Submit Application')}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};
