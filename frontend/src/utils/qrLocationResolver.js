import { CAMPUS_ROOM_QR_PRESETS } from '../components/common/QrCodeScannerModal';

/**
 * Resolves a QR code or scanned URL into a structured campus location.
 * Handles:
 * - Direct full URLs: "http://localhost:5173/?qr=ISATU-TECH-COMPLAB-1"
 * - Hash URLs: "http://localhost:5173/#/?qr=ISATU-TECH-COMPLAB-1"
 * - Raw tag strings: "ISATU-TECH-COMPLAB-1" or "TECH-COMPLAB-1"
 * - JSON string: '{"building":"Technology Building","room":"Computer Lab 1"}'
 * - Delimited strings: "Technology Building — Ground Floor — Computer Lab 1"
 */
export function resolveLocationFromQr(rawInput, campusLocations = []) {
  if (!rawInput) return null;
  const text = String(rawInput).trim();
  if (!text) return null;

  // Combine live database locations and static presets
  const allKnown = [
    ...(Array.isArray(campusLocations) ? campusLocations : []),
    ...CAMPUS_ROOM_QR_PRESETS
  ].map((loc) => ({
    id: loc.id,
    qrCodeRef: loc.qrCodeRef || loc.qr_code || '',
    building: loc.building || 'Campus Facility',
    floor: loc.floor || 'Ground Floor',
    room: loc.room || loc.description || '',
    codeLabel: loc.codeLabel || (loc.qrCodeRef ? loc.qrCodeRef.replace(/^ISATU-/, '') : loc.room || '')
  }));

  const findMatch = (key) => {
    if (!key) return null;
    const clean = String(key).trim().toLowerCase();
    if (!clean) return null;

    // 1. Exact match on qrCodeRef
    const hitRef = allKnown.find((l) => l.qrCodeRef && l.qrCodeRef.toLowerCase() === clean);
    if (hitRef) return hitRef;

    // 2. Exact match on codeLabel (e.g. TECH-COMPLAB-1)
    const hitLabel = allKnown.find((l) => l.codeLabel && l.codeLabel.toLowerCase() === clean);
    if (hitLabel) return hitLabel;

    // 3. Match on room name
    const hitRoom = allKnown.find((l) => l.room && l.room.toLowerCase() === clean);
    if (hitRoom) return hitRoom;

    return null;
  };

  // Check 1: Is it a URL? Extract query params from search OR hash
  if (text.includes('?') || text.startsWith('http://') || text.startsWith('https://')) {
    try {
      const url = new URL(text.startsWith('http') ? text : `http://localhost/${text.replace(/^#\/?/, '')}`);
      let targetRef = url.searchParams.get('qr') || url.searchParams.get('loc') || url.searchParams.get('location');

      if (!targetRef && url.hash && url.hash.includes('?')) {
        const hashSearch = url.hash.substring(url.hash.indexOf('?'));
        const hashParams = new URLSearchParams(hashSearch);
        targetRef = hashParams.get('qr') || hashParams.get('loc') || hashParams.get('location');
      }

      if (targetRef) {
        const found = findMatch(targetRef);
        if (found) return found;
      }
    } catch {}
  }

  // Check 2: Direct match on raw input
  const directHit = findMatch(text);
  if (directHit) return directHit;

  // Check 3: JSON payload
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.qrCodeRef || parsed.qr || parsed.room) {
        const hit = findMatch(parsed.qrCodeRef || parsed.qr || parsed.room);
        if (hit) return hit;
        return {
          qrCodeRef: parsed.qrCodeRef || `ISATU-${String(parsed.room || 'CUSTOM').slice(0, 10).toUpperCase()}`,
          building: parsed.building || 'Campus Facility',
          floor: parsed.floor || 'Ground Floor',
          room: parsed.room || 'Custom Location',
          codeLabel: parsed.codeLabel || 'CUSTOM-QR'
        };
      }
    } catch {}
  }

  // Check 4: Delimited text: "Building — Floor — Room" or "Building - Room"
  const parts = text.split(/\s+[—–-]\s+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return {
      qrCodeRef: `ISATU-${parts[2].replace(/\s+/g, '-').slice(0, 10).toUpperCase()}`,
      building: parts[0],
      floor: parts[1],
      room: parts.slice(2).join(' — '),
      codeLabel: 'SCANNED-TAG'
    };
  } else if (parts.length === 2) {
    return {
      qrCodeRef: `ISATU-${parts[1].replace(/\s+/g, '-').slice(0, 10).toUpperCase()}`,
      building: parts[0],
      floor: 'Ground Floor',
      room: parts[1],
      codeLabel: 'SCANNED-TAG'
    };
  }

  // Fallback: Substring match on room
  const partialHit = allKnown.find((l) => l.room && text.toLowerCase().includes(l.room.toLowerCase()));
  if (partialHit) return partialHit;

  return null;
}

/**
 * Returns the value encoded into a printed QR tag.
 *
 * - On a real host (school server / LAN IP / tunnel) this is a full URL, so any
 *   phone camera opens the app with the location pre-filled.
 * - On localhost the URL would only work on this one computer, so the raw tag
 *   is encoded instead — the in-app scanner resolves raw tags directly, and the
 *   printed code still decodes to the room's reference.
 * - `VITE_PUBLIC_APP_URL` overrides the origin for hosted deployments.
 */
export function getSystemQrUrl(qrCodeRef) {
  const tag = String(qrCodeRef || '').trim();
  if (!tag) return '';
  if (typeof window === 'undefined') return tag;

  let envBase = '';
  try {
    envBase = String(import.meta.env?.VITE_PUBLIC_APP_URL || '').trim();
  } catch {}

  const base = (envBase || `${window.location.origin}${window.location.pathname}`).replace(/[?#].*$/, '');

  let hostname = '';
  try {
    hostname = new URL(base, window.location.href).hostname;
  } catch {}

  const isLoopback = !hostname || /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(hostname);
  if (!envBase && isLoopback) return tag;

  return `${base}${base.includes('?') ? '&' : '?'}qr=${encodeURIComponent(tag)}`;
}

/**
 * Detects if the user landed on the system with a scanned QR code in the URL
 * or if one is pending in sessionStorage after login.
 */
export function getPendingScannedQr() {
  if (typeof window === 'undefined') return null;

  // 1. Check window.location.search (?qr=... or ?loc=...)
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const fromSearch = searchParams.get('qr') || searchParams.get('loc') || searchParams.get('location');
    if (fromSearch) return fromSearch.trim();
  } catch {}

  // 2. Check window.location.hash (#/?qr=... or #new-request?qr=...)
  try {
    const hash = window.location.hash || '';
    if (hash.includes('?')) {
      const hashQuery = hash.substring(hash.indexOf('?'));
      const hashParams = new URLSearchParams(hashQuery);
      const fromHash = hashParams.get('qr') || hashParams.get('loc') || hashParams.get('location');
      if (fromHash) return fromHash.trim();
    }
  } catch {}

  // 3. Check sessionStorage
  try {
    const saved = sessionStorage.getItem('fixit_pending_qr_code');
    if (saved) return saved.trim();
  } catch {}

  return null;
}

/**
 * Saves a pending scanned QR tag into sessionStorage across login redirects.
 */
export function savePendingScannedQr(qr) {
  if (typeof window === 'undefined' || !qr) return;
  try {
    sessionStorage.setItem('fixit_pending_qr_code', String(qr).trim());
  } catch {}
}

/**
 * Strips the ?qr= parameter from the browser URL address bar without clearing sessionStorage.
 */
export function stripQrUrlParam() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    let changed = false;
    for (const key of ['qr', 'loc', 'location']) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (url.hash && url.hash.includes('?')) {
      const [hashBase, hashQuery] = url.hash.split('?');
      const hashParams = new URLSearchParams(hashQuery);
      for (const key of ['qr', 'loc', 'location']) {
        if (hashParams.has(key)) {
          hashParams.delete(key);
          changed = true;
        }
      }
      const remainingHash = hashParams.toString();
      url.hash = remainingHash ? `${hashBase}?${remainingHash}` : hashBase;
    }
    if (changed) {
      window.history.replaceState({}, document.title, url.toString());
    }
  } catch {}
}

/**
 * Clears the pending scanned QR from sessionStorage and cleanly strips
 * the ?qr= parameter from the browser URL address bar without a reload.
 */
export function clearPendingScannedQr() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem('fixit_pending_qr_code');
  } catch {}
  stripQrUrlParam();
}
