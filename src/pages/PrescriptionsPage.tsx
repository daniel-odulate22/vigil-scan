import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pill, MoreVertical, Trash2, Edit, Bell } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import EditPrescriptionForm from '@/components/EditPrescriptionForm';
import ReminderManager from '@/components/ReminderManager';

interface Prescription {
  id: string;
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
  manufacturer: string | null;
  instructions: string | null;
  is_active: boolean;
  created_at: string;
}

const PrescriptionsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPrescription, setEditingPrescription] = useState<Prescription | null>(null);
  const [reminderPrescription, setReminderPrescription] = useState<Prescription | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchPrescriptions = async () => {
      try {
        const { data, error } = await supabase
          .from('prescriptions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setPrescriptions(data || []);
      } catch (err) {
        console.error('Error fetching prescriptions:', err);
        toast({
          title: 'Error',
          description: 'Failed to load prescriptions',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPrescriptions();
  }, [user, toast]);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('prescriptions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPrescriptions((prev) => prev.filter((p) => p.id !== id));
      toast({
        title: 'Deleted',
        description: 'Prescription removed successfully',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to delete prescription',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('prescriptions')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      setPrescriptions((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_active: !currentStatus } : p))
      );
      toast({
        title: currentStatus ? 'Deactivated' : 'Activated',
        description: `Prescription marked as ${currentStatus ? 'inactive' : 'active'}`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update prescription',
        variant: 'destructive',
      });
    }
  };

  const handlePrescriptionSaved = (updated: Prescription) => {
    setPrescriptions((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );
  };

  return (
    <div className="pb-24 pt-4 px-4">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            My Prescriptions
          </h1>
          <p className="text-muted-foreground font-serif text-sm">
            {prescriptions.filter((p) => p.is_active).length} active medications
          </p>
        </div>
      </motion.div>

      {/* Prescriptions List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-xl p-4 border border-border animate-pulse">
              <div className="h-5 bg-muted rounded w-2/3 mb-2" />
              <div className="h-4 bg-muted rounded w-1/2 mb-2" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : prescriptions.length === 0 ? (
        <motion.div
          className="bg-card rounded-xl p-8 border border-border text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="w-16 h-16 mx-auto mb-4 bg-secondary rounded-full flex items-center justify-center">
            <Pill className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-display font-semibold text-foreground mb-2">
            No prescriptions yet
          </h3>
          <p className="text-muted-foreground font-serif mb-6">
            Scan a medication barcode to add it to your list.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {prescriptions.map((prescription, index) => (
            <motion.div
              key={prescription.id}
              className={`bg-card rounded-xl p-4 border border-border ${
                !prescription.is_active ? 'opacity-60' : ''
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center shrink-0">
                    <Pill className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {prescription.medication_name}
                    </h3>
                    {prescription.dosage && (
                      <p className="text-sm text-muted-foreground">{prescription.dosage}</p>
                    )}
                    {prescription.frequency && (
                      <p className="text-xs text-muted-foreground font-serif mt-1">
                        {prescription.frequency}
                      </p>
                    )}
                    {!prescription.is_active && (
                      <span className="inline-block mt-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditingPrescription(prescription)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setReminderPrescription(prescription)}>
                      <Bell className="w-4 h-4 mr-2" />
                      Reminders
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleToggleActive(prescription.id, prescription.is_active)}
                    >
                      {prescription.is_active ? 'Mark as Inactive' : 'Mark as Active'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(prescription.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {prescription.instructions && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground font-serif">
                    {prescription.instructions}
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {editingPrescription && (
          <EditPrescriptionForm
            prescription={editingPrescription}
            onClose={() => setEditingPrescription(null)}
            onSaved={handlePrescriptionSaved}
          />
        )}
      </AnimatePresence>

      {/* Reminder Modal */}
      <AnimatePresence>
        {reminderPrescription && (
          <ReminderManager
            prescriptionId={reminderPrescription.id}
            medicationName={reminderPrescription.medication_name}
            onClose={() => setReminderPrescription(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default PrescriptionsPage;
