import React, { useEffect, useState } from 'react';

const NAME_PREFIXES = ['dr.', 'atty.', 'engr.', 'mr.', 'ms.', 'mrs.', 'mx.'];

export function getTimeGreeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatHeaderDate(now = new Date()) {
  return now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** First name for header greetings — skips honorifics (Dr., Atty., Mr., …). */
export function getDisplayFirstName(fullName, fallback = 'User') {
  if (!fullName) return fallback;
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  const meaningful = parts.filter((p) => !NAME_PREFIXES.includes(p.toLowerCase().replace(/\.$/, '.')));
  return meaningful[0] || parts[0] || fallback;
}

function getGreeting(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export const TimeGreeting = ({ role = 'User', name = '' }) => {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        color: '#64748b',
        fontSize: '13px',
        fontWeight: '600',
        marginBottom: '6px'
      }}
    >
      {getGreeting(currentTime.getHours())}, {role}{name ? `, ${name}` : ''}!
    </div>
  );
};
