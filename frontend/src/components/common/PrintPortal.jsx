import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders print-only content into a direct child of <body>.
 *
 * Why: the app shell is wrapped in #root together with the page. The old
 * approach (`.jr-print-only` inside the page + `visibility:hidden` everywhere
 * else) kept the whole application in the print layout, which produced blank
 * trailing pages and printed nothing at all from modals. Mounting the print
 * document next to <body> lets the print stylesheet remove the entire app with
 * a single `display:none`, so exactly one clean document is printed.
 *
 * The host is `display:none` on screen, so nothing here is visible until the
 * browser enters its print preview.
 */
export const PrintPortal = ({ active = true, children }) => {
  const [host, setHost] = useState(null);

  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;

    const node = document.createElement('div');
    node.className = 'print-portal';
    node.setAttribute('aria-hidden', 'true');
    document.body.appendChild(node);
    setHost(node);

    return () => {
      setHost(null);
      node.remove();
    };
  }, [active]);

  if (!active || !host) return null;
  return createPortal(children, host);
};
