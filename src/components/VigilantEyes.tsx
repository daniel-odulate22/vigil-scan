import { motion } from 'framer-motion';

interface VigilantEyesProps {
  className?: string;
}

const VigilantEyes = ({ className = '' }: VigilantEyesProps) => {
  return (
    <div className={`flex items-center justify-center gap-4 ${className}`}>
      {/* Left Eye - Closed (sleepy) */}
      <motion.div
        className="relative"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="w-20 h-20 flex items-center justify-center">
          <motion.div
            className="w-16 h-3 bg-primary rounded-full"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          />
        </div>
      </motion.div>

      {/* Right Eye - Open (vigilant, scanning) */}
      <motion.div
        className="relative"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="w-20 h-20 flex items-center justify-center">
          {/* Eye white (sclera) */}
          <div className="relative w-16 h-16 bg-primary-foreground rounded-full border-4 border-primary overflow-hidden flex items-center justify-center">
            {/* Iris */}
            <motion.div
              className="relative w-8 h-8 bg-primary rounded-full flex items-center justify-center"
              animate={{ x: [-6, 6, -6] }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {/* Pupil */}
              <div className="w-4 h-4 bg-foreground rounded-full" />
              
              {/* Light reflection */}
              <div className="absolute top-1 right-1 w-2 h-2 bg-primary-foreground rounded-full opacity-80" />
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default VigilantEyes;
