import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } from 'html5-qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, CameraOff, AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (code: string) => void;
}

type PermissionState = 'prompt' | 'granted' | 'denied' | 'error';

// Helper to release all active media streams
const releaseMediaStreams = () => {
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    const stream = video.srcObject as MediaStream;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
  });
};

const BarcodeScanner = ({ isOpen, onClose, onScanSuccess }: BarcodeScannerProps) => {
  const [permissionState, setPermissionState] = useState<PermissionState>('prompt');
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'busy' | 'denied' | 'not-found' | 'generic' | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<string | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  // Cleanup scanner on unmount or close
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.log('Scanner cleanup:', err);
      }
      scannerRef.current = null;
    }
    // Release any remaining media streams
    releaseMediaStreams();
    setIsScanning(false);
  }, []);

  // Start the scanner
  const startScanner = useCallback(async () => {
    if (isScanning || scannerRef.current) return;

    setIsScanning(true);
    setErrorMessage(null);

    try {
      const html5QrCode = new Html5Qrcode('scanner-container', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 280, height: 180 },
          aspectRatio: 1.5,
        },
        (decodedText) => {
          // DEBOUNCE: Prevent multiple scans of same barcode
          if (lastScannedRef.current === decodedText) return;
          
          lastScannedRef.current = decodedText;
          
          // Clear any existing timeout
          if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
          }
          
          // Haptic feedback
          if ('vibrate' in navigator) {
            navigator.vibrate(100);
          }
          
          // Stop scanner before callback
          stopScanner().then(() => {
            onScanSuccess(decodedText);
          });
          
          // Reset last scanned after 3 seconds
          debounceTimeoutRef.current = setTimeout(() => {
            lastScannedRef.current = null;
          }, 3000);
        },
        () => {
          // QR code not detected - this is normal, don't log
        }
      );

      setPermissionState('granted');
    } catch (err: any) {
      setIsScanning(false);
      releaseMediaStreams();
      
      const errorName = err?.name || '';
      const errorMsg = err?.message || '';
      
      if (errorName === 'NotAllowedError' || errorMsg.includes('Permission')) {
        setPermissionState('denied');
        setErrorType('denied');
        setErrorMessage('Camera access was denied. Please allow camera access to scan barcodes.');
      } else if (errorName === 'NotReadableError' || errorMsg.includes('Could not start') || errorMsg.includes('in use')) {
        // Camera is busy or unavailable - common on mobile
        setPermissionState('error');
        setErrorType('busy');
        setErrorMessage('Camera is busy or unavailable. Please close other camera apps (like your native camera or other browser tabs) and try again.');
      } else if (errorName === 'NotFoundError' || errorMsg.includes('not found')) {
        setPermissionState('error');
        setErrorType('not-found');
        setErrorMessage('No camera found on this device.');
      } else if (errorName === 'OverconstrainedError') {
        // Constraints not satisfiable - try again with different settings
        setPermissionState('error');
        setErrorType('generic');
        setErrorMessage('Camera settings not supported. Please try again.');
      } else {
        setPermissionState('error');
        setErrorType('generic');
        setErrorMessage(errorMsg || 'Failed to start camera. Please try again.');
      }
    }
  }, [isScanning, onScanSuccess, stopScanner]);

  // Check camera permission on open
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    // Check if camera API is available
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionState('error');
      setErrorMessage('Camera is not supported on this device or browser.');
      return;
    }

    // Check permission state
    navigator.permissions?.query({ name: 'camera' as PermissionName })
      .then((result) => {
        if (result.state === 'granted') {
          setPermissionState('granted');
          startScanner();
        } else if (result.state === 'denied') {
          setPermissionState('denied');
        } else {
          setPermissionState('prompt');
        }

        result.onchange = () => {
          if (result.state === 'granted') {
            setPermissionState('granted');
            startScanner();
          } else if (result.state === 'denied') {
            setPermissionState('denied');
          }
        };
      })
      .catch(() => {
        // Permissions API not supported (common on iOS Safari)
        // Try to request permission directly
        handleRequestPermission();
      });

    return () => {
      stopScanner();
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [isOpen, startScanner, stopScanner]);

  const handleRequestPermission = async () => {
    try {
      // First release any existing streams
      releaseMediaStreams();
      
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      // Immediately stop the stream - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      
      setPermissionState('granted');
      retryCountRef.current = 0;
      
      // Small delay before starting scanner to ensure camera is released
      await new Promise(resolve => setTimeout(resolve, 300));
      startScanner();
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setPermissionState('denied');
        setErrorType('denied');
      } else if (err.name === 'NotReadableError') {
        setPermissionState('error');
        setErrorType('busy');
        setErrorMessage('Camera is busy. Please close other apps using the camera.');
      } else {
        setPermissionState('error');
        setErrorType('generic');
        setErrorMessage(err.message || 'Failed to access camera.');
      }
    }
  };

  const handleRetry = async () => {
    setErrorMessage(null);
    setErrorType(null);
    retryCountRef.current += 1;
    
    // Stop any existing scanner first
    await stopScanner();
    
    // Add increasing delay for retries to allow camera to fully release
    const delay = Math.min(500 + (retryCountRef.current * 300), 2000);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    setPermissionState('prompt');
    
    // Try requesting permission again
    handleRequestPermission();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-background"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between bg-gradient-to-b from-background to-transparent">
            <h2 className="text-lg font-display font-semibold text-foreground">
              Scan Barcode
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Scanner Container */}
          <div className="flex flex-col items-center justify-center min-h-screen px-6">
            {/* Permission Prompt Screen */}
            {permissionState === 'prompt' && !isScanning && (
              <motion.div
                className="text-center max-w-xs"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="w-20 h-20 mx-auto mb-6 bg-secondary rounded-full flex items-center justify-center">
                  <Camera className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-xl font-display font-semibold text-foreground mb-2">
                  Camera Access Needed
                </h3>
                <p className="text-muted-foreground font-serif mb-6">
                  To scan medication barcodes, Vigil needs access to your camera. Your camera feed never leaves your device.
                </p>
                <Button onClick={handleRequestPermission} className="w-full">
                  Allow Camera Access
                </Button>
              </motion.div>
            )}

            {/* Permission Denied Screen */}
            {permissionState === 'denied' && (
              <motion.div
                className="text-center max-w-xs"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="w-20 h-20 mx-auto mb-6 bg-destructive/10 rounded-full flex items-center justify-center">
                  <CameraOff className="w-10 h-10 text-destructive" />
                </div>
                <h3 className="text-xl font-display font-semibold text-foreground mb-2">
                  Camera Access Denied
                </h3>
                <p className="text-muted-foreground font-serif mb-6">
                  Please enable camera access in your browser settings to scan barcodes.
                </p>
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg text-left">
                    <p className="font-medium mb-1">How to enable:</p>
                    <ol className="list-decimal ml-4 space-y-1">
                      <li>Tap the lock/info icon in your browser's address bar</li>
                      <li>Find "Camera" in permissions</li>
                      <li>Change to "Allow"</li>
                      <li>Refresh this page</li>
                    </ol>
                  </div>
                  <Button variant="outline" onClick={handleRetry} className="w-full">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Error Screen */}
            {permissionState === 'error' && (
              <motion.div
                className="text-center max-w-xs"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="w-20 h-20 mx-auto mb-6 bg-destructive/10 rounded-full flex items-center justify-center">
                  {errorType === 'busy' ? (
                    <RefreshCw className="w-10 h-10 text-destructive" />
                  ) : (
                    <AlertTriangle className="w-10 h-10 text-destructive" />
                  )}
                </div>
                <h3 className="text-xl font-display font-semibold text-foreground mb-2">
                  {errorType === 'busy' ? 'Camera Busy' : 'Camera Error'}
                </h3>
                <p className="text-muted-foreground font-serif mb-4">
                  {errorMessage || 'An error occurred while accessing the camera.'}
                </p>
                
                {/* Specific guidance based on error type */}
                {errorType === 'busy' && (
                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg text-left mb-4">
                    <p className="font-medium mb-1">Quick fix:</p>
                    <ol className="list-decimal ml-4 space-y-1">
                      <li>Close your device's camera app</li>
                      <li>Close other browser tabs using camera</li>
                      <li>Wait a few seconds</li>
                      <li>Tap "Try Again" below</li>
                    </ol>
                  </div>
                )}
                
                <Button variant="outline" onClick={handleRetry} className="w-full">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </motion.div>
            )}

            {/* Active Scanner */}
            {(permissionState === 'granted' || isScanning) && (
              <div className="w-full max-w-sm">
                <div
                  id="scanner-container"
                  className="w-full aspect-[4/3] bg-foreground/5 rounded-xl overflow-hidden relative"
                />
                <p className="text-center text-muted-foreground text-sm mt-4 font-serif">
                  Point your camera at a medication barcode
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BarcodeScanner;
