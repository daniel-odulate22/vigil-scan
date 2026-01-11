import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, AlertTriangle, Loader2, Pill, Building2, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MedicationData {
  brand_name?: string;
  generic_name?: string;
  manufacturer_name?: string;
  product_ndc?: string;
  dosage_form?: string;
  route?: string;
  active_ingredients?: Array<{ name: string; strength: string }>;
}

interface VerifyModalProps {
  isOpen: boolean;
  barcode: string;
  onClose: () => void;
  onConfirm: (data: MedicationData) => void;
  onAddToPrescriptions: (data: MedicationData) => void;
}

const VerifyModal = ({
  isOpen,
  barcode,
  onClose,
  onConfirm,
  onAddToPrescriptions,
}: VerifyModalProps) => {
  const [loading, setLoading] = useState(true);
  const [medicationData, setMedicationData] = useState<MedicationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !barcode) return;

    const fetchMedicationData = async () => {
      setLoading(true);
      setError(null);
      setMedicationData(null);

      try {
        // Format NDC code - remove any non-numeric characters
        const cleanedCode = barcode.replace(/\D/g, '');
        
        // Try OpenFDA API with the NDC code
        const response = await fetch(
          `https://api.fda.gov/drug/ndc.json?search=product_ndc:"${cleanedCode}"+OR+package_ndc:"${cleanedCode}"&limit=1`
        );

        if (!response.ok) {
          // Try alternative search formats
          const altResponse = await fetch(
            `https://api.fda.gov/drug/ndc.json?search=packaging.package_ndc:"${cleanedCode}"&limit=1`
          );
          
          if (!altResponse.ok) {
            throw new Error('Medication not found');
          }
          
          const altData = await altResponse.json();
          if (altData.results && altData.results.length > 0) {
            setMedicationData(altData.results[0]);
          } else {
            throw new Error('Medication not found');
          }
        } else {
          const data = await response.json();
          if (data.results && data.results.length > 0) {
            setMedicationData(data.results[0]);
          } else {
            throw new Error('Medication not found');
          }
        }
      } catch (err: any) {
        setError(
          err.message === 'Medication not found'
            ? 'Medication not found in database. Please verify manually or add details.'
            : 'Failed to fetch medication data. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMedicationData();
  }, [isOpen, barcode]);

  const handleConfirmAndLog = () => {
    if (medicationData) {
      onConfirm(medicationData);
    }
  };

  const handleAddToPrescriptions = () => {
    if (medicationData) {
      onAddToPrescriptions(medicationData);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-foreground/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal - Slide up from bottom */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl max-h-[85vh] overflow-auto safe-area-bottom"
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
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-display font-semibold text-foreground">
                  Verify Medication
                </h2>
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                  <p className="text-muted-foreground font-serif">Looking up medication...</p>
                </div>
              )}

              {/* Error State */}
              {!loading && error && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-destructive/10 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-destructive" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Not Found</h3>
                  <p className="text-muted-foreground font-serif text-sm mb-6">{error}</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Scanned code: <span className="font-mono">{barcode}</span>
                  </p>
                  <Button variant="outline" onClick={onClose} className="w-full">
                    Try Another Scan
                  </Button>
                </div>
              )}

              {/* Success State */}
              {!loading && medicationData && (
                <>
                  {/* Safety Warning */}
                  <div className="bg-secondary/50 border border-secondary rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Please verify</p>
                        <p className="text-sm text-muted-foreground font-serif">
                          Confirm this information matches your physical medication label.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Medication Details */}
                  <div className="space-y-4 mb-8">
                    {/* Name */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center shrink-0">
                        <Pill className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          Medication
                        </p>
                        <p className="text-lg font-semibold text-foreground">
                          {medicationData.brand_name || medicationData.generic_name || 'Unknown'}
                        </p>
                        {medicationData.brand_name && medicationData.generic_name && (
                          <p className="text-sm text-muted-foreground font-serif">
                            {medicationData.generic_name}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Manufacturer */}
                    {medicationData.manufacturer_name && (
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            Manufacturer
                          </p>
                          <p className="text-foreground font-medium">
                            {medicationData.manufacturer_name}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* NDC */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center shrink-0">
                        <Hash className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                          NDC Code
                        </p>
                        <p className="text-foreground font-mono text-sm">
                          {medicationData.product_ndc || barcode}
                        </p>
                      </div>
                    </div>

                    {/* Dosage Form */}
                    {medicationData.dosage_form && (
                      <div className="bg-muted/50 rounded-lg px-4 py-2">
                        <span className="text-sm text-muted-foreground">
                          {medicationData.dosage_form}
                          {medicationData.route && ` • ${medicationData.route}`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <Button onClick={handleConfirmAndLog} className="w-full h-14 text-base">
                      <Check className="w-5 h-5 mr-2" />
                      Confirm & Log as Taken
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleAddToPrescriptions}
                      className="w-full h-12"
                    >
                      Add to My Prescriptions
                    </Button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default VerifyModal;
