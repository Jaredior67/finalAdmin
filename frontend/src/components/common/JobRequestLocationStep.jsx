import React, { useMemo } from 'react';
import { MapPin, CheckCircle2 } from 'lucide-react';
import { FormField, SelectInput, TextInput } from '../ui/FormField';
import { CAMPUS_ROOM_QR_PRESETS } from './QrCodeScannerModal';

/* ==========================================================================
   Step 1 · Location
   The first step of the job request flow: three cascading selects for the
   rooms already on file, and a free-text field for a room the registry does
   not know yet. Once all three selects are filled the composed path is echoed
   back, so what will actually be filed is visible before submission.
   ========================================================================== */

export const buildBuildingIndex = (campusLocations = []) => {
  const index = new Map();
  // The manual dropdown must NEVER be empty — not even offline. If the campus
  // registry has not loaded, fall back to the tagged rooms we ship with.
  const source =
    campusLocations && campusLocations.length ? campusLocations : CAMPUS_ROOM_QR_PRESETS;

  source.forEach((loc) => {
    if (!loc?.building) return;
    if (!index.has(loc.building)) index.set(loc.building, new Map());
    const floors = index.get(loc.building);
    const floor = loc.floor || '—';
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
  disabled = false
}) => {
  const floors = useMemo(
    () => Array.from(buildingIndex.get(value.building)?.keys() || []),
    [buildingIndex, value.building]
  );
  const rooms = useMemo(
    () => Array.from(buildingIndex.get(value.building)?.get(value.floor) || []).sort(),
    [buildingIndex, value.building, value.floor]
  );

  const composed = joinLocation(value.building, value.floor, value.room);
  const isResolved = Boolean(value.building && value.floor && value.room);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '10px'
        }}
      >
        <MapPin size={17} color="#001f9c" />
        <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
          1 · Location
        </span>
      </div>

      <div style={{ display: 'grid', gap: '14px', alignItems: 'start' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '10px'
          }}
        >
          <FormField label="Building" required htmlFor="jr-bldg" style={{ marginBottom: 0 }}>
            <SelectInput
              id="jr-bldg"
              disabled={disabled}
              value={value.building || ''}
              onChange={(e) => onChange({ building: e.target.value, floor: '', room: '' })}
            >
              <option value="">Select building…</option>
              {Array.from(buildingIndex.keys()).map((b) => (
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
              onChange={(e) => onChange({ ...value, floor: e.target.value, room: '' })}
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
              onChange={(e) => onChange({ ...value, room: e.target.value })}
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
            onChange={(e) => onChange({ ...value, location: e.target.value })}
            placeholder="e.g. CEA Building — 3rd Floor — Room 302"
          />
        </FormField>

        {/* Echo back the exact string that will be filed once all three resolve. */}
        {isResolved && (
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
  );
};
