import React from 'react';
import { RealQrCode } from './RealQrCode';
import { getSystemQrUrl } from '../../utils/qrLocationResolver';

/**
 * Printable sheet of campus QR door/equipment tags.
 *
 * Rendered inside <PrintPortal>, so the CSS in index.css controls the paper
 * layout (A4, two tags per row, rows never split across pages). Each tag
 * carries a real, synchronously rendered ISO/IEC 18004 vector QR code.
 */
export const QrLabelPrintSheet = ({ locations = [], qrImages = {} }) => (
  <div className={`qr-label-sheet${locations.length === 1 ? ' qr-label-sheet--single' : ''}`}>
    {locations.map((loc) => {
      const qrPayload = getSystemQrUrl(loc.qrCodeRef);
      const fallbackSrc = qrImages[loc.qrCodeRef];
      return (
        <div className="qr-label" key={loc.id || loc.qrCodeRef}>
          <div className="qr-label__head">
            <span>ISAT U DUMANGAS CAMPUS</span>
            <span className="qr-label__badge">PDAS FIXIT</span>
          </div>

          <div className="qr-label__body">
            <div className="qr-label__code">
              {qrPayload ? (
                <RealQrCode
                  value={qrPayload}
                  size={120}
                  margin={2}
                  level="M"
                  className="qr-label__svg"
                  title={`QR code for ${loc.room || loc.qrCodeRef}`}
                />
              ) : fallbackSrc ? (
                <img src={fallbackSrc} alt={`QR code for ${loc.room || loc.qrCodeRef}`} />
              ) : (
                <div className="qr-label__code-empty">No QR tag</div>
              )}
            </div>

            <div className="qr-label__meta">
              <div className="qr-label__room">{loc.room || 'Unnamed room'}</div>
              <div className="qr-label__line">{loc.building || 'Campus facility'}</div>
              <div className="qr-label__line">{loc.floor || 'Ground Floor'}</div>
              <div className="qr-label__tag">{loc.qrCodeRef || 'NO-TAG'}</div>
            </div>
          </div>

          <div className="qr-label__foot">
            Scan to file a maintenance request
            <span className="qr-label__dot">•</span>
            PDAS FIXIT
          </div>
        </div>
      );
    })}
  </div>
);
