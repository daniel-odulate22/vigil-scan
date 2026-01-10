import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import VigilantEyes from './VigilantEyes';

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

const SplashScreen = ({ onComplete, duration = 3500 }: SplashScreenProps) => {
  const [showTitle, setShowTitle] = useState(false);

  useEffect(() => {
    // Show title after eyes animation settles
    const titleTimer = setTimeout(() => {
      setShowTitle(true);
    }, 1200);

    // Complete splash after full duration
    const completeTimer = setTimeout(() => {
      onComplete();
    }, duration);

    return () => {
      clearTimeout(titleTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete, duration]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Vigilant Eyes */}
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <VigilantEyes />
        </motion.div>

        {/* Title */}
        <AnimatePresence>
          {showTitle && (
            <motion.div
              className="mt-8 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <h1 className="text-5xl font-display font-bold text-primary tracking-wide">
                Vigil
              </h1>
              <motion.p
                className="mt-2 text-muted-foreground text-lg font-serif italic"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                Always watching over your health
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Subtle loading indicator */}
        <motion.div
          className="absolute bottom-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
        >
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-primary"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SplashScreen;
