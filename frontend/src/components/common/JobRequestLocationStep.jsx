import React, { useMemo, useState, useEffect } from 'react';
import { MapPin, CheckCircle2, QrCode, ScanLine, X } from 'lucide-react';
import { FormField, SelectInput, TextInput } from '../ui/FormField';
import { CAMPUS_ROOM_QR_PRESETS, QrCodeScannerModal } from './QrCodeScannerModal';

/* ==========================================================================
   Step 1 · Location
   The first step of the job request flow: three cascading selects for the
   rooms already on file, and a free-text field for a room the registry does
   not know yet. Once all three selects are filled the composed path is echoed
   back, so what will actually be filed is visible before submission.

   A "Scan Room QR Code" button is embedded here — scanning automatically
   populates building, floor, room, location, and qrCodeRef. Manual dropdown
   selection remains fully available as a fallback.
   ========================================================================== */

export const buildBuildingIndex = (campusLocations = []) => {
  const index = new Map();
  // Merge campus registry with room presets so every known room is in the index
  const source = [
    ...(Array.isArray(campusLocations) ? campusLocations : []),
    ...CAMPUS_ROOM_QR_PRESETS
  ];

  source.forEach((loc) => {
    if (!loc?.building || !loc?.room) return;
    if (!index.has(loc.building)) index.set(loc.building, new Map());
    const floors = index.get(loc.building);
    const floor = loc.floor || 'Ground Floor';
    if (!floors.has(floor)) floors.set(floor, new Set());
    floors.get(floor).add(loc.room);
  });
  return index;
};

export const joinLocation = (building, floor, room) =>
  [building, floor, room].filter(Boolean).join(' — ');

export const JobRequestLocationStep = ({
  buildingIndex,
  value,
  onChange,
  error,
  disabled = false,
  autoOpenScanner = false
}) => {
  const [isScannerOpen, setIsScannerOpen] = useState(Boolean(autoOpenScanner));
  // qrBadge: truthy when last fill came from a scan (for the "scanned via QR" badge)
  const [qrBadge, setQrBadge] = useState(null);

  useEffect(() => {
    if (autoOpenScanner) {
      setIsScannerOpen(true);
    }
  }, [autoOpenScanner]);

  const allBuildings = useMemo(() => {
    const list = Array.from(buildingIndex.keys());
    if (value.building && !list.includes(value.building)) {
      list.push(value.building);
    }
    return list;
  }, [buildingIndex, value.building]);

  const floors = useMemo(() => {
    const list = Array.from(buildingIndex.get(value.building)?.keys() || []);
    if (value.floor && !list.includes(value.floor)) {
      list.push(value.floor);
    }
    return list;
  }, [buildingIndex, value.building, value.floor]);

  const rooms = useMemo(() => {
    const list = Array.from(buildingIndex.get(value.building)?.get(value.floor) || []).sort();
    if (value.room && !list.includes(value.room)) {
      list.push(value.room);
    }
    return list;
  }, [buildingIndex, value.building, value.floor, value.room]);

  const composed = joinLocation(value.building, value.floor, value.room);
  const isResolved = Boolean(value.building && value.floor && value.room);

  /* When a QR code is successfully scanned, auto-fill every location field. */
  const handleScanSuccess = (scanData) => {
    const building = scanData.building || '';
    const floor    = scanData.floor    || '';
    const room     = scanData.room     || '';
    const location = scanData.location || joinLocation(building, floor, room);
    const qrCodeRef = scanData.qrCodeRef || '';
    onChange({ building, floor, room, location, qrCodeRef });
    setQrBadge({ building, floor, room, qrCodeRef });
    setIsScannerOpen(false);
  };

  /* Clearing the QR badge (re-scan / manual edit) resets the badge only;
     the selected values remain so the user can adjust them if needed. */
  const clearQrBadge = () => setQrBadge(null);

  /* Any manual dropdown change dismisses the badge (user is overriding). */
  const patchAndClearBadge = (patch) => {
    setQrBadge(null);
    onChange(patch);
  };

  return (
    <>
      <div>
        {/* ── Section header + QR scan button ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
              1 Location
            </span>
          </div>

          {/* Scan Room QR button — embedded inside the form */}
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            disabled={disabled}
            title="Scan the room's QR tag to auto-fill location"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
              fontWeight: '600',
              fontSize: '13px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.borderColor = '#94a3b8';
                e.currentTarget.style.background = 'var(--bg-hover)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.background = '#ffffff';
            }}
          >
            <QrCode size={15} color="#475569" />
            <span>Scan room QR</span>
          </button>
        </div>

        {/* ── QR confirmation badge (shown after a successful scan) ── */}
        {qrBadge && (
          <div
            role="status"
            aria-live="polite"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              padding: '10px 14px',
              marginBottom: '12px',
              borderRadius: '10px',
              background: '#f0fdf4',
              border: '1.5px solid #86efac',
              fontSize: '13px',
              fontWeight: '600',
              color: '#15803d'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              <ScanLine size={16} style={{ flexShrink: 0, color: '#16a34a' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Scanned via QR: {joinLocation(qrBadge.building, qrBadge.floor, qrBadge.room) || qrBadge.qrCodeRef}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                title="Scan a different QR code"
                style={{
                  fontSize: '12px', fontWeight: '700', color: '#2563eb',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '2px 6px', borderRadius: '6px',
                  textDecoration: 'underline', lineHeight: 1
                }}
              >
                Re-scan
              </button>
              <button
                type="button"
                onClick={clearQrBadge}
                title="Dismiss badge (values are kept)"
                style={{
                  display: 'flex', alignItems: 'center',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#6b7280', padding: '2px'
                }}
                aria-label="Dismiss QR badge"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gap: '14px', alignItems: 'start' }}>
          <div className="jr-location-selects">
            <FormField label="Building" required htmlFor="jr-bldg" style={{ marginBottom: 0 }}>
              <SelectInput
                id="jr-bldg"
                disabled={disabled}
                value={value.building || ''}
                onChange={(e) => patchAndClearBadge({ building: e.target.value, floor: '', room: '', location: e.target.value })}
              >
                <option value="">Select building…</option>
                {allBuildings.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField label="Floor" required htmlFor="jr-floor" style={{ marginBottom: 0 }}>
              <SelectInput
                id="jr-floor"
                disabled={disabled || !value.building}
                value={value.floor || ''}
                onChange={(e) => patchAndClearBadge({ ...value, floor: e.target.value, room: '', location: joinLocation(value.building, e.target.value, '') })}
              >
                <option value="">{value.building ? 'Select floor…' : 'Pick a building first'}</option>
                {floors.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField label="Room / Area" required htmlFor="jr-room" style={{ marginBottom: 0 }}>
              <SelectInput
                id="jr-room"
                disabled={disabled || !value.floor}
                value={value.room || ''}
                onChange={(e) => patchAndClearBadge({ ...value, room: e.target.value, location: joinLocation(value.building, value.floor, e.target.value) })}
              >
                <option value="">{value.floor ? 'Select room…' : 'Pick a floor first'}</option>
                {rooms.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </SelectInput>
            </FormField>
          </div>

          {/* Free-text escape hatch for rooms that are not yet in the registry */}
          <FormField
            label="Or type the location"
            htmlFor="jr-location"
            error={error}
            hint="Used exactly as it appears on the official form."
            style={{ marginBottom: 0 }}
          >
            <TextInput
              id="jr-location"
              disabled={disabled}
              value={value.location || ''}
              onChange={(e) => { clearQrBadge(); onChange({ ...value, location: e.target.value }); }}
              placeholder="e.g. CEA Building — 3rd Floor — Room 302"
            />
          </FormField>

          {/* Echo back the exact string that will be filed once all three resolve. */}
          {isResolved && !qrBadge && (
            <div
              role="status"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
                fontSize: '12.5px',
                color: '#047857',
                fontWeight: '600',
                lineHeight: 1.45
              }}
            >
              <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{composed}</span>
            </div>
          )}
        </div>
      </div>

      {/* QR scanner modal — local to this step, so it works in every form
          (Standard Request Form, Urgent Report) without any prop threading. */}
      <QrCodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </>
  );
};
