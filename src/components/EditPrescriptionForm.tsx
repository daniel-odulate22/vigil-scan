import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const editPrescriptionSchema = z.object({
  medication_name: z.string().trim().min(1, 'Medication name is required').max(200),
  dosage: z.string().trim().max(100).optional().or(z.literal('')),
  frequency: z.string().trim().max(100).optional().or(z.literal('')),
  manufacturer: z.string().trim().max(200).optional().or(z.literal('')),
  instructions: z.string().trim().max(500).optional().or(z.literal('')),
});

type EditPrescriptionFormData = z.infer<typeof editPrescriptionSchema>;

interface Prescription {
  id: string;
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
  manufacturer: string | null;
  instructions: string | null;
  is_active: boolean;
}

interface EditPrescriptionFormProps {
  prescription: Prescription;
  onClose: () => void;
  onSaved: (updated: Prescription) => void;
}

const EditPrescriptionForm = ({ prescription, onClose, onSaved }: EditPrescriptionFormProps) => {
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditPrescriptionFormData>({
    resolver: zodResolver(editPrescriptionSchema),
    defaultValues: {
      medication_name: prescription.medication_name,
      dosage: prescription.dosage || '',
      frequency: prescription.frequency || '',
      manufacturer: prescription.manufacturer || '',
      instructions: prescription.instructions || '',
    },
  });

  const onSubmit = async (data: EditPrescriptionFormData) => {
    try {
      const { error } = await supabase
        .from('prescriptions')
        .update({
          medication_name: data.medication_name,
          dosage: data.dosage || null,
          frequency: data.frequency || null,
          manufacturer: data.manufacturer || null,
          instructions: data.instructions || null,
        })
        .eq('id', prescription.id);

      if (error) throw error;

      onSaved({
        ...prescription,
        medication_name: data.medication_name,
        dosage: data.dosage || null,
        frequency: data.frequency || null,
        manufacturer: data.manufacturer || null,
        instructions: data.instructions || null,
      });

      toast({
        title: 'Updated!',
        description: 'Prescription details saved successfully.',
      });

      onClose();
    } catch (err) {
      console.error('Error updating prescription:', err);
      toast({
        title: 'Error',
        description: 'Failed to update prescription.',
        variant: 'destructive',
      });
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-card w-full max-w-lg rounded-t-2xl sm:rounded-2xl border border-border p-6 max-h-[90vh] overflow-y-auto"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-display font-bold text-foreground">
            Edit Prescription
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Medication Name */}
          <div className="space-y-2">
            <Label htmlFor="medication_name">Medication Name *</Label>
            <Input
              id="medication_name"
              {...register('medication_name')}
              placeholder="e.g., Lisinopril"
              className={errors.medication_name ? 'border-destructive' : ''}
            />
            {errors.medication_name && (
              <p className="text-xs text-destructive">{errors.medication_name.message}</p>
            )}
          </div>

          {/* Dosage */}
          <div className="space-y-2">
            <Label htmlFor="dosage">Dosage</Label>
            <Input
              id="dosage"
              {...register('dosage')}
              placeholder="e.g., 10mg"
            />
            {errors.dosage && (
              <p className="text-xs text-destructive">{errors.dosage.message}</p>
            )}
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency</Label>
            <Input
              id="frequency"
              {...register('frequency')}
              placeholder="e.g., Once daily"
            />
            {errors.frequency && (
              <p className="text-xs text-destructive">{errors.frequency.message}</p>
            )}
          </div>

          {/* Manufacturer */}
          <div className="space-y-2">
            <Label htmlFor="manufacturer">Manufacturer</Label>
            <Input
              id="manufacturer"
              {...register('manufacturer')}
              placeholder="e.g., Pfizer"
            />
            {errors.manufacturer && (
              <p className="text-xs text-destructive">{errors.manufacturer.message}</p>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              {...register('instructions')}
              placeholder="e.g., Take with food"
              rows={3}
            />
            {errors.instructions && (
              <p className="text-xs text-destructive">{errors.instructions.message}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isSubmitting}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default EditPrescriptionForm;
