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

// Dynamic qrbox function - uses 80% of smaller viewport dimension
const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
  const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
  const qrboxWidth = Math.min(Math.floor(minEdge * 0.85), 350);
  const qrboxHeight = Math.min(Math.floor(qrboxWidth * 0.5), 200); // Barcode aspect ratio
  return { width: qrboxWidth, height: qrboxHeight };
};

const BarcodeScanner = ({ isOpen, onClose, onScanSuccess }: BarcodeScannerProps) => {
  const [permissionState, setPermissionState] = useState<PermissionState>('prompt');
  const [isScanning, setIsScanning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'busy' | 'denied' | 'not-found' | 'generic' | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<string | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const isStartingRef = useRef(false);
  const isOpenRef = useRef(false);

  const showScannerUi = permissionState === 'granted' || isInitializing || isScanning;

  const nextPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  // Cleanup scanner on unmount or close
  const stopScanner = useCallback(async () => {
    isStartingRef.current = false;
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
    setIsInitializing(false);
  }, []);

  // Start the scanner
  const startScanner = useCallback(async () => {
    if (!isOpenRef.current) return;
    if (isStartingRef.current || scannerRef.current) return;
    
    isStartingRef.current = true;
    setIsInitializing(true);
    setErrorMessage(null);

    try {
      // Release any existing streams first
      releaseMediaStreams();
      await new Promise(resolve => setTimeout(resolve, 200));

      // Ensure React has rendered the visible container before initializing html5-qrcode
      await nextPaint();

      const container = document.getElementById('scanner-container');
      if (!container) {
        throw new Error('Scanner container not found');
      }

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

      // Simpler config - let the library handle video constraints
      await html5QrCode.start(
        { facingMode: { ideal: 'environment' } },
        {
          fps: 8,
          qrbox: qrboxFunction,
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
      setIsScanning(true);
      setIsInitializing(false);

      // iOS/Safari reliability: ensure video fills container and plays inline
      const videoEl = container.querySelector('video') as HTMLVideoElement | null;
      if (videoEl) {
        videoEl.setAttribute('playsinline', 'true');
        videoEl.playsInline = true;
        videoEl.muted = true;
        videoEl.style.width = '100%';
        videoEl.style.height = '100%';
        videoEl.style.objectFit = 'cover';
      }

      isStartingRef.current = false;
    } catch (err: any) {
      setIsInitializing(false);
      setIsScanning(false);
      isStartingRef.current = false;
      releaseMediaStreams();
      
      const errorName = err?.name || '';
      const errorMsg = err?.message || '';
      
      console.error('Scanner error:', errorName, errorMsg);
      
      if (errorName === 'NotAllowedError' || errorMsg.includes('Permission')) {
        setPermissionState('denied');
        setErrorType('denied');
        setErrorMessage('Camera access was denied. Please allow camera access to scan barcodes.');
      } else if (errorName === 'NotReadableError' || errorMsg.includes('Could not start') || errorMsg.includes('in use')) {
        setPermissionState('error');
        setErrorType('busy');
        setErrorMessage('Camera is busy or unavailable. Please close other camera apps and try again.');
      } else if (errorName === 'NotFoundError' || errorMsg.includes('not found')) {
        setPermissionState('error');
        setErrorType('not-found');
        setErrorMessage('No camera found on this device.');
      } else if (errorName === 'OverconstrainedError') {
        setPermissionState('error');
        setErrorType('generic');
        setErrorMessage('Camera settings not supported. Please try again.');
      } else {
        setPermissionState('error');
        setErrorType('generic');
        setErrorMessage(errorMsg || 'Failed to start camera. Please try again.');
      }
    }
  }, [onScanSuccess, stopScanner]);

  // Check camera permission on open
  useEffect(() => {
    isOpenRef.current = isOpen;
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
          requestAnimationFrame(() => startScanner());
        } else if (result.state === 'denied') {
          setPermissionState('denied');
        } else {
          setPermissionState('prompt');
        }

        result.onchange = () => {
          if (result.state === 'granted') {
            setPermissionState('granted');
            requestAnimationFrame(() => startScanner());
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
        video: { facingMode: { ideal: 'environment' } }
      });
      
      // Immediately stop the stream - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      
      setPermissionState('granted');
      retryCountRef.current = 0;
      
      // Small delay before starting scanner to ensure camera is released
      await new Promise(resolve => setTimeout(resolve, 300));
      await nextPaint();
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
          <div className="relative flex flex-col items-center justify-center min-h-screen px-6">
            <div className="w-full max-w-lg px-4">
              {/* Keep this container mounted at all times to avoid html5-qrcode losing its target */}
              <div
                id="scanner-container"
                className="w-full aspect-[4/3] bg-muted rounded-xl overflow-hidden relative"
              >
                {/* Loading overlay */}
                {isInitializing && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-20">
                    <div className="text-center">
                      <motion.div
                        className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                      <p className="text-foreground/80 text-sm">Starting camera...</p>
                    </div>
                  </div>
                )}

                {/* Animated scan line */}
                {showScannerUi && !isInitializing && (
                  <motion.div
                    className="absolute left-4 right-4 h-0.5 bg-primary/80 rounded-full shadow-lg z-10"
                    style={{ boxShadow: '0 0 8px 2px hsl(var(--primary) / 0.5)' }}
                    animate={{ top: ['30%', '70%', '30%'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}

                {/* Corner brackets */}
                {showScannerUi && (
                  <div className="absolute inset-0 pointer-events-none z-10">
                    <div className="absolute top-[20%] left-[8%] w-10 h-10 border-t-2 border-l-2 border-primary rounded-tl-lg" />
                    <div className="absolute top-[20%] right-[8%] w-10 h-10 border-t-2 border-r-2 border-primary rounded-tr-lg" />
                    <div className="absolute bottom-[20%] left-[8%] w-10 h-10 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                    <div className="absolute bottom-[20%] right-[8%] w-10 h-10 border-b-2 border-r-2 border-primary rounded-br-lg" />
                  </div>
                )}
              </div>

              {showScannerUi && (
                <p className="text-center text-muted-foreground text-sm mt-4 font-serif">
                  Position barcode in center of frame
                </p>
              )}
            </div>

            {/* Overlay screens (prompt/denied/error) */}
            {permissionState === 'prompt' && !showScannerUi && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center px-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="text-center max-w-xs">
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
                </div>
              </motion.div>
            )}

            {permissionState === 'denied' && !showScannerUi && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center px-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="text-center max-w-xs">
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
                </div>
              </motion.div>
            )}

            {permissionState === 'error' && !showScannerUi && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center px-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="text-center max-w-xs">
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
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BarcodeScanner;
