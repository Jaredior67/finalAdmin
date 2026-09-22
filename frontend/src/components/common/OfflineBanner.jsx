import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff } from 'lucide-react';

const DRAFT_PREFIX = 'fixit_draft_';

const countQueuedDrafts = () => {
  try {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DRAFT_PREFIX)) {
        try {
          const parsed = JSON.parse(localStorage.getItem(key));
          const hasContent = parsed && parsed.data && Object.values(parsed.data).some(v =>
            v !== null && v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0)
          );
          if (hasContent) count += 1;
        } catch {
          count += 1;
        }
      }
    }
    return count;
  } catch {
    return 0;
  }
};

import { useToast } from '../ui/Toast';

/**
 * OfflineBanner — fixed bottom banner shown when the browser loses network
 * connectivity. Reassures the user that form drafts are kept locally and
 * that submissions will sync once connectivity returns.
 */
export function OfflineBanner() {
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(
    () => (typeof navigator !== 'undefined' ? navigator.onLine : true)
  );
  const [queuedCount, setQueuedCount] = useState(0);
  const wasOffline = useRef(false);

  const refreshQueue = useCallback(() => setQueuedCount(countQueuedDrafts()), []);

  useEffect(() => {
    const goOnline = () => {
      // Toast only on a genuine offline -> online transition (not first mount).
      if (wasOffline.current) toast('Back online — drafts are intact and new submissions will file normally.', 'info');
      wasOffline.current = false;
      setIsOnline(true);
    };
    const goOffline = () => { wasOffline.current = true; setIsOnline(false); refreshQueue(); };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('storage', refreshQueue);
    refreshQueue();
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('storage', refreshQueue);
    };
  }, [refreshQueue]);

  if (isOnline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: '16px',
        zIndex: 90,
        width: 'min(640px, calc(100vw - 32px))',
        background: '#fffbeb',
        border: '1px solid #fde68a',
        borderLeft: '4px solid #d97706',
        borderRadius: '8px',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.18)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <span
        style={{
          width: '36px',
          height: '36px',
          flex: '0 0 36px',
          borderRadius: '8px',
          background: '#fef3c7',
          color: '#b45309',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <WifiOff size={18} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: '700', color: '#92400e' }}>
          You are offline
        </div>
        <div style={{ fontSize: '13px', fontWeight: '400', color: '#78716c', lineHeight: 1.5 }}>
          {queuedCount > 0
            ? `${queuedCount} draft${queuedCount === 1 ? '' : 's'} saved on this device. Submissions will sync once connectivity returns.`
            : 'New submissions are saved on this device and will sync once connectivity returns.'}
        </div>
      </div>
    </div>
  );
}
