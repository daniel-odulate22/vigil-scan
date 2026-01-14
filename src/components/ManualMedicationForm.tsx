import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Pill, Building2, Clock, FileText, Loader2, Check, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const manualEntrySchema = z.object({
  medication_name: z
    .string()
    .trim()
    .min(2, 'Medication name must be at least 2 characters')
    .max(100, 'Medication name must be less than 100 characters'),
  dosage: z
    .string()
    .trim()
    .max(50, 'Dosage must be less than 50 characters')
    .optional()
    .or(z.literal('')),
  manufacturer: z
    .string()
    .trim()
    .max(100, 'Manufacturer must be less than 100 characters')
    .optional()
    .or(z.literal('')),
  frequency: z.string().optional().or(z.literal('')),
  instructions: z
    .string()
    .trim()
    .max(500, 'Instructions must be less than 500 characters')
    .optional()
    .or(z.literal('')),
});

type ManualEntryFormData = z.infer<typeof manualEntrySchema>;

interface ManualMedicationFormProps {
  barcode: string;
  onSubmit: (data: {
    medication_name: string;
    dosage?: string;
    manufacturer?: string;
    frequency?: string;
    instructions?: string;
    ndc_code: string;
  }) => void;
  onLogAndSubmit: (data: {
    medication_name: string;
    dosage?: string;
    manufacturer?: string;
    frequency?: string;
    instructions?: string;
    ndc_code: string;
  }) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const frequencyOptions = [
  { value: 'once_daily', label: 'Once daily' },
  { value: 'twice_daily', label: 'Twice daily' },
  { value: 'three_times_daily', label: 'Three times daily' },
  { value: 'four_times_daily', label: 'Four times daily' },
  { value: 'as_needed', label: 'As needed' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'other', label: 'Other' },
];

const ManualMedicationForm = ({
  barcode,
  onSubmit,
  onLogAndSubmit,
  onCancel,
  isSubmitting = false,
}: ManualMedicationFormProps) => {
  const form = useForm<ManualEntryFormData>({
    resolver: zodResolver(manualEntrySchema),
    defaultValues: {
      medication_name: '',
      dosage: '',
      manufacturer: '',
      frequency: '',
      instructions: '',
    },
  });

  const handleAddToPrescriptions = (data: ManualEntryFormData) => {
    onSubmit({
      medication_name: data.medication_name,
      dosage: data.dosage || undefined,
      manufacturer: data.manufacturer || undefined,
      frequency: data.frequency || undefined,
      instructions: data.instructions || undefined,
      ndc_code: barcode,
    });
  };

  const handleLogAndAdd = (data: ManualEntryFormData) => {
    onLogAndSubmit({
      medication_name: data.medication_name,
      dosage: data.dosage || undefined,
      manufacturer: data.manufacturer || undefined,
      frequency: data.frequency || undefined,
      instructions: data.instructions || undefined,
      ndc_code: barcode,
    });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Warning Banner */}
      <motion.div
        variants={itemVariants}
        className="bg-secondary/50 border border-secondary rounded-xl p-4"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Manual Entry</p>
            <p className="text-sm text-muted-foreground font-serif">
              This medication was not found in our database. Please enter details carefully and verify against your physical label.
            </p>
          </div>
        </div>
      </motion.div>

      {/* NDC Code Display */}
      <motion.div variants={itemVariants} className="bg-muted/50 rounded-lg px-4 py-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Scanned Code: </span>
        <span className="font-mono text-sm text-foreground">{barcode}</span>
      </motion.div>

      <Form {...form}>
        <form className="space-y-4">
          {/* Medication Name */}
          <motion.div variants={itemVariants}>
            <FormField
              control={form.control}
              name="medication_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-foreground">
                    <Pill className="w-4 h-4 text-primary" />
                    Medication Name *
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Lisinopril, Metformin"
                      className="bg-background border-border focus:ring-2 focus:ring-primary/20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-destructive" />
                </FormItem>
              )}
            />
          </motion.div>

          {/* Dosage */}
          <motion.div variants={itemVariants}>
            <FormField
              control={form.control}
              name="dosage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-foreground">
                    <FileText className="w-4 h-4 text-primary" />
                    Dosage
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., 10mg, 500mg tablet"
                      className="bg-background border-border focus:ring-2 focus:ring-primary/20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-destructive" />
                </FormItem>
              )}
            />
          </motion.div>

          {/* Manufacturer */}
          <motion.div variants={itemVariants}>
            <FormField
              control={form.control}
              name="manufacturer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-foreground">
                    <Building2 className="w-4 h-4 text-primary" />
                    Manufacturer
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Pfizer, Merck"
                      className="bg-background border-border focus:ring-2 focus:ring-primary/20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-destructive" />
                </FormItem>
              )}
            />
          </motion.div>

          {/* Frequency */}
          <motion.div variants={itemVariants}>
            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-foreground">
                    <Clock className="w-4 h-4 text-primary" />
                    Frequency
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background border-border focus:ring-2 focus:ring-primary/20">
                        <SelectValue placeholder="How often do you take this?" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {frequencyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-destructive" />
                </FormItem>
              )}
            />
          </motion.div>

          {/* Instructions */}
          <motion.div variants={itemVariants}>
            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-foreground">
                    <FileText className="w-4 h-4 text-primary" />
                    Special Instructions
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Take with food, Avoid alcohol"
                      className="bg-background border-border focus:ring-2 focus:ring-primary/20 min-h-[80px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-destructive" />
                </FormItem>
              )}
            />
          </motion.div>

          {/* Action Buttons */}
          <motion.div variants={itemVariants} className="space-y-3 pt-2">
            <Button
              type="button"
              onClick={form.handleSubmit(handleLogAndAdd)}
              disabled={isSubmitting}
              className="w-full h-14 text-base"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Check className="w-5 h-5 mr-2" />
              )}
              Log as Taken & Add
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={form.handleSubmit(handleAddToPrescriptions)}
              disabled={isSubmitting}
              className="w-full h-12"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add to My Prescriptions
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={isSubmitting}
              className="w-full"
            >
              Cancel
            </Button>
          </motion.div>
        </form>
      </Form>
    </motion.div>
  );
};

export default ManualMedicationForm;
