import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const TONE = {
  success: { Icon: CheckCircle2, bg: '#ecfdf5', border: '#a7f3d0', color: '#047857' },
  error: { Icon: AlertCircle, bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' },
  info: { Icon: Info, bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message, tone = 'success', opts = {}) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev.slice(-3), { id, message, tone: TONE[tone] ? tone : 'info' }]);
    if (opts.duration !== 0) {
      setTimeout(() => dismiss(id), opts.duration || 4000);
    }
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: 'fixed',
          right: '16px',
          bottom: '16px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          width: 'min(360px, calc(100vw - 32px))',
        }}
      >
        {toasts.map(t => {
          const tone = TONE[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                background: tone.bg,
                border: `1px solid ${tone.border}`,
                borderRadius: '8px',
                boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.18)',
                padding: '12px 14px',
                color: tone.color,
                fontSize: '13.5px',
                fontWeight: '500',
                lineHeight: 1.45,
              }}
            >
              <tone.Icon size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ flex: 1, minWidth: 0 }}>{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                style={{ background: 'none', border: 'none', color: tone.color, cursor: 'pointer', padding: '2px', display: 'flex' }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
