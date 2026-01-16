import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, BellOff, Plus, Trash2, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNotifications, formatReminderTime, formatDays } from '@/hooks/useNotifications';

interface Reminder {
  id: string;
  prescription_id: string;
  reminder_time: string;
  days_of_week: number[];
  is_enabled: boolean;
}

interface ReminderManagerProps {
  prescriptionId: string;
  medicationName: string;
  onClose: () => void;
}

const DAYS = [
  { value: 0, label: 'S', full: 'Sunday' },
  { value: 1, label: 'M', full: 'Monday' },
  { value: 2, label: 'T', full: 'Tuesday' },
  { value: 3, label: 'W', full: 'Wednesday' },
  { value: 4, label: 'T', full: 'Thursday' },
  { value: 5, label: 'F', full: 'Friday' },
  { value: 6, label: 'S', full: 'Saturday' },
];

const ReminderManager = ({ prescriptionId, medicationName, onClose }: ReminderManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { permission, isSupported, requestPermission, sendNotification } = useNotifications();
  
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTime, setNewTime] = useState('09:00');
  const [newDays, setNewDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  useEffect(() => {
    if (!user) return;
    fetchReminders();
  }, [user, prescriptionId]);

  const fetchReminders = async () => {
    try {
      const { data, error } = await supabase
        .from('medication_reminders')
        .select('*')
        .eq('prescription_id', prescriptionId)
        .order('reminder_time');

      if (error) throw error;
      setReminders(data || []);
    } catch (err) {
      console.error('Error fetching reminders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast({
        title: 'Notifications enabled',
        description: 'You will now receive medication reminders.',
      });
      // Send a test notification
      sendNotification('Vigil Reminders Enabled', {
        body: 'You will now receive medication reminders.',
        tag: 'test-notification',
      });
    } else {
      toast({
        title: 'Permission denied',
        description: 'Enable notifications in your browser settings to receive reminders.',
        variant: 'destructive',
      });
    }
  };

  const handleAddReminder = async () => {
    if (!user || newDays.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('medication_reminders')
        .insert({
          user_id: user.id,
          prescription_id: prescriptionId,
          reminder_time: newTime,
          days_of_week: newDays,
          is_enabled: true,
        })
        .select()
        .single();

      if (error) throw error;

      setReminders((prev) => [...prev, data]);
      setShowAddForm(false);
      setNewTime('09:00');
      setNewDays([0, 1, 2, 3, 4, 5, 6]);

      toast({
        title: 'Reminder added',
        description: `You'll be reminded at ${formatReminderTime(newTime)}`,
      });
    } catch (err) {
      console.error('Error adding reminder:', err);
      toast({
        title: 'Error',
        description: 'Failed to add reminder',
        variant: 'destructive',
      });
    }
  };

  const handleToggleReminder = async (id: string, currentEnabled: boolean) => {
    try {
      const { error } = await supabase
        .from('medication_reminders')
        .update({ is_enabled: !currentEnabled })
        .eq('id', id);

      if (error) throw error;

      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_enabled: !currentEnabled } : r))
      );
    } catch (err) {
      console.error('Error toggling reminder:', err);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      const { error } = await supabase
        .from('medication_reminders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setReminders((prev) => prev.filter((r) => r.id !== id));
      toast({ title: 'Reminder deleted' });
    } catch (err) {
      console.error('Error deleting reminder:', err);
    }
  };

  const toggleDay = (day: number) => {
    setNewDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-display font-bold text-foreground">
              Reminders
            </h2>
            <p className="text-sm text-muted-foreground">{medicationName}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Notification Permission Warning */}
        {isSupported && permission !== 'granted' && (
          <motion.div
            className="bg-secondary/50 rounded-xl p-4 mb-4 border border-border"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-start gap-3">
              <BellOff className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground mb-1">
                  Enable notifications
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Allow notifications to receive medication reminders.
                </p>
                <Button size="sm" onClick={handleRequestPermission}>
                  <Bell className="w-4 h-4 mr-2" />
                  Enable
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Reminders List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-muted/30 rounded-xl p-4 animate-pulse">
                <div className="h-6 bg-muted rounded w-1/3 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            <AnimatePresence mode="popLayout">
              {reminders.map((reminder) => (
                <motion.div
                  key={reminder.id}
                  className={`bg-secondary/30 rounded-xl p-4 border border-border ${
                    !reminder.is_enabled ? 'opacity-50' : ''
                  }`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  layout
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-lg font-semibold text-foreground">
                          {formatReminderTime(reminder.reminder_time)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDays(reminder.days_of_week)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={reminder.is_enabled}
                        onCheckedChange={() =>
                          handleToggleReminder(reminder.id, reminder.is_enabled)
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteReminder(reminder.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {reminders.length === 0 && !showAddForm && (
              <div className="text-center py-6">
                <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">No reminders set</p>
              </div>
            )}
          </div>
        )}

        {/* Add Reminder Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              className="bg-secondary/30 rounded-xl p-4 border border-border mb-4"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Days</Label>
                  <div className="flex gap-1">
                    {DAYS.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        className={`w-9 h-9 rounded-full text-sm font-medium transition-colors ${
                          newDays.includes(day.value)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                        onClick={() => toggleDay(day.value)}
                        title={day.full}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleAddReminder}
                    disabled={newDays.length === 0}
                  >
                    Add Reminder
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Button */}
        {!showAddForm && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Reminder
          </Button>
        )}
      </motion.div>
    </motion.div>
  );
};

export default ReminderManager;
