import React, { useState } from 'react';
import { UserPlus, Upload, CheckCircle2, AlertCircle, Briefcase, GraduationCap, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useData } from '../../context/DataContext';
import { apiGetRegistrationStatus } from '../../backend/api';
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

export const RegisterModal = ({ isOpen, onClose, onSwitchToLogin }) => {
  const { registerUser, offices, departments } = useData();

  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    userType: 'Faculty', // 'Faculty' | 'Staff'
    department: 'BSIT',
    office: 'Office of the Campus Administrator',
    gender: 'Male',
    gmail: '',
    password: ''
  });
  const [confirmPassword, setConfirmPassword] = useState('');

  const [idFile, setIdFile] = useState(null);
  const [idPreview, setIdPreview] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // RA 10173 (Data Privacy Act) consent. The server refuses a registration with
  // no consent timestamp, so this must be an explicit opt-in rather than a
  // default-on box.
  const [consentGiven, setConsentGiven] = useState(false);
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
      const objectUrl = URL.createObjectURL(file);
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
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Image could not be decoded.'));
      };
      img.src = objectUrl;
    });

  const handleFileChange = async (e) => {
    const input = e.target;
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please attach an image file (PNG, JPG, or JPEG).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('That photo is over 10MB. Please attach a smaller image.');
      return;
    }
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
    if (!formData.gmail.trim() || !formData.gmail.includes('@')) {
      setError('Please provide a valid institutional or Gmail address.');
      return;
    }
    if (formData.userType === 'Staff' && !formData.office.trim()) {
      setError('Please select your administrative office.');
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
      setError('Please attach a clear photo of your ISAT U ID for PDAS verification.');
      return;
    }
    if (!consentGiven) {
      setError('Please accept the Data Privacy notice before submitting your application.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await registerUser({
        ...formData,
        role: formData.userType.toLowerCase(),
        idFileName: idFile ? idFile.name : 'Attached_Photo_of_ID.jpg',
        idPreviewUrl: idPreview,
        idPhotoUrl: idPreview,
        // Timestamped at the moment the applicant ticks the box; the server
        // records it on registration_requests and copies it to users on approval.
        consentAt: consentGiven ? new Date().toISOString() : null
      });
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError.message || 'Registration could not be submitted.');
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
      userType: 'Faculty',
      department: 'BSIT',
      office: 'Office of the Campus Administrator',
      gender: 'Male',
      gmail: '',
      password: ''
    });
    setIdFile(null);
    setIdPreview(null);
    setConsentGiven(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleResetAndClose}
      onBack={handleResetAndClose}
      title="ISAT U Dumangas Account Registration"
      maxWidth="680px"
    >
      {submitted ? (
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
              <div>• Name: <strong>{formData.firstName} {formData.middleName ? formData.middleName + ' ' : ''}{formData.lastName}</strong></div>
              <div>• Role: <strong>{formData.userType}</strong></div>
              <div style={{ gridColumn: '1 / -1' }}>• Email: <strong>{formData.gmail}</strong></div>
              <div>• Gender: <strong>{formData.gender}</strong></div>
              {formData.userType === 'Faculty' ? (
                <div>• Department: <strong>{formData.department}</strong></div>
              ) : (
                <div>• Office: <strong>{formData.office}</strong></div>
              )}
              <div style={{ gridColumn: '1 / -1' }}>• Institutional ID: <strong style={{ color: '#059669' }}>Photo attached for review</strong></div>
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
                placeholder="you@isatu.edu.ph"
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
      ) : (
        <form onSubmit={handleSubmit}>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
            Register to file facility requests. PDAS reviews each submission.
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
          <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
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
          </div>

          {/* 2. Classification & Gender */}
          <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Account Classification *</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <label style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '9px 10px',
                  borderRadius: '8px',
                  border: formData.userType === 'Faculty' ? '2px solid #001f9c' : '1px solid #cbd5e1',
                  background: formData.userType === 'Faculty' ? '#eff6ff' : '#ffffff',
                  cursor: 'pointer',
                  fontWeight: formData.userType === 'Faculty' ? '700' : '500',
                  color: formData.userType === 'Faculty' ? '#001f9c' : '#475569',
                  fontSize: '13px'
                }}>
                  <input
                    type="radio"
                    name="userType"
                    value="Faculty"
                    checked={formData.userType === 'Faculty'}
                    onChange={() => setFormData({ ...formData, userType: 'Faculty', department: departments[0] || 'BSIT' })}
                    style={{ display: 'none' }}
                  />
                  <GraduationCap size={16} />
                  Faculty Member
                </label>

                <label style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '9px 10px',
                  borderRadius: '8px',
                  border: formData.userType === 'Staff' ? '2px solid #001f9c' : '1px solid #cbd5e1',
                  background: formData.userType === 'Staff' ? '#eff6ff' : '#ffffff',
                  cursor: 'pointer',
                  fontWeight: formData.userType === 'Staff' ? '700' : '500',
                  color: formData.userType === 'Staff' ? '#001f9c' : '#475569',
                  fontSize: '13px'
                }}>
                  <input
                    type="radio"
                    name="userType"
                    value="Staff"
                    checked={formData.userType === 'Staff'}
                    onChange={() => setFormData({ ...formData, userType: 'Staff', office: offices[0] || 'Office of the Campus Administrator' })}
                    style={{ display: 'none' }}
                  />
                  <Briefcase size={16} />
                  Administrative Staff
                </label>
              </div>
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



          {/* 4. Department (Faculty) / Office (Staff) Dropdown */}
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
          ) : (
            <div className="form-group">
              <label className="form-label">
                Office *
              </label>
              <select
                className="form-select"
                value={formData.office}
                onChange={(e) => setFormData({ ...formData, office: e.target.value })}
                required
              >
                {offices.map((office) => (
                  <option key={office} value={office}>{office}</option>
                ))}
              </select>
            </div>
          )}

          {/* 5. Email */}
          <div className="form-group">
            <label className="form-label">Institutional Email / Gmail *</label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. username@isatu.edu.ph"
              value={formData.gmail}
              onChange={(e) => setFormData({ ...formData, gmail: e.target.value })}
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

          {/* 6. Attach photo of ID */}
          <div className="form-group">
            <label className="form-label">
              Attach Clear Photo of Valid ISAT U ID *
            </label>
            <div style={{
              border: '2px dashed #cbd5e1',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
              background: 'var(--bg-sunken)',
              position: 'relative',
              cursor: 'pointer'
            }}>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0,
                  cursor: 'pointer',
                  width: '100%',
                  height: '100%'
                }}
              />

              {idPreview ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                  <img
                    src={idPreview}
                    alt="ID preview"
                    style={{ width: '80px', height: '52px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                      {idFile ? idFile.name : 'Attached_Photo_of_ID.jpg'}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#059669', fontWeight: '600' }}>
                      Photo attached. Click to replace.
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#eff6ff', color: '#001f9c', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                    <Upload size={18} />
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                    Click or drag & drop to attach ID photo
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                    Accepts PNG, JPG, JPEG (Max 10MB). Photos are resized automatically.
                  </div>
                </div>
              )}
            </div>
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
                Data Privacy Notice (RA 10173) *
              </span>
              I consent to the collection and processing of the personal information in
              this application — my name, contact details, and ID photo — for identity
              verification and account administration by the PDAS Administrator of ISAT U
              Dumangas. The information is used only for those purposes and is not shared
              outside the institution.
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
                {isSubmitting ? 'Submitting…' : 'Submit Application'}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};
