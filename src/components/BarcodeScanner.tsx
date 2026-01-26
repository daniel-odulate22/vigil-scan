import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeScannerState } from 'html5-qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, CameraOff, AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ScannerDebugPanel from '@/components/scanner/ScannerDebugPanel';
import ScannerGuidedOverlay from '@/components/scanner/ScannerGuidedOverlay';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (code: string) => void;
}

type PermissionState = 'prompt' | 'granted' | 'denied' | 'error';

interface CameraDebugInfo {
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  trackSettings: MediaTrackSettings | null;
  trackState: string | null;
  capabilities: MediaTrackCapabilities | null;
  errors: string[];
}

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

// Dynamic qrbox function - optimized for device performance
const createQrboxFunction = (isLowEnd: boolean) => {
  return (viewfinderWidth: number, viewfinderHeight: number) => {
    const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
    // Smaller scan region for low-end devices (better performance)
    const sizeFactor = isLowEnd ? 0.6 : 0.8;
    const qrboxWidth = Math.min(Math.floor(minEdge * sizeFactor), isLowEnd ? 280 : 350);
    const qrboxHeight = Math.min(Math.floor(qrboxWidth * 0.5), isLowEnd ? 140 : 200);
    return { width: qrboxWidth, height: qrboxHeight };
  };
};

// Detect low-end device (simple heuristic)
const isLowEndDevice = (): boolean => {
  const memory = (navigator as any).deviceMemory;
  const cores = navigator.hardwareConcurrency;
  return (memory && memory <= 4) || (cores && cores <= 4);
};

const BarcodeScanner = ({ isOpen, onClose, onScanSuccess }: BarcodeScannerProps) => {
  const [permissionState, setPermissionState] = useState<PermissionState>('prompt');
  const [isScanning, setIsScanning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'busy' | 'denied' | 'not-found' | 'generic' | null>(null);
  
  // Torch state
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  
  // Debug info
  const [debugInfo, setDebugInfo] = useState<CameraDebugInfo>({
    devices: [],
    selectedDeviceId: null,
    trackSettings: null,
    trackState: null,
    capabilities: null,
    errors: [],
  });
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<string | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const isStartingRef = useRef(false);
  const isOpenRef = useRef(false);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);

  const showScannerUi = permissionState === 'granted' || isInitializing || isScanning;
  const isLowEnd = useRef(isLowEndDevice()).current;

  const nextPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const addDebugError = useCallback((error: string) => {
    setDebugInfo(prev => ({
      ...prev,
      errors: [...prev.errors.slice(-9), `${new Date().toLocaleTimeString()}: ${error}`],
    }));
  }, []);

  // Update debug info from video track
  const updateTrackDebugInfo = useCallback((track: MediaStreamTrack | null) => {
    if (!track) {
      setDebugInfo(prev => ({
        ...prev,
        trackSettings: null,
        trackState: null,
        capabilities: null,
      }));
      return;
    }

    try {
      const settings = track.getSettings();
      const capabilities = track.getCapabilities?.() || null;
      
      setDebugInfo(prev => ({
        ...prev,
        selectedDeviceId: settings.deviceId || null,
        trackSettings: settings,
        trackState: track.readyState,
        capabilities,
      }));

      // Check torch support
      if (capabilities && 'torch' in capabilities) {
        setTorchSupported(true);
      }
    } catch (err) {
      console.log('Error getting track info:', err);
    }
  }, []);

  // Enumerate devices
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      setDebugInfo(prev => ({ ...prev, devices: videoDevices }));
    } catch (err) {
      addDebugError(`Device enumeration failed: ${err}`);
    }
  }, [addDebugError]);

  // Toggle torch
  const toggleTorch = useCallback(async () => {
    if (!videoTrackRef.current || !torchSupported) return;

    try {
      const newState = !torchEnabled;
      await videoTrackRef.current.applyConstraints({
        advanced: [{ torch: newState } as any],
      });
      setTorchEnabled(newState);
    } catch (err) {
      addDebugError(`Torch toggle failed: ${err}`);
    }
  }, [torchEnabled, torchSupported, addDebugError]);

  // Cleanup scanner on unmount or close
  const stopScanner = useCallback(async () => {
    isStartingRef.current = false;
    setTorchEnabled(false);
    videoTrackRef.current = null;
    
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
      releaseMediaStreams();
      await new Promise(resolve => setTimeout(resolve, 200));
      await nextPaint();

      const container = document.getElementById('scanner-container');
      if (!container) {
        throw new Error('Scanner container not found');
      }

      // Enumerate devices for debug panel
      await enumerateDevices();

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

      // Performance optimization: lower FPS for low-end devices
      const fps = isLowEnd ? 5 : 10;
      
      await html5QrCode.start(
        { facingMode: { ideal: 'environment' } },
        {
          fps,
          qrbox: createQrboxFunction(isLowEnd),
          aspectRatio: 1.333, // 4:3 aspect ratio
        },
        (decodedText) => {
          if (lastScannedRef.current === decodedText) return;
          
          lastScannedRef.current = decodedText;
          
          if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
          }
          
          if ('vibrate' in navigator) {
            navigator.vibrate(100);
          }
          
          stopScanner().then(() => {
            onScanSuccess(decodedText);
          });
          
          debounceTimeoutRef.current = setTimeout(() => {
            lastScannedRef.current = null;
          }, 3000);
        },
        () => {}
      );

      setPermissionState('granted');
      setIsScanning(true);
      setIsInitializing(false);

      // Get video track for torch control and debug info
      const videoEl = container.querySelector('video') as HTMLVideoElement | null;
      if (videoEl) {
        videoEl.setAttribute('playsinline', 'true');
        videoEl.playsInline = true;
        videoEl.muted = true;
        videoEl.style.width = '100%';
        videoEl.style.height = '100%';
        videoEl.style.objectFit = 'cover';

        const stream = videoEl.srcObject as MediaStream;
        if (stream) {
          const track = stream.getVideoTracks()[0];
          videoTrackRef.current = track;
          updateTrackDebugInfo(track);

          // Monitor track state changes
          track.onended = () => {
            setDebugInfo(prev => ({ ...prev, trackState: 'ended' }));
            addDebugError('Video track ended unexpectedly');
          };
          track.onmute = () => addDebugError('Video track muted');
        }
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
      addDebugError(`${errorName}: ${errorMsg}`);
      
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
  }, [onScanSuccess, stopScanner, enumerateDevices, updateTrackDebugInfo, addDebugError, isLowEnd]);

  // Check camera permission on open
  useEffect(() => {
    isOpenRef.current = isOpen;
    if (!isOpen) {
      stopScanner();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionState('error');
      setErrorMessage('Camera is not supported on this device or browser.');
      addDebugError('getUserMedia not supported');
      return;
    }

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
        handleRequestPermission();
      });

    return () => {
      stopScanner();
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [isOpen, startScanner, stopScanner, addDebugError]);

  const handleRequestPermission = async () => {
    try {
      releaseMediaStreams();
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: { ideal: 'environment' } }
      });
      
      stream.getTracks().forEach(track => track.stop());
      
      setPermissionState('granted');
      retryCountRef.current = 0;
      
      await new Promise(resolve => setTimeout(resolve, 300));
      await nextPaint();
      startScanner();
    } catch (err: any) {
      addDebugError(`Permission request failed: ${err.name}`);
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
    
    await stopScanner();
    
    const delay = Math.min(500 + (retryCountRef.current * 300), 2000);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    setPermissionState('prompt');
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
                      {isLowEnd && (
                        <p className="text-muted-foreground text-xs mt-1">Optimized for your device</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Guided overlay with tips and torch */}
                {showScannerUi && !isInitializing && (
                  <ScannerGuidedOverlay
                    torchSupported={torchSupported}
                    torchEnabled={torchEnabled}
                    onToggleTorch={toggleTorch}
                  />
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
              </div>

              {showScannerUi && (
                <p className="text-center text-muted-foreground text-sm mt-4 font-serif">
                  Position barcode in center of frame
                </p>
              )}

              {/* Debug Panel */}
              {showScannerUi && (
                <ScannerDebugPanel debugInfo={debugInfo} />
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
