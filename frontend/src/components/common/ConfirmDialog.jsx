import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone. Please confirm if you wish to proceed.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
  isLoading = false
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" maxWidth="440px">
      <div style={{ textAlign: 'center', padding: '8px 4px 16px 4px' }}>
        <div style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          background: isDanger ? '#fef2f2' : '#fffbeb',
          color: isDanger ? '#dc2626' : '#d97706',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <AlertTriangle size={28} />
        </div>

        <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: '0 0 8px 0' }}>
          {title}
        </h3>

        <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: '1.5', margin: '0 0 24px 0' }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isLoading}
            style={{ flex: 1, padding: '10px 16px', borderRadius: '8px', fontSize: '13.5px', fontWeight: '600' }}
          >
            {cancelText}
          </button>

          <button
            type="button"
            className={isDanger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: '700',
              background: isDanger ? '#dc2626' : '#001f9c',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};
