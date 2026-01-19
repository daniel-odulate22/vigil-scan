import { motion } from 'framer-motion';
import { CalendarClock } from 'lucide-react';
import DoseTimeline from '@/components/DoseTimeline';

const SchedulePage = () => {
  return (
    <div className="pb-24 pt-4 px-4">
      {/* Header */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2 mb-1">
          <CalendarClock className="w-5 h-5 text-primary" />
          <p className="text-muted-foreground font-serif">Medication Schedule</p>
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground">
          Your Dosing Timeline
        </h1>
      </motion.div>

      {/* Timeline Component */}
      <DoseTimeline />
    </div>
  );
};

export default SchedulePage;
