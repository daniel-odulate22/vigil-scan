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
  const containerReadyRef = useRef(false);

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
    
    // Wait for container to be ready
    const container = document.getElementById('scanner-container');
    if (!container) {
      console.log('Scanner container not ready, waiting...');
      setTimeout(() => startScanner(), 100);
      return;
    }

    setIsInitializing(true);
    setIsScanning(true);
    setErrorMessage(null);

    try {
      // Release any existing streams first
      releaseMediaStreams();
      await new Promise(resolve => setTimeout(resolve, 200));

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
        { facingMode: 'environment' },
        {
          fps: 10,
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
      setIsInitializing(false);
    } catch (err: any) {
      setIsScanning(false);
      setIsInitializing(false);
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

            {/* Active Scanner - always render container when granted or scanning */}
            {(permissionState === 'granted' || isScanning) && (
              <div className="w-full max-w-lg px-4">
                <div
                  id="scanner-container"
                  className="w-full aspect-[4/3] bg-black rounded-xl overflow-hidden relative"
                >
                  {/* Loading overlay */}
                  {isInitializing && (
                    <div className="absolute inset-0 bg-black flex items-center justify-center z-20">
                      <div className="text-center">
                        <motion.div
                          className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        />
                        <p className="text-white/80 text-sm">Starting camera...</p>
                      </div>
                    </div>
                  )}
                  {/* Animated scan line */}
                  {!isInitializing && (
                    <motion.div
                      className="absolute left-4 right-4 h-0.5 bg-primary/80 rounded-full shadow-lg z-10"
                      style={{ boxShadow: '0 0 8px 2px hsl(var(--primary) / 0.5)' }}
                      animate={{
                        top: ['30%', '70%', '30%'],
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />
                  )}
                  {/* Corner brackets */}
                  <div className="absolute inset-0 pointer-events-none z-10">
                    <div className="absolute top-[20%] left-[8%] w-10 h-10 border-t-3 border-l-3 border-primary rounded-tl-lg" />
                    <div className="absolute top-[20%] right-[8%] w-10 h-10 border-t-3 border-r-3 border-primary rounded-tr-lg" />
                    <div className="absolute bottom-[20%] left-[8%] w-10 h-10 border-b-3 border-l-3 border-primary rounded-bl-lg" />
                    <div className="absolute bottom-[20%] right-[8%] w-10 h-10 border-b-3 border-r-3 border-primary rounded-br-lg" />
                  </div>
                </div>
                <p className="text-center text-muted-foreground text-sm mt-4 font-serif">
                  Position barcode in center of frame
                </p>
              </div>
            )}

            {/* Always render hidden container for initialization */}
            {permissionState !== 'granted' && !isScanning && (
              <div id="scanner-container" className="hidden" />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BarcodeScanner;
