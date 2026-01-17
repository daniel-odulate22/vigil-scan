import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Shield, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DrugInteraction {
  severity: 'high' | 'moderate' | 'low';
  description: string;
  drug1: string;
  drug2: string;
}

interface InteractionWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  onCancel: () => void;
  interactions: DrugInteraction[];
  newDrugName: string;
}

const severityColors = {
  high: {
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
    text: 'text-destructive',
    badge: 'bg-destructive text-destructive-foreground',
  },
  moderate: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500 text-white',
  },
  low: {
    bg: 'bg-primary/10',
    border: 'border-primary/30',
    text: 'text-primary',
    badge: 'bg-primary/80 text-primary-foreground',
  },
};

const severityLabels = {
  high: 'High Risk',
  moderate: 'Moderate',
  low: 'Low Risk',
};

const InteractionWarningModal = ({
  isOpen,
  onClose,
  onContinue,
  onCancel,
  interactions,
  newDrugName,
}: InteractionWarningModalProps) => {
  // Get the highest severity interaction
  const highestSeverity = interactions.reduce<'high' | 'moderate' | 'low'>(
    (highest, interaction) => {
      const order = { high: 3, moderate: 2, low: 1 };
      return order[interaction.severity] > order[highest]
        ? interaction.severity
        : highest;
    },
    'low'
  );

  const colors = severityColors[highestSeverity];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[60] bg-foreground/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[60] bg-card rounded-t-3xl max-h-[90vh] overflow-auto safe-area-bottom"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </div>

            <div className="px-6 pb-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-display font-semibold text-foreground">
                  Interaction Warning
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

              {/* Warning Banner */}
              <motion.div
                className={`${colors.bg} ${colors.border} border rounded-xl p-4 mb-6`}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 ${colors.badge} rounded-full flex items-center justify-center shrink-0`}
                  >
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-semibold ${colors.text}`}>
                        {severityLabels[highestSeverity]}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}
                      >
                        {interactions.length} interaction
                        {interactions.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-sm text-foreground font-medium">
                      {newDrugName} may interact with your current medications
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Interactions List */}
              <div className="space-y-3 mb-6">
                {interactions.map((interaction, index) => {
                  const iColors = severityColors[interaction.severity];
                  return (
                    <motion.div
                      key={index}
                      className={`${iColors.bg} ${iColors.border} border rounded-xl p-4`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + index * 0.05 }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-foreground">
                          {interaction.drug1}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-foreground">
                          {interaction.drug2}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground font-serif leading-relaxed">
                        {interaction.description}
                      </p>
                    </motion.div>
                  );
                })}
              </div>

              {/* Disclaimer */}
              <div className="bg-muted/50 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground font-serif leading-relaxed">
                    <strong className="text-foreground">Important:</strong> This
                    information is for reference only and does not replace
                    professional medical advice. Please consult your healthcare
                    provider or pharmacist before taking these medications together.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  variant="outline"
                  onClick={onContinue}
                  className="w-full h-12"
                >
                  I Understand, Continue Anyway
                </Button>
                <Button onClick={onCancel} className="w-full h-14 text-base">
                  Cancel & Go Back
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default InteractionWarningModal;
