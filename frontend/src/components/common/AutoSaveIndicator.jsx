import React from 'react';
import { WifiOff, Check, Trash2 } from 'lucide-react';

export const AutoSaveIndicator = ({ 
  isOnline = true, 
  lastSaved = null, 
  hasDraft = false, 
  onClearDraft = null,
  compact = false 
}) => {
  if (!hasDraft && isOnline) {
    return null;
  }

  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: compact ? '4px 10px' : '6px 14px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '500',
      background: !isOnline ? '#fef3c7' : '#f0fdf4',
      border: `1px solid ${!isOnline ? '#fcd34d' : '#bbf7d0'}`,
      color: !isOnline ? '#92400e' : '#166534',
      transition: 'all 0.2s ease',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      margin: '6px 0'
    }}>
      {!isOnline ? (
        <>
          <WifiOff size={14} style={{ color: '#d97706' }} />
          <span><strong>Offline Mode</strong> — Changes safely saved to device</span>
        </>
      ) : (
        <>
          <Check size={14} style={{ color: '#16a34a' }} />
          <span>
            Draft autosaved {lastSaved ? `at ${formatTime(lastSaved)}` : 'locally'}
          </span>
          {onClearDraft && (
            <button
              type="button"
              onClick={onClearDraft}
              title="Clear saved draft and reset fields"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                marginLeft: '4px'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; }}
            >
              <Trash2 size={12} /> Clear draft
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default AutoSaveIndicator;
