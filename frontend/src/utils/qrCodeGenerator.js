import QRCode from 'qrcode';

/** Resolve CJS/ESM interop for the `qrcode` library across Node and Vite builds. */
const getQrLib = () => (QRCode?.create ? QRCode : QRCode?.default);

/**
 * Build a deterministic, ISO/IEC 18004 QR SVG path model synchronously.
 * Merges horizontally adjacent dark modules per row for compact, crisp SVGs.
 *
 * @param {string} value
 * @param {{ level?: 'L'|'M'|'Q'|'H', margin?: number }} [options]
 * @returns {{ viewSize: number, pathData: string, moduleCount: number, version: number } | null}
 */
export function buildQrSvgModel(value, { level = 'M', margin = 2 } = {}) {
  const text = String(value || '').trim();
  if (!text) return null;

  try {
    const lib = getQrLib();
    if (!lib?.create) return null;

    const qr = lib.create(text, { errorCorrectionLevel: level });
    const size = qr?.modules?.size || 0;
    if (!size) return null;

    const quiet = Math.max(0, Number(margin) || 0);
    const runs = [];

    for (let r = 0; r < size; r += 1) {
      let c = 0;
      while (c < size) {
        if (!qr.modules.get(r, c)) {
          c += 1;
          continue;
        }
        const start = c;
        while (c < size && qr.modules.get(r, c)) {
          c += 1;
        }
        const len = c - start;
        runs.push(`M${start + quiet} ${r + quiet}h${len}v1h-${len}z`);
      }
    }

    return {
      viewSize: size + quiet * 2,
      pathData: runs.join(''),
      moduleCount: size,
      version: qr.version
    };
  } catch {
    return null;
  }
}

/**
 * Generate a high-resolution PNG data URL for downloading a QR code.
 *
 * @param {string} value
 * @param {{ width?: number, margin?: number, errorCorrectionLevel?: 'L'|'M'|'Q'|'H' }} [options]
 * @returns {Promise<string>}
 */
export async function generateQrPngDataUrl(
  value,
  { width = 600, margin = 2, errorCorrectionLevel = 'H' } = {}
) {
  const text = String(value || '').trim();
  if (!text) return '';

  const lib = getQrLib();
  if (!lib?.toDataURL) return '';
  return lib.toDataURL(text, { width, margin, errorCorrectionLevel });
}
