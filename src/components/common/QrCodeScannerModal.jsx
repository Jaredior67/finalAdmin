import React, { useState, useEffect } from 'react';
import { QrCode, Camera, CheckCircle2 } from 'lucide-react';
import { Modal } from './Modal';

export const CAMPUS_ROOM_QR_PRESETS = [
  {
    qrCodeRef: 'ISATU-DUM-CEA-302',
    building: 'College of Engineering & Architecture (CEA)',
    floor: '3rd Floor',
    room: 'Room 302 (Electronics & Circuits Lab)',
    codeLabel: 'CEA-302'
  },
  {
    qrCodeRef: 'ISATU-DUM-CEA-204',
    building: 'College of Engineering & Architecture (CEA)',
    floor: '2nd Floor',
    room: 'Room 204 (Lecture Room)',
    codeLabel: 'CEA-204'
  },
  {
    qrCodeRef: 'ISATU-DUM-ADMIN-SERVER',
    building: 'Administration Hall',
    floor: 'Ground Floor',
    room: 'Server Room & MIS Data Center',
    codeLabel: 'ADMIN-SERVER'
  },
  {
    qrCodeRef: 'ISATU-DUM-ADMIN-201',
    building: 'Administration Hall',
    floor: '2nd Floor',
    room: 'Executive Boardroom & Director Office',
    codeLabel: 'ADMIN-EXEC'
  },
  {
    qrCodeRef: 'ISATU-DUM-LIB-201',
    building: 'University Library Services',
    floor: '2nd Floor',
    room: 'Faculty & Student Reading Wing Restroom',
    codeLabel: 'LIB-RESTROOM'
  },
  {
    qrCodeRef: 'ISATU-DUM-LAB-105',
    building: 'Industrial Technology & Workshops',
    floor: 'Ground Floor',
    room: 'Tech Lab 105 (Woodworking & Drafting)',
    codeLabel: 'TECH-105'
  },
  {
    qrCodeRef: 'ISATU-DUM-CAS-101',
    building: 'College of Arts & Sciences (CAS)',
    floor: '1st Floor',
    room: 'Room 101 (Chemistry & Biology Laboratory)',
    codeLabel: 'CAS-LAB-101'
  },
  {
    qrCodeRef: 'ISATU-DUM-GYM-01',
    building: 'University Gymnasium & Athletic Center',
    floor: 'Main Court',
    room: 'Bleachers & Main Scoreboard Electrical Box',
    codeLabel: 'GYM-MAIN'
  }
];

export const QrCodeScannerModal = ({ isOpen, onClose, onScanSuccess }) => {
  const [scannedResult, setScannedResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setScannedResult(null);
    }
  }, [isOpen]);

  const handleSelectPreset = (preset) => {
    setScannedResult(preset);
    setTimeout(() => {
      onScanSuccess(preset);
      onClose();
    }, 450);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Scan Campus Room QR Code"
      maxWidth="540px"
    >
      <div>
        {/* Scanner Viewport */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '220px',
          background: '#090d16',
          borderRadius: '14px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid #1e293b',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8)'
        }}>
          {/* Target Reticle */}
          <div style={{
            width: '150px',
            height: '150px',
            border: '2px dashed rgba(59, 130, 246, 0.7)',
            borderRadius: '16px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* Corner brackets */}
            <div style={{ position: 'absolute', top: '-2px', left: '-2px', width: '18px', height: '18px', borderTop: '4px solid #3b82f6', borderLeft: '4px solid #3b82f6', borderRadius: '4px 0 0 0' }} />
            <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '18px', height: '18px', borderTop: '4px solid #3b82f6', borderRight: '4px solid #3b82f6', borderRadius: '0 4px 0 0' }} />
            <div style={{ position: 'absolute', bottom: '-2px', left: '-2px', width: '18px', height: '18px', borderBottom: '4px solid #3b82f6', borderLeft: '4px solid #3b82f6', borderRadius: '0 0 0 4px' }} />
            <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '18px', height: '18px', borderBottom: '4px solid #3b82f6', borderRight: '4px solid #3b82f6', borderRadius: '0 0 4px 0' }} />

            {/* Laser scanning line animation */}
            <div style={{
              position: 'absolute',
              width: '90%',
              height: '2px',
              background: '#38bdf8',
              boxShadow: '0 0 12px #38bdf8',
              top: '50%',
              transform: 'translateY(-50%)'
            }} />

            {scannedResult ? (
              <div style={{ textAlign: 'center', background: 'rgba(5, 150, 105, 0.9)', padding: '10px 16px', borderRadius: '10px', color: '#ffffff' }}>
                <CheckCircle2 size={32} style={{ margin: '0 auto 4px auto' }} />
                <div style={{ fontSize: '13px', fontWeight: '800' }}>QR Code Recognized!</div>
              </div>
            ) : (
              <Camera size={36} color="rgba(255, 255, 255, 0.4)" />
            )}
          </div>

          <div style={{
            position: 'absolute',
            bottom: '10px',
            fontSize: '11px',
            color: '#94a3b8',
            background: 'rgba(15, 23, 42, 0.85)',
            padding: '4px 12px',
            borderRadius: '12px'
          }}>
            Simulating live camera QR code detection on door/wall tags
          </div>
        </div>

        {/* Quick Room Preset Selector for physical simulation */}
        <div style={{ marginTop: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Simulate Campus Door / Room QR Tags:
            </span>
            <span style={{ fontSize: '11px', color: '#001f9c', fontWeight: '700' }}>
              1-Click Scan
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {CAMPUS_ROOM_QR_PRESETS.map((preset) => (
              <button
                key={preset.qrCodeRef}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease'
                }}
              >
                <div style={{
                  padding: '6px',
                  borderRadius: '6px',
                  background: '#001f9c',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <QrCode size={16} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {preset.room}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {preset.building}
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#001f9c', marginTop: '2px' }}>
                    TAG: <code>{preset.codeLabel}</code>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
};
