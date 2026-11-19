import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, X } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { flushOutbox, outboxSize, clearOutbox } from '../../utils/outbox';

/**
 * OfflineBanner — fixed bottom banner shown when the browser has no
 * connection or has pending offline requests in the outbox.
 */
export function OfflineBanner() {
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(
    () => (typeof navigator !== 'undefined' ? navigator.onLine : true)
  );
  const [pending, setPending] = useState(() => outboxSize());
  const [dismissed, setDismissed] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const refresh = useCallback(() => setPending(outboxSize()), []);

  const drainOutbox = useCallback(async (isAuto = false) => {
    if (isSyncing) return;
    const waiting = outboxSize();
    if (waiting === 0) {
      setPending(0);
      return;
    }
    setIsSyncing(true);
    try {
      const { sent, duplicates, failed, lastError } = await flushOutbox();
      const remaining = outboxSize();
      setPending(remaining);

      if (sent > 0 || duplicates > 0) {
        window.dispatchEvent(new CustomEvent('fixit:outbox-synced', { detail: { sent, duplicates } }));
        const parts = [];
        if (sent) parts.push(`${sent} sent`);
        if (duplicates) parts.push(`${duplicates} already filed`);
        toast(`Synced ${parts.join(', ')}.`, 'success');
      } else if (failed > 0 && !isAuto) {
        toast(`Could not send: ${lastError || 'Server error.'}`, 'error');
      }
    } catch (e) {
      if (!isAuto) toast(`Sync error: ${e.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, toast]);

  // Attempt auto-flush when online on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine && outboxSize() > 0) {
      drainOutbox(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      drainOutbox(true);
    };
    const goOffline = () => {
      setIsOnline(false);
      refresh();
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('storage', refresh);
    refresh();
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh, drainOutbox]);

  if (dismissed || (isOnline && pending === 0)) return null;

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
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: '700', color: '#92400e' }}>
          {isOnline
            ? `${pending} request${pending === 1 ? '' : 's'} waiting to send`
            : 'No connection'}
        </div>
        <div style={{ fontSize: '13px', fontWeight: '400', color: '#78716c', lineHeight: 1.5 }}>
          {isOnline
            ? 'Stored locally on this device. Click Retry send or Discard to dismiss.'
            : pending > 0
              ? `Requests you file now are saved on this device (${pending} waiting) and sent when the connection is back.`
              : 'Requests you file now are saved on this device and sent when the connection is back.'}
          {' '}For an emergency, contact the campus administrator directly.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {isOnline && (
          <button
            type="button"
            disabled={isSyncing}
            onClick={() => drainOutbox(false)}
            className="btn btn-secondary btn-sm"
          >
            {isSyncing ? 'Sending…' : 'Retry send'}
          </button>
        )}
        {pending > 0 && (
          <button
            type="button"
            onClick={() => {
              clearOutbox();
              setPending(0);
              toast('Cleared offline queue.', 'info');
            }}
            className="btn btn-secondary btn-sm"
            style={{ color: '#b91c1c' }}
          >
            Discard
          </button>
        )}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss banner"
          title="Dismiss"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#b45309',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
