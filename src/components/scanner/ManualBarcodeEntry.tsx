import { useState } from 'react';
import { motion } from 'framer-motion';
import { Keyboard, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ManualBarcodeEntryProps {
  onSubmit: (code: string) => void;
  onCancel: () => void;
}

// Validate barcode format (UPC-A, UPC-E, EAN-8, EAN-13, NDC)
const validateBarcode = (code: string): { valid: boolean; type: string; error?: string } => {
  const cleaned = code.replace(/[\s-]/g, '');
  
  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, type: '', error: 'Barcode must contain only numbers' };
  }
  
  if (cleaned.length === 8) {
    return { valid: true, type: 'UPC-E / EAN-8' };
  }
  
  if (cleaned.length === 10 || cleaned.length === 11) {
    return { valid: true, type: 'NDC' };
  }
  
  if (cleaned.length === 12) {
    return { valid: true, type: 'UPC-A' };
  }
  
  if (cleaned.length === 13) {
    return { valid: true, type: 'EAN-13' };
  }
  
  if (cleaned.length === 14) {
    return { valid: true, type: 'GTIN-14' };
  }
  
  if (cleaned.length < 8) {
    return { valid: false, type: '', error: 'Barcode is too short (min 8 digits)' };
  }
  
  if (cleaned.length > 14) {
    return { valid: false, type: '', error: 'Barcode is too long (max 14 digits)' };
  }
  
  return { valid: true, type: 'Unknown format' };
};

const ManualBarcodeEntry = ({ onSubmit, onCancel }: ManualBarcodeEntryProps) => {
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);
  
  const validation = validateBarcode(code);
  const showError = touched && code.length > 0 && !validation.valid;
  const canSubmit = code.length > 0 && validation.valid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) {
      const cleaned = code.replace(/[\s-]/g, '');
      onSubmit(cleaned);
    }
  };

  return (
    <motion.div
      className="w-full max-w-sm mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto mb-4 bg-secondary rounded-full flex items-center justify-center">
          <Keyboard className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-lg font-display font-semibold text-foreground mb-1">
          Enter Barcode Manually
        </h3>
        <p className="text-sm text-muted-foreground font-serif">
          Type the numbers below the barcode on your medication package
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="barcode" className="text-sm font-medium">
            Barcode Number
          </Label>
          <Input
            id="barcode"
            type="text"
            inputMode="numeric"
            pattern="[0-9\s\-]*"
            placeholder="e.g., 0363602052301"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onBlur={() => setTouched(true)}
            className={`text-center text-lg font-mono tracking-wider ${
              showError ? 'border-destructive focus-visible:ring-destructive' : ''
            }`}
            autoComplete="off"
            autoFocus
          />
          
          {/* Validation feedback */}
          <div className="h-5">
            {showError ? (
              <motion.p
                className="text-xs text-destructive flex items-center gap-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <AlertCircle className="w-3 h-3" />
                {validation.error}
              </motion.p>
            ) : code.length > 0 && validation.valid ? (
              <motion.p
                className="text-xs text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                Detected format: <span className="text-primary font-medium">{validation.type}</span>
              </motion.p>
            ) : null}
          </div>
        </div>

        {/* Example formats */}
        <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
          <p className="font-medium mb-1">Accepted formats:</p>
          <ul className="space-y-0.5">
            <li>• UPC-A (12 digits) - Most common US products</li>
            <li>• EAN-13 (13 digits) - International products</li>
            <li>• NDC (10-11 digits) - Drug identification</li>
          </ul>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit}
            className="flex-1"
          >
            Look Up
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </form>
    </motion.div>
  );
};

export default ManualBarcodeEntry;
