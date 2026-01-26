import { motion } from 'framer-motion';
import { Zap, ZapOff, Sun, Move, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ScannerGuidedOverlayProps {
  torchSupported: boolean;
  torchEnabled: boolean;
  onToggleTorch: () => void;
}

const tips = [
  { icon: Ruler, text: 'Hold 6-12 inches away' },
  { icon: Sun, text: 'Ensure good lighting' },
  { icon: Move, text: 'Keep steady, avoid shaking' },
];

const ScannerGuidedOverlay = ({
  torchSupported,
  torchEnabled,
  onToggleTorch,
}: ScannerGuidedOverlayProps) => {
  return (
    <>
      {/* Torch toggle button */}
      {torchSupported && (
        <motion.div
          className="absolute top-4 right-4 z-20"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Button
            variant={torchEnabled ? 'default' : 'secondary'}
            size="icon"
            onClick={onToggleTorch}
            className="rounded-full w-12 h-12 shadow-lg"
            aria-label={torchEnabled ? 'Turn off flash' : 'Turn on flash'}
          >
            {torchEnabled ? (
              <Zap className="w-5 h-5" />
            ) : (
              <ZapOff className="w-5 h-5" />
            )}
          </Button>
        </motion.div>
      )}

      {/* Scanning tips carousel */}
      <motion.div
        className="absolute top-4 left-4 right-16 z-20"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {tips.map((tip, index) => (
            <motion.div
              key={index}
              className="flex-shrink-0 flex items-center gap-1.5 bg-background/80 backdrop-blur-sm px-2.5 py-1.5 rounded-full text-xs"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
            >
              <tip.icon className="w-3.5 h-3.5 text-primary" />
              <span className="text-foreground whitespace-nowrap">{tip.text}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Center guide box with animated corners */}
      <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
        <div className="relative w-[80%] max-w-[320px] aspect-[2/1]">
          {/* Animated glow effect */}
          <motion.div
            className="absolute inset-0 rounded-lg"
            style={{
              background: 'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.1), transparent)',
            }}
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'linear',
            }}
          />

          {/* Corner brackets with glow */}
          <div className="absolute -top-1 -left-1 w-8 h-8 border-t-3 border-l-3 border-primary rounded-tl-lg shadow-[0_0_10px_hsl(var(--primary)/0.5)]" />
          <div className="absolute -top-1 -right-1 w-8 h-8 border-t-3 border-r-3 border-primary rounded-tr-lg shadow-[0_0_10px_hsl(var(--primary)/0.5)]" />
          <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-3 border-l-3 border-primary rounded-bl-lg shadow-[0_0_10px_hsl(var(--primary)/0.5)]" />
          <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-3 border-r-3 border-primary rounded-br-lg shadow-[0_0_10px_hsl(var(--primary)/0.5)]" />
        </div>
      </div>
    </>
  );
};

export default ScannerGuidedOverlay;
