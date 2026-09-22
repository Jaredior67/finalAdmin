import React from 'react';

/**
 * SkipLink — WCAG 2.4.1 bypass block. Visible only on keyboard focus.
 * Target: id="main-content" on each role shell's <main>.
 */
export function SkipLink({ target = 'main-content' }) {
  return (
    <a href={`#${target}`} className="skip-link">
      Skip to main content
    </a>
  );
}
