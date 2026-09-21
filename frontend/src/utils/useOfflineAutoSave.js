import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook for auto-saving form data to localStorage with offline capability.
 * Keeps user data completely safe from unexpected browser closures, network drops, or power loss.
 *
 * @param {string} formKey Unique identifier for this form (e.g., 'job_request_draft')
 * @param {Object} currentValues Current values object representing the form state
 * @param {Function} setValues State setter to restore draft on initial load
 * @param {Object} [options] Optional configuration
 */
export function useOfflineAutoSave(formKey, currentValues, setValues, options = {}) {
  const { debounceMs = 350, onRestored } = options;
  
  const [isOnline, setIsOnline] = useState(() => (
    typeof navigator !== 'undefined' ? navigator.onLine : true
  ));
  const [lastSaved, setLastSaved] = useState(null);
  const [hasDraft, setHasDraft] = useState(false);
  const isInitialMount = useRef(true);

  // Monitor network online/offline transitions
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Restore saved draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`fixit_draft_${formKey}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.data && typeof parsed.data === 'object') {
          const hasNonEmpty = Object.values(parsed.data).some(v =>
            v !== null && v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0)
          );
          if (hasNonEmpty) {
            setHasDraft(true);
            setLastSaved(new Date(parsed.timestamp));
            // setValues can be a direct restore callback (preferred) or a React setState
            if (typeof setValues === 'function') {
              try {
                // Try calling as a restore callback first (receives draft data directly)
                setValues(parsed.data);
              } catch {
                // Ignore errors from the restore callback
              }
            }
            if (onRestored) {
              onRestored(parsed.data);
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[AutoSave] Unable to restore draft for ${formKey}:`, err);
    }
  }, [formKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced auto-save on value change
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      try {
        if (!currentValues || typeof currentValues !== 'object') return;

        // Skip non-serializable File/Blob instances
        const serializable = {};
        for (const [k, v] of Object.entries(currentValues)) {
          if (v instanceof File || v instanceof Blob) continue;
          serializable[k] = v;
        }

        const hasContent = Object.values(serializable).some(v => 
          v !== null && v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0)
        );

        if (hasContent) {
          const payload = {
            data: serializable,
            timestamp: new Date().toISOString()
          };
          localStorage.setItem(`fixit_draft_${formKey}`, JSON.stringify(payload));
          setLastSaved(new Date());
          setHasDraft(true);
        }
      } catch (err) {
        console.warn(`[AutoSave] Could not save draft for ${formKey}:`, err);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [formKey, currentValues, debounceMs]);

  // Discard / clean up draft once submitted
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(`fixit_draft_${formKey}`);
      setHasDraft(false);
      setLastSaved(null);
    } catch (err) {
      console.warn(`[AutoSave] Error clearing draft for ${formKey}:`, err);
    }
  }, [formKey]);

  return {
    isOnline,
    lastSaved,
    hasDraft,
    clearDraft
  };
}

export default useOfflineAutoSave;
