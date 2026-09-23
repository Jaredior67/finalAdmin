import React, { useState, useEffect, useCallback } from 'react';
import { checkBackendHealth } from '../../backend/api';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

const POLL_INTERVAL_MS = 15000; // re-check every 15 seconds
const INITIAL_DELAY_MS = 1200;  // wait a moment before first check so app renders first

/**
 * BackendStatus — sticky top banner that shows when the backend API server is
 * not running. Disappears automatically when the backend comes back online.
 * Polls every 15 seconds so it recovers without needing a page refresh.
 */
export function BackendStatus() {
  const [status, setStatus] = useState('checking'); // 'checking' | 'online' | 'offline'
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    const result = await checkBackendHealth();
    setStatus(result.online ? 'online' : 'offline');
    if (result.online) setDismissed(false); // auto-restore if it comes back
    setChecking(false);
  }, []);

  useEffect(() => {
    // Slight delay so the initial page render isn't blocked
    const initialTimer = setTimeout(check, INITIAL_DELAY_MS);
    const poll = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(poll);
    };
  }, [check]);

  // Don't render anything while we're still checking on the first load,
  // or if the backend is confirmed online, or if the user dismissed it
  if (status === 'checking' || status === 'online') return null;
  if (dismissed) return null;

  return (
    <div
      id="backend-status-banner"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
        color: '#fef2f2',
        padding: '0',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        fontFamily: 'var(--font-body, system-ui, sans-serif)',
        animation: 'slideDownBanner 0.3s ease',
      }}
    >
      <style>{`
        @keyframes slideDownBanner {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        #backend-status-banner a {
          color: #fca5a5;
          text-decoration: underline;
          cursor: pointer;
        }
        #backend-status-banner a:hover { color: #fff; }
      `}</style>

      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        {/* Icon */}
        <div style={{
          flexShrink: 0,
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <AlertTriangle size={17} color="#fca5a5" />
        </div>

        {/* Message */}
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ fontWeight: '700', fontSize: '13.5px', marginBottom: '2px' }}>
            ⚠️ Backend server is not running
          </div>
          <div style={{ fontSize: '12px', color: '#fca5a5', lineHeight: '1.5' }}>
            Login and all features will fail until the backend is started.
            {' '}
            <strong style={{ color: '#fff' }}>Fix:</strong>
            {' '}Double-click <code style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 5px', borderRadius: '4px' }}>start-dev.bat</code>
            {' '}in the project folder, or run{' '}
            <code style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 5px', borderRadius: '4px' }}>npm run dev:backend</code>
            {' '}in the <code style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 5px', borderRadius: '4px' }}>backend/</code> folder.
          </div>
        </div>

        {/* Retry button */}
        <button
          onClick={check}
          disabled={checking}
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.3)',
            background: 'rgba(255,255,255,0.1)',
            color: '#fff',
            fontSize: '12px',
            fontWeight: '600',
            cursor: checking ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (!checking) e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
        >
          <RefreshCw size={13} style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }} />
          {checking ? 'Checking...' : 'Retry'}
        </button>

        {/* Dismiss */}
        <button
          onClick={() => setDismissed(true)}
          title="Dismiss (banner will reappear if still offline)"
          style={{
            flexShrink: 0,
            background: 'none',
            border: 'none',
            color: '#fca5a5',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            borderRadius: '4px',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#fca5a5'; }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
