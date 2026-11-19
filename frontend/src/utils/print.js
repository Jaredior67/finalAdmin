/**
 * Printing helpers shared by every page that prints an official document,
 * QR label sheet or evaluation form.
 *
 * The application shell (sidebar, navbar, modals, toasts) is not meant to be
 * printed. Print-only content is rendered into a direct child of <body> by
 * <PrintPortal>, and the stylesheet removes every other body child for print.
 * `printDocument()` waits for that portal to exist, for images (QR codes,
 * ISAT U logos, photos) to finish decoding, and for fonts to settle before it
 * opens the browser print dialog — otherwise Chrome/Safari print an empty
 * sheet or a label whose QR image is still blank.
 */

const PRINT_PORTAL_SELECTOR = '.print-portal';
const DEFAULT_TIMEOUT_MS = 2500;

const nextFrame = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

/** Waits for every <img> inside `root` to load (or fail) so nothing prints blank. */
export function waitForImages(root, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (!root || typeof root.querySelectorAll !== 'function') return Promise.resolve();
  const images = Array.from(root.querySelectorAll('img'));
  if (images.length === 0) return Promise.resolve();

  return Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            img.removeEventListener('load', finish);
            img.removeEventListener('error', finish);
            resolve();
          };
          img.addEventListener('load', finish, { once: true });
          img.addEventListener('error', finish, { once: true });
          setTimeout(finish, timeoutMs);
        })
    )
  );
}

async function waitForPortal(timeoutMs = 1500) {
  if (typeof document === 'undefined') return null;
  const started = Date.now();
  let portal = document.querySelector(PRINT_PORTAL_SELECTOR);
  while (!portal && Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 40));
    portal = document.querySelector(PRINT_PORTAL_SELECTOR);
  }
  return portal;
}

/**
 * Prints the content mounted in <PrintPortal>.
 * Call it directly from a click handler after setting the state that mounts
 * the portal: the helper waits for React to commit the DOM before printing.
 */
export async function printDocument(root = null) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const target = root || (await waitForPortal());
  if (target) {
    // Let React finish committing the portal children into the host.
    await new Promise((resolve) => setTimeout(resolve, 80));
    await waitForImages(target);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
    } catch {
      /* older browsers */
    }
    // Give the browser one paint with the final layout (and loaded images).
    await nextFrame();
  }
  window.print();
}

/**
 * Prints a live DOM node without the portal. Useful for canvas editors where
 * the visible sheet is the document. The node is cloned into a print host so
 * the on-screen editor chrome (toolbars, zoom/transform) is excluded.
 */
export async function printElement(node) {
  if (!node) return printDocument();

  const host = document.createElement('div');
  host.className = 'print-portal print-portal--clone';
  host.setAttribute('aria-hidden', 'true');

  const clone = node.cloneNode(true);
  clone.querySelectorAll?.('[contenteditable]')?.forEach((el) => {
    el.removeAttribute('contenteditable');
  });
  clone.style.transform = 'none';
  clone.style.boxShadow = 'none';
  clone.style.margin = '0 auto';
  clone.style.width = '100%';
  clone.style.minHeight = '0';

  host.appendChild(clone);
  document.body.appendChild(host);

  const cleanup = () => {
    window.removeEventListener('afterprint', cleanup);
    if (host.isConnected) host.remove();
  };
  window.addEventListener('afterprint', cleanup);

  await printDocument(host);
  // Guard against browsers that never fire `afterprint`.
  setTimeout(() => {
    if (host.isConnected) host.remove();
  }, 60000);
}
