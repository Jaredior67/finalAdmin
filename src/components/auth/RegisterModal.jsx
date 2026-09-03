import React, { useState } from 'react';
import { UserPlus, Upload, CheckCircle2, AlertCircle, Image as ImageIcon, Briefcase, GraduationCap, IdCard } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useData } from '../../context/DataContext';

export const RegisterModal = ({ isOpen, onClose, onSwitchToLogin }) => {
  const { registerUser, offices, departments } = useData();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    gmail: '',
    password: '',
    userType: 'Faculty', // 'Faculty' | 'Staff'
    department: 'College of Engineering & Architecture',
    designation: 'Instructor / Faculty Member',
    contactNumber: '',
    idNumber: ''
  });

  const [idFile, setIdFile] = useState(null);
  const [idPreview, setIdPreview] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('First name and Last name are required.');
      return;
    }
    if (!formData.gmail.trim() || !formData.gmail.includes('@')) {
      setError('Please provide a valid institutional or Gmail address.');
      return;
    }
    if (!formData.idNumber.trim()) {
      setError('Valid ISAT U Employee ID / Institutional ID Number is required.');
      return;
    }
    if (!formData.contactNumber.trim()) {
      setError('Contact Number is required.');
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
    registerUser({
      ...formData,
      department: formData.userType === 'Faculty' ? formData.department : formData.department,
      designation: formData.userType === 'Staff' ? formData.designation : 'Faculty Member',
      idFileName: idFile ? idFile.name : 'Attached_Photo_of_ID.jpg',
      idPreviewUrl: idPreview
    });

    setSubmitted(true);
  };

  const handleResetAndClose = () => {
    setSubmitted(false);
    setError('');
    setFormData({
      firstName: '',
      lastName: '',
      middleName: '',
      gmail: '',
      password: '',
      userType: 'Faculty',
      department: 'College of Engineering & Architecture (CEA)',
      designation: 'Instructor / Faculty Member',
      contactNumber: '',
      idNumber: ''
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
      maxWidth="640px"
    >
      {submitted ? (
        <div style={{ textAlign: 'center', padding: '24px 12px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#ecfdf5',
            color: '#059669',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <CheckCircle2 size={36} />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
            Registration Submitted to PDAS!
          </h3>
          <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: 1.5, maxWidth: '480px', margin: '0 auto 20px auto' }}>
            Your account application as <strong>{formData.userType}</strong> ({formData.department}) has been routed to the <strong>PDAS Administrative Office</strong> for verification.
          </p>

          <div style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '10px',
            padding: '16px',
            fontSize: '12.5px',
            color: '#1e40af',
            marginBottom: '24px',
            textAlign: 'left'
          }}>
            <div style={{ fontWeight: '700', marginBottom: '6px' }}>Application Summary:</div>
            <div>• Full Name: <strong>{formData.firstName} {formData.middleName ? formData.middleName + ' ' : ''}{formData.lastName}</strong></div>
            <div>• Valid ID Number: <strong>{formData.idNumber}</strong></div>
            <div>• Email: <strong>{formData.gmail}</strong></div>
            <div>• Classification: <strong>{formData.userType}</strong></div>
            <div>• {formData.userType === 'Faculty' ? 'College / Department' : 'Office / Unit'}: <strong>{formData.department}</strong></div>
            <div>• Contact Number: <strong>{formData.contactNumber}</strong></div>
            <div>• Attached ID Photo: <strong style={{ color: '#059669' }}>✓ Verified Attached</strong></div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleResetAndClose}
            style={{ minWidth: '160px' }}
          >
            Done
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
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
              <label className="form-label">
                Middle Name <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>(optional)</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Cruz"
                value={formData.middleName}
                onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
              />
            </div>
          </div>

          {/* 2. ID Number & Classification */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Valid ID Number *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. ISATU-EMP-2024-089"
                value={formData.idNumber}
                onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                required
              />
            </div>

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
                    onChange={() => setFormData({ ...formData, userType: 'Faculty', department: departments[0] })}
                    style={{ display: 'none' }}
                  />
                  <GraduationCap size={16} />
                  Faculty
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
                    onChange={() => setFormData({ ...formData, userType: 'Staff', department: offices[0] })}
                    style={{ display: 'none' }}
                  />
                  <Briefcase size={16} />
                  Staff
                </label>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Create Password *</label>
            <input
              type="password"
              className="form-input"
              placeholder="At least 6 characters"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              minLength={6}
              required
            />
          </div>

          {/* 3. Department / Office Dropdown */}
          <div className="form-group">
            <label className="form-label">
              {formData.userType === 'Faculty' ? 'College / Academic Department *' : 'Campus Office / Service Unit *'}
            </label>
            <select
              className="form-select"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              required
            >
              {(formData.userType === 'Faculty' ? departments : offices).map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* 4. Email & Contact Number */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Institutional Email / Gmail *</label>
              <input
                type="email"
                className="form-input"
                placeholder="e.g. username@gmail.com"
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

          {/* 5. Attach photo of ID */}
          <div className="form-group">
            <label className="form-label">
              Attach Clear Photo of Valid ID *
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

