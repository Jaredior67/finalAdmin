import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { flushOutbox, outboxSize } from '../../utils/outbox';

/**
 * OfflineBanner — fixed bottom banner shown when the browser has no
 * connection.
 *
 * The copy used to promise that "submissions will sync once connectivity
 * returns" while nothing queued anything, so a request filed offline was
 * refused by the network and lost. utils/outbox.js is the queue that promise
 * referred to: entries are held on the device with an idempotency key and sent
 * when the connection returns, so a retry cannot file the same request twice.
 * A request the server actively rejects is not queued, because sending it again
 * would only be refused again.
 */
export function OfflineBanner() {
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(
    () => (typeof navigator !== 'undefined' ? navigator.onLine : true)
  );
  const [pending, setPending] = useState(() => outboxSize());
  const wasOffline = useRef(false);

  const refresh = useCallback(() => setPending(outboxSize()), []);

  useEffect(() => {
    const goOnline = async () => {
      setIsOnline(true);
      if (!wasOffline.current) return;
      wasOffline.current = false;

      const waiting = outboxSize();
      if (waiting === 0) {
        toast('Back online.', 'info');
        return;
      }
      // Drain the outbox the moment the connection is usable again.
      const { sent, duplicates, failed } = await flushOutbox();
      setPending(outboxSize());
      const parts = [];
      if (sent) parts.push(`${sent} sent`);
      if (duplicates) parts.push(`${duplicates} already filed`);
      if (failed) parts.push(`${failed} still waiting`);
      toast(
        parts.length ? `Back online. ${parts.join(', ')}.` : 'Back online.',
        failed ? 'error' : 'info'
      );
    };
    const goOffline = () => { wasOffline.current = true; setIsOnline(false); refresh(); };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('storage', refresh);
    refresh();
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh, toast]);

  if (isOnline && pending === 0) return null;

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
        <div style={{ fontSize: '14px', fontWeight: '700', color: isOnline ? '#92400e' : '#92400e' }}>
          {isOnline
            ? `${pending} request${pending === 1 ? '' : 's'} waiting to send`
            : 'No connection'}
        </div>
        <div style={{ fontSize: '13px', fontWeight: '400', color: '#78716c', lineHeight: 1.5 }}>
          {isOnline
            ? 'They are still on this device. Use Retry send to try again.'
            : pending > 0
              ? `Requests you file now are saved on this device (${pending} waiting) and sent when the connection is back.`
              : 'Requests you file now are saved on this device and sent when the connection is back.'}
          {' '}For an emergency, contact the campus administrator directly.
        </div>
      </div>

      {isOnline && (
        <button
          type="button"
          onClick={async () => {
            const { sent, duplicates, failed } = await flushOutbox();
            setPending(outboxSize());
            if (!sent && !duplicates && !failed) toast('Nothing left to send.', 'info');
            else {
              const parts = [];
              if (sent) parts.push(`${sent} sent`);
              if (duplicates) parts.push(`${duplicates} already filed`);
              if (failed) parts.push(`${failed} failed`);
              toast(parts.join(', '), failed ? 'error' : 'info');
            }
          }}
          className="btn btn-secondary btn-sm"
          style={{ flexShrink: 0 }}
        >
          Retry send
        </button>
      )}
    </div>
  );
}
