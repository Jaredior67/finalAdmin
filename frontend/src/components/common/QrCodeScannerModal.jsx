import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { QrCode, Camera, CheckCircle2, RefreshCw, Upload, AlertCircle, List } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { Modal } from './Modal';
import { useData } from '../../context/DataContext';

export const CAMPUS_ROOM_QR_PRESETS = [
  // 1. Administration Building
  {
    qrCodeRef: 'ISATU-ADM-ADMIN-OFFICE',
    building: 'Administration Building',
    floor: '2nd Floor',
    room: 'Office of the Campus Administrator',
    codeLabel: 'ADM-ADMIN'
  },
  {
    qrCodeRef: 'ISATU-ADM-PDAS',
    building: 'Administration Building',
    floor: 'Ground Floor',
    room: 'Planning Development and Auxiliary Services Office',
    codeLabel: 'ADM-PDAS'
  },
  {
    qrCodeRef: 'ISATU-ADM-HRMO',
    building: 'Administration Building',
    floor: 'Ground Floor',
    room: 'Human Resource Management Office (HRMO)',
    codeLabel: 'ADM-HRMO'
  },
  {
    qrCodeRef: 'ISATU-ADM-CASHIER',
    building: 'Administration Building',
    floor: 'Ground Floor',
    room: "Cashier's Office",
    codeLabel: 'ADM-CASHIER'
  },
  {
    qrCodeRef: 'ISATU-ADM-REGISTRAR',
    building: 'Administration Building',
    floor: 'Ground Floor',
    room: 'Office of the Registrar and Admission',
    codeLabel: 'ADM-REG'
  },
  {
    qrCodeRef: 'ISATU-ADM-INSTRUCTION',
    building: 'Administration Building',
    floor: '2nd Floor',
    room: 'Office of Instruction',
    codeLabel: 'ADM-INST'
  },

  // 2. Technology Building
  {
    qrCodeRef: 'ISATU-TECH-MIS',
    building: 'Technology Building',
    floor: 'Ground Floor',
    room: 'Office of the Management Information System (MIS)',
    codeLabel: 'TECH-MIS'
  },
  {
    qrCodeRef: 'ISATU-TECH-BSIT',
    building: 'Technology Building',
    floor: 'Ground Floor',
    room: 'Office of the BSIT Coordinator',
    codeLabel: 'TECH-BSIT'
  },
  {
    qrCodeRef: 'ISATU-TECH-COMPLAB-1',
    building: 'Technology Building',
    floor: 'Ground Floor',
    room: 'Computer Laboratory 1',
    codeLabel: 'TECH-LAB1'
  },
  {
    qrCodeRef: 'ISATU-TECH-DRAFTING',
    building: 'Technology Building',
    floor: '3rd Floor',
    room: 'Drafting & CAD Technology Room',
    codeLabel: 'TECH-CAD'
  },

  // 3. Science Building
  {
    qrCodeRef: 'ISATU-SCI-CHEMLAB',
    building: 'Science Building',
    floor: 'Ground Floor',
    room: 'Chemistry & Biology Laboratory',
    codeLabel: 'SCI-CHEM'
  },
  {
    qrCodeRef: 'ISATU-SCI-BSE',
    building: 'Science Building',
    floor: 'Ground Floor',
    room: 'Office of the BSE Coordinator',
    codeLabel: 'SCI-BSE'
  },

  // 4. HRT Rooms
  {
    qrCodeRef: 'ISATU-HRT-BSHM',
    building: 'HRT Rooms',
    floor: 'Ground Floor',
    room: 'Office of the BSHM Coordinator',
    codeLabel: 'HRT-BSHM'
  },
  {
    qrCodeRef: 'ISATU-HRT-KITCHEN',
    building: 'HRT Rooms',
    floor: 'Ground Floor',
    room: 'Commercial Kitchen & Food Laboratory',
    codeLabel: 'HRT-KTCHN'
  },

  // 5. Multi-purpose Hall
  {
    qrCodeRef: 'ISATU-MPH-SPORTS',
    building: 'Multi-purpose Hall',
    floor: 'Main Hall',
    room: 'Sports Coordinator Office',
    codeLabel: 'MPH-SPORTS'
  },
  {
    qrCodeRef: 'ISATU-MPH-MAIN',
    building: 'Multi-purpose Hall',
    floor: 'Main Hall',
    room: 'Main Gymnasium & Auditorium Stage',
    codeLabel: 'MPH-MAIN'
  },

  // 6. Student Center
  {
    qrCodeRef: 'ISATU-SC-OSAS',
    building: 'Student Center',
    floor: 'Ground Floor',
    room: 'Office of Student Affairs and Services (OSAS)',
    codeLabel: 'SC-OSAS'
  },
  {
    qrCodeRef: 'ISATU-SC-CLINIC',
    building: 'Student Center',
    floor: 'Ground Floor',
    room: 'Medical/Dental Clinic',
    codeLabel: 'SC-CLINIC'
  },
  {
    qrCodeRef: 'ISATU-SC-REPUBLIC',
    building: 'Student Center',
    floor: 'Ground Floor',
    room: 'Office of the Student Republic',
    codeLabel: 'SC-REPUBLIC'
  },

  // 7. Library
  {
    qrCodeRef: 'ISATU-LIB-OFFICE',
    building: 'Library',
    floor: '1st Floor',
    room: "Librarian's Office",
    codeLabel: 'LIB-OFFICE'
  },
  {
    qrCodeRef: 'ISATU-LIB-READING',
    building: 'Library',
    floor: '1st Floor',
    room: 'General Reference & Reading Hall',
    codeLabel: 'LIB-READ'
  },

  // 8. Canteen
  {
    qrCodeRef: 'ISATU-CAN-MAIN',
    building: 'Canteen',
    floor: 'Ground Floor',
    room: 'Main Canteen Dining & Food Stall Area',
    codeLabel: 'CANTEEN'
  },

  // 9. GuardHouse
  {
    qrCodeRef: 'ISATU-GH-MAIN',
    building: 'GuardHouse',
    floor: 'Ground Floor',
    room: 'Main Campus Gate Security Post & CCTV Desk',
    codeLabel: 'GUARD'
  }
];

// Audio beep synthesizer
const playScanChime = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch {}
};

export const QrCodeScannerModal = ({ isOpen, onClose, onScanSuccess }) => {
  const { campusLocations } = useData();
  const [scannedResult, setScannedResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [currentCameraIdx, setCurrentCameraIdx] = useState(0);
  const [scanMode, setScanMode] = useState('camera'); // 'camera' | 'presets' | 'file'
  const [selectedBldgFilter, setSelectedBldgFilter] = useState('all');

  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);
  // Serializes stop/start so they never race
  const cameraOpRef = useRef(null);
  // Stable ref for the scan-success handler to avoid stale closures inside html5-qrcode
  const handleScanSuccessRef = useRef(null);

  const activePresets = useMemo(() => {
    if (campusLocations && campusLocations.length > 0) {
      return campusLocations.map((loc) => ({
        qrCodeRef: loc.qrCodeRef,
        building: loc.building,
        floor: loc.floor,
        room: loc.room,
        codeLabel: loc.qrCodeRef ? loc.qrCodeRef.replace(/^ISATU-/, '') : loc.room
      }));
    }
    return CAMPUS_ROOM_QR_PRESETS;
  }, [campusLocations]);

  const uniqueBuildings = useMemo(() => {
    const set = new Set(activePresets.map((p) => p.building));
    return Array.from(set);
  }, [activePresets]);

  const filteredPresets = useMemo(() => {
    if (selectedBldgFilter === 'all') return activePresets;
    return activePresets.filter((p) => p.building === selectedBldgFilter);
  }, [activePresets, selectedBldgFilter]);

  // Intelligent QR text parser
  const parseQrText = useCallback((rawText) => {
    if (!rawText) return null;
    const text = String(rawText).trim();

    // 1. Direct match on qrCodeRef
    const hitByRef = activePresets.find(
      (p) => p.qrCodeRef && p.qrCodeRef.toLowerCase() === text.toLowerCase()
    );
    if (hitByRef) return hitByRef;

    // 2. Direct match on codeLabel (e.g. ADM-PDAS)
    const hitByLabel = activePresets.find(
      (p) => p.codeLabel && p.codeLabel.toLowerCase() === text.toLowerCase()
    );
    if (hitByLabel) return hitByLabel;

    // 3. JSON payload
    try {
      if (text.startsWith('{') && text.endsWith('}')) {
        const parsed = JSON.parse(text);
        if (parsed.room) {
          return {
            qrCodeRef: parsed.qrCodeRef || `ISATU-${String(parsed.room).replace(/\s+/g, '-').slice(0, 10).toUpperCase()}`,
            building: parsed.building || 'Campus Facility',
            floor: parsed.floor || 'Ground Floor',
            room: parsed.room,
            codeLabel: parsed.codeLabel || 'CUSTOM-QR'
          };
        }
      }
    } catch {}

    // 4. URL query params
    if (text.includes('?') && (text.includes('loc=') || text.includes('qr='))) {
      try {
        const url = new URL(text.startsWith('http') ? text : `http://localhost/${text}`);
        const qrParam = url.searchParams.get('qr') || url.searchParams.get('loc');
        if (qrParam) {
          const hit = activePresets.find((p) => p.qrCodeRef === qrParam || p.codeLabel === qrParam);
          if (hit) return hit;
        }
      } catch {}
    }

    // 5. Delimited "Building — Floor — Room" or "Building - Room"
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

    // 6. Substring room search in registry
    const hitByRoomName = activePresets.find((p) =>
      p.room && text.toLowerCase().includes(p.room.toLowerCase())
    );
    if (hitByRoomName) return hitByRoomName;

    // 7. Generic fallback with scanned text
    return {
      qrCodeRef: `ISATU-${text.replace(/\s+/g, '-').slice(0, 12).toUpperCase()}`,
      building: 'Administration Building',
      floor: 'Ground Floor',
      room: text,
      codeLabel: 'SCANNED-ROOM'
    };
  }, [activePresets]);

  // Stop camera — serialized so start/stop never race
  const stopCamera = useCallback(async () => {
    // Wait for any in-progress operation first
    if (cameraOpRef.current) {
      try { await cameraOpRef.current; } catch {}
    }
    const instance = html5QrCodeRef.current;
    if (!instance) {
      setCameraActive(false);
      return;
    }
    const op = (async () => {
      try {
        if (instance.isScanning) await instance.stop();
      } catch {}
      try { instance.clear(); } catch {}
      html5QrCodeRef.current = null;
      setCameraActive(false);
    })();
    cameraOpRef.current = op;
    await op;
    cameraOpRef.current = null;
  }, []);

  // Handle successful scan
  const handleScanSuccess = useCallback((resultLocation) => {
    if (!resultLocation) return;
    setScannedResult(resultLocation);
    playScanChime();
    stopCamera();
    setTimeout(() => {
      onScanSuccess(resultLocation);
      onClose();
    }, 500);
  }, [stopCamera, onScanSuccess, onClose]);

  // Keep ref in sync so html5-qrcode callback always calls the latest version
  useEffect(() => {
    handleScanSuccessRef.current = handleScanSuccess;
  }, [handleScanSuccess]);

  // Start camera
  const startCamera = useCallback(async (cameraId = null) => {
    await stopCamera();
    setCameraError(null);
    setCameraActive(false);

    try {
      const html5QrCode = new Html5Qrcode('pdas-qr-reader');
      html5QrCodeRef.current = html5QrCode;

      let cameraList = [];
      try {
        cameraList = await Html5Qrcode.getCameras();
        setCameras(cameraList);
      } catch {}

      const config = { fps: 15, aspectRatio: 1.0, disableFlip: false };

      const cameraSource = cameraId
        ? cameraId
        : cameraList && cameraList.length > 0
        ? cameraList[0].id
        : { facingMode: 'environment' };

      await html5QrCode.start(
        cameraSource,
        config,
        (decodedText) => {
          const parsed = parseQrText(decodedText);
          if (parsed) handleScanSuccessRef.current?.(parsed);
        },
        () => { /* ignore per-frame parse errors */ }
      );

      setCameraActive(true);
      setCameraError(null);
    } catch (err) {
      setCameraActive(false);
      html5QrCodeRef.current = null;
      const msg = String(err?.message || err || '');
      if (msg.includes('Permission') || msg.includes('NotAllowedError')) {
        setCameraError('Camera access was denied. Allow camera permissions in your browser and try again.');
      } else if (msg.includes('NotFound') || msg.includes('DevicesNotFoundError')) {
        setCameraError('No camera detected. Use the room list below to select a location.');
      } else {
        setCameraError(`Could not start camera. ${msg || ''} Try selecting a room from the list.`);
      }
    }
  }, [stopCamera, parseQrText]);

  const handleSwitchCamera = useCallback(() => {
    if (cameras.length <= 1) return;
    const nextIdx = (currentCameraIdx + 1) % cameras.length;
    setCurrentCameraIdx(nextIdx);
    startCamera(cameras[nextIdx].id);
  }, [cameras, currentCameraIdx, startCamera]);

  // Handle QR image file upload — uses a separate hidden element so it never
  // conflicts with the live camera div
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // allow re-selecting the same file
    setCameraError(null);

    try {
      const tempScanner = new Html5Qrcode('pdas-qr-reader-file-tmp');
      const decodedText = await tempScanner.scanFile(file, true);
      try { tempScanner.clear(); } catch {}
      const parsed = parseQrText(decodedText);
      if (parsed) {
        handleScanSuccessRef.current?.(parsed);
      } else {
        setCameraError('QR code found but the location could not be matched. Try again with a clearer image.');
      }
    } catch {
      setCameraError('No valid QR code found in the image. Make sure the code is clearly visible.');
    }
  };

  // Lifecycle: start camera when modal opens, always stop when it closes
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    setScannedResult(null);
    setCameraError(null);
    setScanMode('camera');
    setSelectedBldgFilter('all');

    // Small delay so #pdas-qr-reader is in the DOM
    const timer = setTimeout(() => { startCamera(); }, 200);

    return () => {
      clearTimeout(timer);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Stable close handler — always stops camera before calling onClose
  const handleClose = useCallback(() => {
    stopCamera().finally(() => onClose());
  }, [stopCamera, onClose]);

  const switchToCamera = useCallback(() => { setScanMode('camera'); startCamera(); }, [startCamera]);
  const switchToPresets = useCallback(() => { setScanMode('presets'); stopCamera(); }, [stopCamera]);
  const switchToFile = useCallback(() => { setScanMode('file'); stopCamera(); }, [stopCamera]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      onBack={handleClose}
      title="Scan Room QR Tag"
      maxWidth="600px"
    >
      {/* Separate hidden div used only for file scanning — never conflicts with live camera */}
      <div id="pdas-qr-reader-file-tmp" style={{ display: 'none' }} />

      <div>
        {/* Tab Bar */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
          <button
            type="button"
            className={`btn btn-sm ${scanMode === 'camera' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={switchToCamera}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Camera size={14} /> Camera
          </button>
          <button
            type="button"
            className={`btn btn-sm ${scanMode === 'presets' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={switchToPresets}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <List size={14} /> Room List
          </button>
          <button
            type="button"
            className={`btn btn-sm ${scanMode === 'file' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { switchToFile(); fileInputRef.current?.click(); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Upload size={14} /> Upload Image
          </button>
        </div>

        {/* CAMERA SCANNER */}
        {scanMode === 'camera' && (
          <div>
            {/* Suppress ALL html5-qrcode library UI — only our overlay is visible */}
            <style>{`
              #pdas-qr-reader { background: transparent !important; border: none !important; }
              #pdas-qr-reader img,
              #pdas-qr-reader button,
              #pdas-qr-reader select,
              #pdas-qr-reader a,
              #pdas-qr-reader span,
              #pdas-qr-reader__scan_region > img,
              #pdas-qr-reader__dashboard,
              #pdas-qr-reader__dashboard_section,
              #pdas-qr-reader__dashboard_section_csr,
              #pdas-qr-reader__dashboard_section_fsr,
              #pdas-qr-reader__dashboard_section_swaplink,
              #pdas-qr-reader__header_message,
              #pdas-qr-reader__status_span,
              #pdas-qr-reader__camera_selection,
              #pdas-qr-reader__camera_permission_button { display: none !important; }
              #pdas-qr-reader video {
                width: 100% !important; height: 100% !important;
                object-fit: cover !important;
                border: none !important; border-radius: 0 !important;
              }
              #pdas-qr-reader__scan_region {
                border: none !important; box-shadow: none !important;
                background: none !important; outline: none !important;
                position: static !important; min-height: 0 !important;
              }
              @keyframes qr-line {
                0%   { top: 20%; }
                50%  { top: 78%; }
                100% { top: 20%; }
              }
            `}</style>

            {/* Viewfinder */}
            <div style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '4 / 3',
              background: '#111',
              borderRadius: '10px',
              overflow: 'hidden',
            }}>
              {/* Camera feed — html5-qrcode mounts here */}
              <div id="pdas-qr-reader" style={{ position: 'absolute', inset: 0 }} />

              {/* Scan-box overlay — only when camera is live */}
              {cameraActive && !scannedResult && !cameraError && (
                <div style={{
                  position: 'absolute', inset: 0,
                  pointerEvents: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {/* Dark mask — single SVG so there's exactly one element, not 4 divs */}
                  <svg
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <mask id="qr-mask">
                        <rect width="100%" height="100%" fill="white" />
                        <rect x="19%" y="14%" width="62%" height="72%" rx="4" fill="black" />
                      </mask>
                    </defs>
                    <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#qr-mask)" />
                  </svg>

                  {/* Corner brackets — positioned at the scan box corners */}
                  {[
                    { top: '14%', left: '19%', bt: '3px solid #fff', bl: '3px solid #fff', br: 'none', bb: 'none' },
                    { top: '14%', right: '19%', bt: '3px solid #fff', br: '3px solid #fff', bl: 'none', bb: 'none' },
                    { bottom: '14%', left: '19%', bb: '3px solid #fff', bl: '3px solid #fff', bt: 'none', br: 'none' },
                    { bottom: '14%', right: '19%', bb: '3px solid #fff', br: '3px solid #fff', bt: 'none', bl: 'none' },
                  ].map((s, i) => (
                    <div key={i} style={{
                      position: 'absolute',
                      width: 24, height: 24,
                      borderTop: s.bt, borderLeft: s.bl,
                      borderRight: s.br, borderBottom: s.bb,
                    }} />
                  ))}

                  {/* Scan line */}
                  <div style={{
                    position: 'absolute',
                    left: '19%', right: '19%',
                    height: '2px',
                    background: 'rgba(59,130,246,0.85)',
                    boxShadow: '0 0 8px rgba(59,130,246,0.9)',
                    animation: 'qr-line 2s ease-in-out infinite',
                  }} />

                  {/* Hint */}
                  <div style={{
                    position: 'absolute', bottom: '10%',
                    fontSize: '12px', color: 'rgba(255,255,255,0.8)',
                    letterSpacing: '0.02em',
                  }}>
                    Place QR code inside the frame
                  </div>
                </div>
              )}

              {/* Success */}
              {scannedResult && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 20,
                  background: 'rgba(5,150,105,0.93)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#fff', textAlign: 'center', padding: '20px',
                }}>
                  <CheckCircle2 size={46} style={{ marginBottom: '10px' }} />
                  <div style={{ fontSize: '15px', fontWeight: '700' }}>Room identified</div>
                  <div style={{ fontSize: '13px', fontWeight: '600', marginTop: '6px' }}>{scannedResult.room}</div>
                  <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>{scannedResult.building} · {scannedResult.floor}</div>
                </div>
              )}

              {/* Error */}
              {cameraError && !scannedResult && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 15,
                  background: 'rgba(10,14,28,0.97)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#fff', textAlign: 'center', padding: '24px',
                }}>
                  <AlertCircle size={34} color="#f87171" style={{ marginBottom: '10px' }} />
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#fca5a5', maxWidth: '280px', lineHeight: 1.6 }}>
                    {cameraError}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => startCamera()}>
                      <RefreshCw size={13} /> Retry
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={switchToPresets}>
                      Select from Room List
                    </button>
                  </div>
                </div>
              )}

              {/* LIVE chip */}
              {!cameraError && !scannedResult && (
                <div style={{
                  position: 'absolute', top: '8px', right: '8px', zIndex: 10,
                  fontSize: '10px', fontWeight: '700', letterSpacing: '0.05em',
                  color: '#fff', background: 'rgba(0,0,0,0.5)',
                  padding: '2px 8px', borderRadius: '20px',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: cameraActive ? '#22c55e' : '#eab308' }} />
                  {cameraActive ? 'LIVE' : 'Starting…'}
                </div>
              )}
            </div>

            {cameras.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleSwitchCamera}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <RefreshCw size={13} /> Switch Camera ({currentCameraIdx + 1}/{cameras.length})
                </button>
              </div>
            )}
          </div>
        )}

        {/* MODE 2: QUICK ROOM PRESETS (FOR 1-CLICK TESTING) */}
        {scanMode === 'presets' && (
          <div>
            {/* Building Filter Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '10px' }}>
              <button
                type="button"
                onClick={() => setSelectedBldgFilter('all')}
                style={{
                  fontSize: '11.5px',
                  fontWeight: '700',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  border: '1px solid',
                  borderColor: selectedBldgFilter === 'all' ? '#001f9c' : '#cbd5e1',
                  background: selectedBldgFilter === 'all' ? '#001f9c' : '#ffffff',
                  color: selectedBldgFilter === 'all' ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                All Buildings ({activePresets.length})
              </button>
              {uniqueBuildings.map((bldg) => (
                <button
                  key={bldg}
                  type="button"
                  onClick={() => setSelectedBldgFilter(bldg)}
                  style={{
                    fontSize: '11.5px',
                    fontWeight: '700',
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    border: '1px solid',
                    borderColor: selectedBldgFilter === bldg ? '#001f9c' : '#cbd5e1',
                    background: selectedBldgFilter === bldg ? '#001f9c' : '#ffffff',
                    color: selectedBldgFilter === bldg ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {bldg}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
              {filteredPresets.map((preset) => (
                <button
                  key={preset.qrCodeRef}
                  type="button"
                  onClick={() => handleScanSuccess(preset)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '10px',
                    background: 'var(--bg-sunken)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-sunken)'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
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
                      {preset.building} · {preset.floor}
                    </div>

                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Upload mode */}
        {scanMode === 'file' && (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              background: 'var(--bg-sunken)',
              border: '2px dashed #cbd5e1',
              borderRadius: '12px',
              cursor: 'pointer'
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={34} color="#001f9c" style={{ margin: '0 auto 10px auto' }} />
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>
              Click to select a QR code image
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
              PNG, JPG or WEBP
            </div>
            {cameraError && (
              <div style={{ marginTop: '12px', fontSize: '12.5px', color: '#b91c1c', fontWeight: '600' }}>
                {cameraError}
              </div>
            )}
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        {/* Footer */}
        <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
};
