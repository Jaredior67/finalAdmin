import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { QrCode, Camera, CheckCircle2, RefreshCw, Upload, AlertCircle, List, Search } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import jsQR from 'jsqr';
import { Modal } from './Modal';
import { useData } from '../../context/DataContext';
import { resolveLocationFromQr } from '../../utils/qrLocationResolver';

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
  {
    qrCodeRef: 'ISATU-ADM-RESEARCH-OFFICE',
    building: 'Administration Building',
    floor: '2nd Floor',
    room: 'Research Office',
    codeLabel: 'ADM-RESEARCH'
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

/**
 * Helper to safely load an image file into an HTMLImageElement with clean object-URL lifecycle.
 */
function loadImageElement(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * High-resilience QR decoder for mobile camera captures and uploaded image files.
 * Modern mobile phones take photos at 12MP–48MP (4000x3000 to 8000x6000 px).
 * Standard QR decoders fail or crash on raw phone images due to canvas memory limits
 * and tiny QR size within massive frames.
 *
 * This function handles:
 * 1. Hardware BarcodeDetector API (instant on Android Chrome / Edge)
 * 2. Multi-resolution scaled canvas passes (1200px, 900px, 600px)
 * 3. Center-crop detection (50%–65% where users frame the QR code)
 * 4. High-contrast / binarization filter (cuts through room glare and shadows)
 * 5. jsQR pure-memory decoding with inverted pattern attempts
 * 6. Html5Qrcode fallback with off-screen element
 */
async function decodeQrFromImageFile(file) {
  if (!file) return null;

  // 1. Try modern native BarcodeDetector API
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats?.().catch(() => ['qr_code']);
      if (!formats || formats.includes('qr_code')) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        let sourceBitmap = null;
        if (typeof createImageBitmap === 'function') {
          try { sourceBitmap = await createImageBitmap(file); } catch {}
        }
        if (!sourceBitmap) {
          sourceBitmap = await loadImageElement(file);
        }
        if (sourceBitmap) {
          const barcodes = await detector.detect(sourceBitmap);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            return String(barcodes[0].rawValue).trim();
          }
        }
      }
    } catch {
      // Continue to canvas-based decoders
    }
  }

  // 2. Multi-pass canvas scanning with jsQR
  const img = await loadImageElement(file);
  if (img && (img.naturalWidth || img.width) > 0 && (img.naturalHeight || img.height) > 0) {
    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;

    const passes = [
      { type: 'full', maxDim: 1200, contrast: false },
      { type: 'crop', cropRatio: 0.65, maxDim: 900, contrast: false },
      { type: 'full', maxDim: 900, contrast: true },
      { type: 'crop', cropRatio: 0.50, maxDim: 700, contrast: true },
      { type: 'full', maxDim: 600, contrast: false }
    ];

    for (const p of passes) {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) continue;

        let sx = 0, sy = 0, sw = origW, sh = origH;
        if (p.type === 'crop') {
          const cropW = Math.floor(origW * (p.cropRatio || 0.65));
          const cropH = Math.floor(origH * (p.cropRatio || 0.65));
          sx = Math.floor((origW - cropW) / 2);
          sy = Math.floor((origH - cropH) / 2);
          sw = cropW;
          sh = cropH;
        }

        const scale = Math.min(1, (p.maxDim || 1000) / Math.max(sw, sh));
        const targetW = Math.max(160, Math.floor(sw * scale));
        const targetH = Math.max(160, Math.floor(sh * scale));

        canvas.width = targetW;
        canvas.height = targetH;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

        const imgData = ctx.getImageData(0, 0, targetW, targetH);
        if (p.contrast) {
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const val = Math.min(255, Math.max(0, (lum - 128) * 1.55 + 128));
            d[i] = val;
            d[i + 1] = val;
            d[i + 2] = val;
          }
        }

        const code = jsQR(imgData.data, targetW, targetH, {
          inversionAttempts: 'attemptBoth'
        });

        if (code && code.data && String(code.data).trim()) {
          return String(code.data).trim();
        }
      } catch {
        // Continue to next pass
      }
    }
  }

  // 3. Fallback: Html5Qrcode.scanFile
  try {
    const tempScanner = new Html5Qrcode('pdas-qr-reader-file-tmp');
    const result = await tempScanner.scanFile(file, false);
    try { tempScanner.clear(); } catch {}
    if (result && String(result).trim()) {
      return String(result).trim();
    }
  } catch {}

  return null;
}

export const QrCodeScannerModal = ({ isOpen, onClose, onScanSuccess }) => {
  const { campusLocations } = useData();
  const [scannedResult, setScannedResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [currentCameraIdx, setCurrentCameraIdx] = useState(0);
  const [scanMode, setScanMode] = useState('camera'); // 'camera' | 'presets' | 'file'
  const [selectedBldgFilter, setSelectedBldgFilter] = useState('all');
  const [roomSearchQuery, setRoomSearchQuery] = useState('');

  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);
  const mobileCameraInputRef = useRef(null);
  // Serializes stop/start so they never race
  const cameraOpRef = useRef(null);
  // Stable ref for the scan-success handler to avoid stale closures inside html5-qrcode
  const handleScanSuccessRef = useRef(null);

  const activePresets = useMemo(() => {
    /* Merge the seeded campus presets with the admin's registry. The registry
       wins on duplicate tags, and the presets stay available so a tag printed
       before a room was registered still resolves after a registry reset. */
    const map = new Map();
    CAMPUS_ROOM_QR_PRESETS.forEach((preset) => {
      if (preset?.qrCodeRef) map.set(preset.qrCodeRef, preset);
    });
    (campusLocations || []).forEach((loc) => {
      const ref = loc?.qrCodeRef || loc?.qr_code;
      if (!ref) return;
      map.set(ref, {
        qrCodeRef: ref,
        building: loc.building,
        floor: loc.floor,
        room: loc.room,
        codeLabel: loc.codeLabel || ref.replace(/^ISATU-/, '')
      });
    });
    return Array.from(map.values());
  }, [campusLocations]);

  const uniqueBuildings = useMemo(() => {
    const set = new Set(activePresets.map((p) => p.building));
    return Array.from(set);
  }, [activePresets]);

  const filteredPresets = useMemo(() => {
    let list = activePresets;
    if (selectedBldgFilter !== 'all') {
      list = list.filter((p) => p.building === selectedBldgFilter);
    }
    const q = roomSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        (p.room && p.room.toLowerCase().includes(q)) ||
        (p.building && p.building.toLowerCase().includes(q)) ||
        (p.codeLabel && p.codeLabel.toLowerCase().includes(q)) ||
        (p.floor && p.floor.toLowerCase().includes(q))
      );
    }
    return list;
  }, [activePresets, selectedBldgFilter, roomSearchQuery]);

  // Intelligent QR text parser
  const parseQrText = useCallback((rawText) => {
    if (!rawText) return null;
    const text = String(rawText).trim();

    // 0. Unified campus location & QR URL resolver
    const resolved = resolveLocationFromQr(text, campusLocations || []);
    if (resolved) return resolved;

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
  }, [activePresets, campusLocations]);

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

  // Handle successful scan: play sound, stop camera, and pass location to onScanSuccess
  // Note: do NOT call onClose() here! onScanSuccess opens the Job Request Form,
  // and calling onClose() triggers closeAll() which cancels the form immediately.
  const handleScanSuccess = useCallback((resultLocation) => {
    if (!resultLocation) return;
    setScannedResult(resultLocation);
    playScanChime();
    stopCamera();
    setTimeout(() => {
      if (onScanSuccess) {
        onScanSuccess(resultLocation);
      }
    }, 350);
  }, [stopCamera, onScanSuccess]);

  // Keep ref in sync so html5-qrcode callback always calls the latest version
  useEffect(() => {
    handleScanSuccessRef.current = handleScanSuccess;
  }, [handleScanSuccess]);

  // Start camera
  const startCamera = useCallback(async (cameraId = null, isExplicitUserAction = false) => {
    await stopCamera();
    setCameraError(null);
    setCameraActive(false);

    try {
      const isHttpLan = typeof window !== 'undefined' &&
        window.location.protocol === 'http:' &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1';

      const hasGetUserMedia = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

      if (!hasGetUserMedia && isHttpLan) {
        setCameraActive(false);
        setCameraError({
          type: 'insecure_http',
          message: 'Mobile browsers require a secure HTTPS connection to activate real-time camera video.'
        });
        if (!isExplicitUserAction) setScanMode('presets');
        return;
      }

      const isMobileDevice = typeof navigator !== 'undefined' &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');

      let cameraList = [];
      try {
        cameraList = await Html5Qrcode.getCameras();
        setCameras(cameraList || []);
      } catch {}

      // Check if hardware video devices exist
      let videoDevicesCount = cameraList ? cameraList.length : 0;
      if (videoDevicesCount === 0 && typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        try {
          const allDevs = await navigator.mediaDevices.enumerateDevices();
          const videoDevs = allDevs.filter((d) => d.kind === 'videoinput');
          videoDevicesCount = videoDevs.length;
        } catch {}
      }

      if (videoDevicesCount === 0 && cameraList && cameraList.length === 0) {
        setCameraActive(false);
        setCameraError({
          type: 'no_camera',
          message: 'No webcam or camera device was detected on this computer.'
        });
        if (!isExplicitUserAction) setScanMode('presets');
        return;
      }

      const html5QrCode = new Html5Qrcode('pdas-qr-reader');
      html5QrCodeRef.current = html5QrCode;

      // Select camera source: if camera ID is given, use it.
      // If hardware devices were enumerated, use the back camera on mobile or the primary webcam on desktop.
      // If none enumerated yet, request ideal environment on mobile or user webcam on desktop.
      let cameraSource;
      if (cameraId) {
        cameraSource = cameraId;
      } else if (cameraList && cameraList.length > 0) {
        const backCamera = cameraList.find((c) =>
          /back|rear|environment|main|facing\s*back/i.test(c.label || '')
        );
        cameraSource = (isMobileDevice && backCamera) ? backCamera.id : cameraList[0].id;
      } else if (isMobileDevice) {
        cameraSource = { facingMode: { ideal: 'environment' } };
      } else {
        cameraSource = { facingMode: { ideal: 'user' } };
      }

      // Dynamic qrbox sizing
      const config = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const edge = Math.min(viewfinderWidth, viewfinderHeight);
          return {
            width: Math.max(160, Math.floor(edge * 0.72)),
            height: Math.max(160, Math.floor(edge * 0.72))
          };
        },
        disableFlip: false
      };

      try {
        await html5QrCode.start(
          cameraSource,
          config,
          (decodedText) => {
            const parsed = parseQrText(decodedText);
            if (parsed) handleScanSuccessRef.current?.(parsed);
          },
          () => { /* ignore per-frame non-match */ }
        );
      } catch (firstErr) {
        // Fallback for devices where specific facingMode or ID was constrained
        console.warn('Initial camera start failed, attempting fallback camera:', firstErr);
        try {
          await html5QrCode.start(
            { facingMode: { ideal: isMobileDevice ? 'environment' : 'user' } },
            config,
            (decodedText) => {
              const parsed = parseQrText(decodedText);
              if (parsed) handleScanSuccessRef.current?.(parsed);
            },
            () => {}
          );
        } catch (secondErr) {
          throw firstErr || secondErr;
        }
      }

      // Re-fetch cameras after permission is granted to get real hardware labels
      try {
        const refreshedCameras = await Html5Qrcode.getCameras();
        if (refreshedCameras && refreshedCameras.length > 0) {
          setCameras(refreshedCameras);
        }
      } catch {}

      setCameraActive(true);
      setCameraError(null);
    } catch (err) {
      setCameraActive(false);
      html5QrCodeRef.current = null;
      const isHttpLan = typeof window !== 'undefined' &&
        window.location.protocol === 'http:' &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1';
      const msg = String(err?.message || err || '');
      const name = String(err?.name || '');

      const isMobileDevice = typeof navigator !== 'undefined' &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');

      if (isHttpLan && (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)) {
        setCameraError({
          type: 'insecure_http',
          message: 'Live camera scanning requires a secure HTTPS connection on mobile browsers.'
        });
      } else if (name === 'NotAllowedError' || msg.includes('Permission') || msg.includes('NotAllowedError')) {
        setCameraError({
          type: 'permission_denied',
          message: isMobileDevice
            ? 'Camera access was denied. Please allow camera permissions in your browser or select your room from the list.'
            : 'Camera access was blocked by your browser.'
        });
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || msg.includes('NotFound') || msg.includes('DevicesNotFoundError')) {
        setCameraError({
          type: 'no_camera',
          message: 'No webcam or hardware camera was detected on this device.'
        });
      } else if (name === 'NotReadableError' || name === 'TrackStartError' || msg.includes('readable') || msg.includes('in use')) {
        setCameraError({
          type: 'in_use',
          message: 'Camera is currently in use by another application or browser tab.'
        });
      } else {
        setCameraError({
          type: 'general',
          message: 'Live camera could not be started. You can select your room from the list or upload a QR image.'
        });
      }

      if (!isExplicitUserAction) {
        setScanMode('presets');
      }
    }
  }, [stopCamera, parseQrText]);

  const handleSwitchCamera = useCallback(() => {
    if (cameras.length <= 1) return;
    const nextIdx = (currentCameraIdx + 1) % cameras.length;
    setCurrentCameraIdx(nextIdx);
    startCamera(cameras[nextIdx].id);
  }, [cameras, currentCameraIdx, startCamera]);

  // Handle QR image file upload or mobile camera snapshot — uses high-resilience
  // multi-pass downscaling and BarcodeDetector + jsQR decoders
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // allow re-selecting the same file
    setCameraError(null);
    setIsProcessingFile(true);

    try {
      const decodedText = await decodeQrFromImageFile(file);
      if (decodedText) {
        const parsed = parseQrText(decodedText);
        if (parsed) {
          setIsProcessingFile(false);
          handleScanSuccessRef.current?.(parsed);
          return;
        }
      }
      setIsProcessingFile(false);
      setCameraError('No valid QR code was detected in this photo. Please hold the camera closer or ensure adequate lighting, then try again.');
    } catch {
      setIsProcessingFile(false);
      setCameraError('Could not process the photo. Please try again or select your room from the Room List.');
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
    setSelectedBldgFilter('all');
    setRoomSearchQuery('');
    setScanMode('camera');

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

  const switchToCamera = useCallback(() => { setScanMode('camera'); startCamera(null, true); }, [startCamera]);
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
      {/* Off-screen scanner container for file/photo processing — never conflicts with live camera */}
      <div
        id="pdas-qr-reader-file-tmp"
        style={{
          position: 'fixed',
          left: '-9999px',
          top: '-9999px',
          width: '640px',
          height: '640px',
          opacity: 0,
          pointerEvents: 'none',
          visibility: 'hidden'
        }}
      />

      <div>
        {/* Tab Bar */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
          <button
            type="button"
            className={`btn btn-sm ${scanMode === 'camera' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={switchToCamera}
            style={{ flex: '1 1 0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 4px', fontSize: '13px' }}
          >
            <Camera size={14} /> Camera
          </button>
          <button
            type="button"
            className={`btn btn-sm ${scanMode === 'presets' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={switchToPresets}
            style={{ flex: '1 1 0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 4px', fontSize: '13px' }}
          >
            <List size={14} /> Room List
          </button>
          <button
            type="button"
            className={`btn btn-sm ${scanMode === 'file' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { switchToFile(); fileInputRef.current?.click(); }}
            style={{ flex: '1 1 0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 4px', fontSize: '13px' }}
          >
            <Upload size={14} /> Upload
          </button>
        </div>

        {/* CAMERA SCANNER */}
        {scanMode === 'camera' && (
          <div>
            {/* Suppress ALL html5-qrcode library UI — only our overlay and video are visible */}
            <style>{`
              #pdas-qr-reader { background: transparent !important; border: none !important; }
              #pdas-qr-reader * { display: none !important; }
              #pdas-qr-reader video,
              #pdas-qr-reader__scan_region,
              #pdas-qr-reader__scan_region video {
                display: block !important;
                width: 100% !important; height: 100% !important;
                object-fit: cover !important;
                border: none !important; border-radius: 0 !important;
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

              {/* Processing File Overlay */}
              {isProcessingFile && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 25,
                  background: 'rgba(15, 23, 42, 0.94)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#fff', textAlign: 'center', padding: '20px'
                }}>
                  <RefreshCw size={36} color="#60a5fa" style={{ animation: 'spin 1.2s linear infinite', marginBottom: '12px' }} />
                  <div style={{ fontSize: '15px', fontWeight: '700' }}>Decoding QR Pattern…</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Multi-pass canvas scanner in progress</div>
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

              {/* Error State */}
              {cameraError && !scannedResult && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 15,
                  background: 'rgba(10,14,28,0.96)',
                  backdropFilter: 'blur(3px)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  color: '#fff', textAlign: 'center', padding: '20px 16px',
                  overflowY: 'auto'
                }}>
                  {(cameraError.type === 'insecure_http' || cameraError === 'insecure_http') ? (
                    <div style={{ maxWidth: '340px' }}>
                      <AlertCircle size={38} color="#fbbf24" style={{ marginBottom: '10px' }} />
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>
                        Live Scanner Requires HTTPS
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: '16px' }}>
                        Mobile browsers (Chrome / Safari) require a secure HTTPS connection to activate real-time camera video.
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', width: '100%' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => {
                            window.location.href = window.location.href.replace('http:', 'https:');
                          }}
                          style={{ width: '100%', maxWidth: '280px', padding: '10px 16px', fontSize: '13px', fontWeight: '700', borderRadius: '8px' }}
                        >
                          Switch to HTTPS (Enable Live Camera)
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={switchToPresets}
                          style={{ width: '100%', maxWidth: '280px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}
                        >
                          <List size={13} /> Select from Room List
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ maxWidth: '360px', width: '100%' }}>
                      <AlertCircle size={36} color="#f87171" style={{ marginBottom: '8px' }} />
                      
                      <div style={{ fontSize: '15px', fontWeight: '800', color: '#fff', marginBottom: '4px' }}>
                        {cameraError.type === 'permission_denied'
                          ? 'Camera Access is Blocked'
                          : cameraError.type === 'no_camera'
                          ? 'No Camera Detected'
                          : cameraError.type === 'in_use'
                          ? 'Camera Is In Use'
                          : 'Live Camera Unavailable'}
                      </div>

                      <div style={{ fontSize: '12.5px', color: '#fca5a5', lineHeight: 1.5, marginBottom: '12px' }}>
                        {cameraError.message || (typeof cameraError === 'string' ? cameraError : 'Camera permissions or hardware error.')}
                      </div>

                      {/* Browser Unblock Guide (shown when permission is blocked) */}
                      {(cameraError.type === 'permission_denied' || String(cameraError?.message || cameraError).includes('denied') || String(cameraError?.message || cameraError).includes('blocked')) && (
                        <div style={{
                          background: 'rgba(255,255,255,0.07)',
                          border: '1px solid rgba(255,255,255,0.14)',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          fontSize: '11.5px',
                          color: '#e2e8f0',
                          lineHeight: 1.6,
                          textAlign: 'left',
                          marginBottom: '14px'
                        }}>
                          <div style={{ fontWeight: 700, color: '#93c5fd', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span>💡 To enable camera in your browser:</span>
                          </div>
                          <div>1. Click the <strong>lock 🔒 or tune ⚙️ icon</strong> in the address bar.</div>
                          <div>2. Change <strong>Camera</strong> from &ldquo;Block&rdquo; to <strong>&ldquo;Allow&rdquo;</strong>.</div>
                          <div>3. Click <strong>Retry Camera</strong> below.</div>
                        </div>
                      )}

                      {/* Quick Action Buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={switchToPresets}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '7px',
                            padding: '9px 14px',
                            fontWeight: 700,
                            fontSize: '13px',
                            borderRadius: '8px',
                            width: '100%'
                          }}
                        >
                          <List size={15} /> Select Room from Campus List
                        </button>

                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => startCamera()}
                            style={{
                              flex: 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '5px',
                              background: 'rgba(255,255,255,0.15)',
                              color: '#fff',
                              border: '1px solid rgba(255,255,255,0.3)',
                              fontSize: '12px'
                            }}
                          >
                            <RefreshCw size={12} /> Retry Camera
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => { switchToFile(); fileInputRef.current?.click(); }}
                            style={{
                              flex: 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '5px',
                              background: 'rgba(255,255,255,0.15)',
                              color: '#fff',
                              border: '1px solid rgba(255,255,255,0.3)',
                              fontSize: '12px'
                            }}
                          >
                            <Upload size={12} /> Upload QR
                          </button>

                          {typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '') && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => mobileCameraInputRef.current?.click()}
                              style={{
                                flex: 1,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '5px',
                                background: 'rgba(255,255,255,0.15)',
                                color: '#fff',
                                border: '1px solid rgba(255,255,255,0.3)',
                                fontSize: '12px'
                              }}
                            >
                              <Camera size={12} /> Take Photo
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
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

            {cameraActive && !cameraError && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => mobileCameraInputRef.current?.click()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}
                >
                  <Camera size={13} /> Take Photo Instead
                </button>
                {cameras.length > 1 && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleSwitchCamera}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                    <RefreshCw size={13} /> Switch Camera ({currentCameraIdx + 1}/{cameras.length})
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* MODE 2: QUICK ROOM PRESETS (FOR 1-CLICK TESTING) */}
        {scanMode === 'presets' && (
          <div>
            {/* Friendly Camera Fallback Alert Banner */}
            {cameraError && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                background: '#eff6ff',
                border: '1.5px solid #bfdbfe',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '12px',
                fontSize: '12.5px',
                color: '#1e40af'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} color="#2563eb" style={{ flexShrink: 0 }} />
                  <span>
                    {cameraError.type === 'permission_denied'
                      ? 'Camera access was blocked by your browser. Select your room from the campus list below, or click the lock icon 🔒 in the address bar to allow camera access.'
                      : 'Live camera is unavailable on this device. Select your room from the campus list below, use search, or upload a QR image.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={switchToCamera}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#001f9c',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    whiteSpace: 'nowrap',
                    padding: '2px 4px'
                  }}
                >
                  Retry Camera
                </button>
              </div>
            )}
            {/* Quick Search Bar */}
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <Search size={15} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                value={roomSearchQuery}
                onChange={(e) => setRoomSearchQuery(e.target.value)}
                placeholder="Search campus room (e.g. PDAS, Cashier, Lab, Clinic)..."
                style={{
                  width: '100%',
                  padding: '8px 30px 8px 32px',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '13px',
                  outline: 'none',
                  background: '#fff',
                  color: '#0f172a'
                }}
                autoFocus
              />
              {roomSearchQuery && (
                <button
                  type="button"
                  onClick={() => setRoomSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#94a3b8',
                    padding: 0
                  }}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

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

            {filteredPresets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 12px', color: '#64748b', fontSize: '13px' }}>
                No campus rooms match &ldquo;{roomSearchQuery}&rdquo;. Try another room name or clear your search.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '8px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
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
            )}
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
            {isProcessingFile ? (
              <div>
                <RefreshCw size={34} color="#001f9c" style={{ margin: '0 auto 10px auto', animation: 'spin 1.2s linear infinite' }} />
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                  Scanning Image…
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  Analyzing QR pattern with multi-pass reader
                </div>
              </div>
            ) : (
              <>
                <Upload size={34} color="#001f9c" style={{ margin: '0 auto 10px auto' }} />
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>
                  Click to select a QR code image
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  PNG, JPG or WEBP (phone photos supported)
                </div>
              </>
            )}
            {cameraError && !isProcessingFile && (
              <div style={{ marginTop: '12px', fontSize: '12.5px', color: '#b91c1c', fontWeight: '600' }}>
                {cameraError}
              </div>
            )}
          </div>
        )}

        {/* Hidden File Input for Image Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        {/* Hidden Native Camera Input: directly launches camera app on mobile devices */}
        <input
          ref={mobileCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
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
