import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function cameraErrorMessage(error) {
  if (!error) return 'The camera could not be started.';
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
    return 'Camera access was blocked. Allow camera permission in your browser, or upload a photo instead.';
  }
  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
    return 'No camera was found on this device. Upload a photo instead.';
  }
  if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
    return 'The camera is being used by another application. Close it and try again, or upload a photo.';
  }
  return 'The camera could not be started. Upload a photo instead.';
}

/**
 * ProfilePhotoPicker
 *
 * Gives every registration form the same two professional choices:
 *  - Take Photo: opens the live camera and captures a square headshot.
 *  - Upload File: picks an existing image from the device.
 *
 * Phones without in-page camera support fall back to the native capture input.
 */
export function ProfilePhotoPicker({
  value = '',
  fileName = '',
  onSelect,
  onRemove,
  onError,
  disabled = false,
  hint = 'PNG, JPG or JPEG. Maximum 10MB.',
  ariaLabel = 'Profile photo',
}) {
  const uploadInputRef = useRef(null);
  const deviceCameraInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraCardRef = useRef(null);
  const lastFocusedRef = useRef(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState('user');

  const acceptFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onError?.('Please choose an image file (PNG, JPG or JPEG).');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      onError?.('That photo is over 10MB. Please choose a smaller image.');
      return;
    }
    onError?.('');
    onSelect?.(file);
  };

  const handleInputChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    acceptFile(file);
  };

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const closeCamera = () => {
    stopCameraStream();
    setCameraOpen(false);
    setCameraError('');
    setCameraLoading(false);
    const lastFocused = lastFocusedRef.current;
    if (lastFocused && document.contains(lastFocused)) {
      requestAnimationFrame(() => lastFocused.focus());
    }
  };

  const openCamera = () => {
    if (disabled) return;
    lastFocusedRef.current = document.activeElement;
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      // Most phones support the native camera input even when the page is not
      // on HTTPS. Desktop browsers simply show the file picker in that case.
      deviceCameraInputRef.current?.click();
      return;
    }
    setCameraError('');
    setCameraLoading(true);
    setFacingMode('user');
    setCameraOpen(true);
  };

  useEffect(() => {
    if (!cameraOpen) return undefined;

    let cancelled = false;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          try {
            await video.play();
          } catch {
            // Autoplay can be rejected until the stream is ready. The muted
            // inline video still starts on the next paint in practice.
          }
        }
        if (!cancelled) setCameraLoading(false);
      } catch (error) {
        if (cancelled) return;
        setCameraLoading(false);
        setCameraError(cameraErrorMessage(error));
      }
    };

    startCamera();

    const focusableElements = () => {
      const card = cameraCardRef.current;
      if (!card) return [];
      return [...card.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter((element) => element.offsetParent !== null);
    };

    const focusFrame = requestAnimationFrame(() => {
      const first = focusableElements()[0] || cameraCardRef.current;
      first?.focus?.();
    });

    const handleKeyDown = (event) => {
      // Capture phase keeps these keys from also reaching the registration
      // modal that may be open behind the camera.
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeCamera();
        return;
      }
      if (event.key !== 'Tab') return;

      event.stopPropagation();
      const card = cameraCardRef.current;
      const items = focusableElements();
      if (!card || items.length === 0) {
        event.preventDefault();
        card?.focus?.();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!card.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelled = true;
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown, true);
      stopCameraStream();
    };
    // stopCameraStream is intentionally read from this render; adding it would
    // recreate the stream on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen, facingMode]);

  const switchCamera = () => {
    if (cameraLoading) return;
    setCameraError('');
    setCameraLoading(true);
    setFacingMode((current) => (current === 'user' ? 'environment' : 'user'));
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError('The camera is still starting. Wait a moment and try again.');
      return;
    }

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    const size = Math.min(sourceWidth, sourceHeight);
    const sourceX = (sourceWidth - size) / 2;
    const sourceY = (sourceHeight - size) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    context.drawImage(video, sourceX, sourceY, size, size, 0, 0, size, size);

    try {
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error('Could not capture the photo.'))),
          'image/jpeg',
          0.9
        );
      });
      const file = new File([blob], `camera-photo-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });
      closeCamera();
      acceptFile(file);
    } catch {
      setCameraError('The photo could not be captured. Try again, or upload a photo instead.');
    }
  };

  return (
    <div className={`photo-picker${value ? ' has-photo' : ''}`}>
      <div className="photo-picker-preview" aria-label={ariaLabel}>
        {value ? (
          <img src={value} alt="Profile preview" />
        ) : (
          <div className="photo-picker-placeholder">
            <User size={30} aria-hidden="true" />
          </div>
        )}
        {value && (
          <span className="photo-picker-check" aria-hidden="true">
            <CheckCircle2 size={16} />
          </span>
        )}
      </div>

      <div className="photo-picker-body">
        <div className="photo-picker-heading">
          {value ? (fileName || 'Profile photo attached') : 'Add a profile photo'}
        </div>
        <p className="photo-picker-copy">
          {value
            ? 'This will be used as the profile picture. Retake it or choose a different file.'
            : 'Take a photo now, or upload an image already saved on this device.'}
        </p>

        <div className="photo-picker-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={openCamera}
            disabled={disabled}
          >
            <Camera size={15} />
            Take Photo
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => uploadInputRef.current?.click()}
            disabled={disabled}
          >
            <Upload size={15} />
            Upload File
          </button>
          {value && onRemove && (
            <button
              type="button"
              className="btn btn-secondary btn-sm photo-picker-remove"
              onClick={onRemove}
              disabled={disabled}
            >
              <Trash2 size={14} />
              Remove
            </button>
          )}
        </div>

        <p className="photo-picker-hint">{hint}</p>
      </div>

      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        hidden
      />
      <input
        ref={deviceCameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleInputChange}
        hidden
      />

      {cameraOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-backdrop"
          style={{ zIndex: 300 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCamera();
          }}
          role="presentation"
        >
          <div
            ref={cameraCardRef}
            className="modal-card photo-camera-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="photo-camera-title"
            tabIndex={-1}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title" id="photo-camera-title">Take a Profile Photo</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={closeCamera}
                aria-label="Close camera"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="photo-camera-stage">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="photo-camera-video"
                  style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                />
                {cameraLoading && !cameraError && (
                  <div className="photo-camera-status">
                    <span className="photo-camera-spinner" aria-hidden="true" />
                    Starting camera…
                  </div>
                )}
                {cameraError && (
                  <div className="photo-camera-error">
                    <Camera size={26} aria-hidden="true" />
                    <p>{cameraError}</p>
                  </div>
                )}
              </div>

              <p className="photo-camera-help">
                Center your face inside the frame. The captured photo is saved as a
                square profile picture.
              </p>

              {cameraError && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    closeCamera();
                    uploadInputRef.current?.click();
                  }}
                >
                  <Upload size={15} />
                  Upload a file instead
                </button>
              )}
            </div>

            <div className="modal-footer">
              {!cameraError && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={switchCamera}
                  disabled={cameraLoading}
                >
                  <RefreshCw size={14} />
                  Switch Camera
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeCamera}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={capturePhoto}
                disabled={cameraLoading || Boolean(cameraError)}
              >
                <Camera size={15} />
                Use This Photo
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default ProfilePhotoPicker;
