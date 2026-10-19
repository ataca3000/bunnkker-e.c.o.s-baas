import { useEffect, useRef } from 'react';

// 100ms covers common budget USB HID scanners (some emit at 80–100ms).
const BARCODE_THRESHOLD_MS = 100;
// Gap of 10× the threshold with no input resets the buffer (new scan).
const RESET_GAP_MS = BARCODE_THRESHOLD_MS * 10;
const MIN_BARCODE_LENGTH = 4;

type BarcodeScannerOptions = {
  onScan: (barcode: string) => void;
  enabled?: boolean;
};

// Registers the keydown listener once. Reads current onScan and enabled
// from refs so there is no listener churn on every render.
export function useBarcodeScanner({ onScan, enabled = true }: BarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!enabledRef.current) return;

      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const now = Date.now();
      const delta = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const barcode = bufferRef.current;
        bufferRef.current = '';
        if (barcode.length >= MIN_BARCODE_LENGTH) {
          onScanRef.current(barcode);
        }
        return;
      }

      if (delta > RESET_GAP_MS) {
        bufferRef.current = '';
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);  
}
