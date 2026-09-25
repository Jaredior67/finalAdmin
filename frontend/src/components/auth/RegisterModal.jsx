import React, { useState } from 'react';
import { UserPlus, Upload, CheckCircle2, AlertCircle, Briefcase, GraduationCap, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useData } from '../../context/DataContext';

export const RegisterModal = ({ isOpen, onClose, onSwitchToLogin }) => {
  const { registerUser, offices, departments } = useData();

  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    userType: 'Faculty', // 'Faculty' | 'Staff'
    department: 'College of Engineering & Architecture (CEA)',
    office: 'Office of the Campus Administrator',
    contactNumber: '',
    gender: 'Male',
    address: '',
    birthday: '',
    age: '',
    gmail: '',
    password: ''
  });

  const [idFile, setIdFile] = useState(null);
  const [idPreview, setIdPreview] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Auto-calculate age when birthday changes
  const handleBirthdayChange = (e) => {
    const bdayStr = e.target.value;
    let calculatedAge = '';
    if (bdayStr) {
      const birthDate = new Date(bdayStr);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age >= 0 && age <= 120) {
        calculatedAge = age;
      }
    }
    setFormData(prev => ({
      ...prev,
      birthday: bdayStr,
      age: calculatedAge
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setIdFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setIdPreview(reader.result);
      };
      reader.readAsDataURL(file);
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
    if (!formData.contactNumber.trim()) {
      setError('Contact Number is required.');
      return;
    }
    if (formData.userType === 'Staff' && !formData.office.trim()) {
      setError('Please select your administrative office.');
      return;
    }
    if (formData.password.length < 6) {
      setError('Create a password with at least 6 characters.');
      return;
    }
    if (!idPreview && !idFile) {
      setError('Please attach a clear photo of your ISAT U ID for PDAS verification.');
      return;
    }

    setError('');
    try {
      await registerUser({
        ...formData,
        role: formData.userType.toLowerCase(),
        idFileName: idFile ? idFile.name : 'Attached_Photo_of_ID.jpg',
        idPreviewUrl: idPreview,
        idPhotoUrl: idPreview
      });
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError.message || 'Registration could not be submitted.');
    }
  };

  const handleResetAndClose = () => {
    setSubmitted(false);
    setError('');
    setFormData({
      firstName: '',
      middleName: '',
      lastName: '',
      userType: 'Faculty',
      department: 'College of Engineering & Architecture (CEA)',
      office: 'Office of the Campus Administrator',
      contactNumber: '',
      gender: 'Male',
      address: '',
      birthday: '',
      age: '',
      gmail: '',
      password: ''
    });
    setIdFile(null);
    setIdPreview(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleResetAndClose}
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
                For campus facility security, your account must be <strong>reviewed and confirmed by the PDAS Admin</strong> before you can sign in. The administrator will verify your institutional ID photo and activate your account.
              </p>
              <div style={{ fontSize: '11.5px', color: '#b45309', marginTop: '6px', fontWeight: '600' }}>
                ✓ Once approved, you can log in immediately using <strong>{formData.gmail}</strong>.
              </div>
            </div>
          </div>

          <div style={{
            background: '#f8fafc',
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
              <div>• Email: <strong>{formData.gmail}</strong></div>
              <div>• Contact: <strong>{formData.contactNumber}</strong></div>
              <div>• Gender: <strong>{formData.gender}</strong></div>
              <div>• Age: <strong>{formData.age || '—'}</strong></div>
              <div style={{ gridColumn: '1 / -1' }}>• Address: <strong>{formData.address || '—'}</strong></div>
              {formData.userType === 'Faculty' ? (
                <div style={{ gridColumn: '1 / -1' }}>• Department: <strong>{formData.department}</strong></div>
              ) : (
                <div style={{ gridColumn: '1 / -1' }}>• Office: <strong>{formData.office}</strong></div>
              )}
              <div style={{ gridColumn: '1 / -1' }}>• Institutional ID: <strong style={{ color: '#059669' }}>✓ Photo Attached for Review</strong></div>
            </div>
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
            Register your institutional account for facility maintenance requests. Submissions are reviewed by the <strong>PDAS Administrator</strong>.
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
                    onChange={() => setFormData({ ...formData, userType: 'Faculty', department: departments[0] || 'College of Engineering & Architecture (CEA)' })}
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

          {/* 3. Birthday, Age & Address */}
          <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Birthday</label>
              <input
                type="date"
                className="form-input"
                value={formData.birthday}
                onChange={handleBirthdayChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Age</label>
              <input
                type="number"
                className="form-input"
                placeholder="Auto-calculated"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                min={15}
                max={100}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Complete Address</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. P.D. Monfort South, Dumangas, Iloilo"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
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

          {/* 5. Email & Contact Number */}
          <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
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
              <label className="form-label">Mobile Contact Number *</label>
              <input
                type="text"
                className="form-input"
                placeholder="+63 9XX XXX XXXX"
                value={formData.contactNumber}
                onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Create Password *</label>
            <div className="input-with-icon-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="At least 6 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                minLength={6}
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
              background: '#f8fafc',
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
                      ✓ Photo attached (Click to replace)
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
                    Accepts PNG, JPG, JPEG (Max 10MB)
                  </div>
                </div>
              )}
            </div>
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
              >
                <UserPlus size={16} />
                Submit Application
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};
