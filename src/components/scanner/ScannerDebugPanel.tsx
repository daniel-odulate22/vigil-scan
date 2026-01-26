import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CameraDebugInfo {
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  trackSettings: MediaTrackSettings | null;
  trackState: string | null;
  capabilities: MediaTrackCapabilities | null;
  errors: string[];
}

interface ScannerDebugPanelProps {
  debugInfo: CameraDebugInfo;
}

const ScannerDebugPanel = ({ debugInfo }: ScannerDebugPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="absolute bottom-4 left-4 right-4 z-30">
      <motion.div
        className="bg-background/95 backdrop-blur-sm rounded-lg border border-border shadow-lg overflow-hidden"
        initial={false}
        animate={{ height: isExpanded ? 'auto' : '40px' }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between h-10 px-3"
        >
          <span className="flex items-center gap-2 text-xs font-mono">
            <Bug className="w-4 h-4 text-primary" />
            Camera Debug
          </span>
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </Button>

        {isExpanded && (
          <div className="p-3 pt-0 space-y-3 max-h-48 overflow-y-auto text-xs font-mono">
            {/* Devices */}
            <div>
              <p className="text-muted-foreground mb-1">Devices ({debugInfo.devices.length}):</p>
              <div className="space-y-1">
                {debugInfo.devices.length === 0 ? (
                  <p className="text-destructive">No cameras found</p>
                ) : (
                  debugInfo.devices.map((device, i) => (
                    <div
                      key={device.deviceId}
                      className={`p-1.5 rounded text-[10px] ${
                        device.deviceId === debugInfo.selectedDeviceId
                          ? 'bg-primary/20 border border-primary/50'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="truncate">{device.label || `Camera ${i + 1}`}</p>
                      <p className="text-muted-foreground truncate">ID: {device.deviceId.slice(0, 20)}...</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Track State */}
            <div>
              <p className="text-muted-foreground mb-1">Track State:</p>
              <span
                className={`inline-block px-2 py-0.5 rounded ${
                  debugInfo.trackState === 'live'
                    ? 'bg-green-500/20 text-green-400'
                    : debugInfo.trackState === 'ended'
                    ? 'bg-destructive/20 text-destructive'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {debugInfo.trackState || 'N/A'}
              </span>
            </div>

            {/* Track Settings */}
            {debugInfo.trackSettings && (
              <div>
                <p className="text-muted-foreground mb-1">Track Settings:</p>
                <div className="bg-muted p-2 rounded text-[10px] space-y-0.5">
                  <p>Resolution: {debugInfo.trackSettings.width}×{debugInfo.trackSettings.height}</p>
                  <p>Frame Rate: {debugInfo.trackSettings.frameRate?.toFixed(1)} fps</p>
                  <p>Facing: {debugInfo.trackSettings.facingMode || 'unknown'}</p>
                </div>
              </div>
            )}

            {/* Capabilities */}
            {debugInfo.capabilities && (
              <div>
                <p className="text-muted-foreground mb-1">Capabilities:</p>
                <div className="bg-muted p-2 rounded text-[10px] space-y-0.5">
                  <p>Torch: {(debugInfo.capabilities as any).torch ? '✓ Supported' : '✗ Not supported'}</p>
                  <p>Zoom: {(debugInfo.capabilities as any).zoom ? `${(debugInfo.capabilities as any).zoom.min}-${(debugInfo.capabilities as any).zoom.max}×` : '✗'}</p>
                </div>
              </div>
            )}

            {/* Errors */}
            {debugInfo.errors.length > 0 && (
              <div>
                <p className="text-destructive mb-1">Errors ({debugInfo.errors.length}):</p>
                <div className="space-y-1">
                  {debugInfo.errors.slice(-3).map((err, i) => (
                    <p key={i} className="bg-destructive/10 text-destructive p-1.5 rounded text-[10px] break-all">
                      {err}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ScannerDebugPanel;
