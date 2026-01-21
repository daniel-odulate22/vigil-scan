import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Clock, Pill, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, addDays, subDays, addWeeks, subWeeks, isSameDay, isToday, isBefore, parseISO } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

interface Reminder {
  id: string;
  prescription_id: string;
  reminder_time: string;
  days_of_week: number[];
  is_enabled: boolean;
}

interface Prescription {
  id: string;
  medication_name: string;
  dosage: string | null;
  is_active: boolean;
}

interface DoseLog {
  id: string;
  medication_name: string;
  taken_at: string;
  prescription_id: string | null;
}

interface ScheduledDose {
  id: string;
  prescriptionId: string;
  medicationName: string;
  dosage: string | null;
  scheduledTime: Date;
  status: 'taken' | 'missed' | 'upcoming';
  doseLogId?: string;
}

const DoseTimeline = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [view, setView] = useState<'daily' | 'weekly'>('daily');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingDose, setLoggingDose] = useState<string | null>(null);

  // Fetch data
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch active prescriptions
        const { data: prescriptionsData } = await supabase
          .from('prescriptions')
          .select('id, medication_name, dosage, is_active')
          .eq('user_id', user.id)
          .eq('is_active', true);

        // Fetch reminders for active prescriptions
        const { data: remindersData } = await supabase
          .from('medication_reminders')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_enabled', true);

        // Calculate date range for dose logs
        const rangeStart = view === 'daily' 
          ? startOfDay(currentDate)
          : startOfWeek(currentDate, { weekStartsOn: 0 });
        const rangeEnd = view === 'daily'
          ? endOfDay(currentDate)
          : endOfWeek(currentDate, { weekStartsOn: 0 });

        // Fetch dose logs for the date range
        const { data: doseLogsData } = await supabase
          .from('dose_logs')
          .select('id, medication_name, taken_at, prescription_id')
          .eq('user_id', user.id)
          .gte('taken_at', rangeStart.toISOString())
          .lte('taken_at', rangeEnd.toISOString());

        setPrescriptions(prescriptionsData || []);
        setReminders(remindersData || []);
        setDoseLogs(doseLogsData || []);
      } catch (err) {
        console.error('Error fetching schedule data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, currentDate, view]);

  // Calculate scheduled doses based on reminders
  const scheduledDoses = useMemo(() => {
    const doses: ScheduledDose[] = [];
    const now = new Date();

    const daysToCheck = view === 'daily' 
      ? [currentDate]
      : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(currentDate, { weekStartsOn: 0 }), i));

    daysToCheck.forEach(day => {
      const dayOfWeek = day.getDay();

      reminders.forEach(reminder => {
        if (!reminder.days_of_week.includes(dayOfWeek)) return;

        const prescription = prescriptions.find(p => p.id === reminder.prescription_id);
        if (!prescription) return;

        // Parse reminder time
        const [hours, minutes] = reminder.reminder_time.split(':').map(Number);
        const scheduledTime = new Date(day);
        scheduledTime.setHours(hours, minutes, 0, 0);

        // Check if dose was taken within 2 hours of scheduled time
        const matchingDose = doseLogs.find(log => {
          const logTime = new Date(log.taken_at);
          const timeDiff = Math.abs(logTime.getTime() - scheduledTime.getTime());
          const twoHoursMs = 2 * 60 * 60 * 1000;
          return (
            (log.prescription_id === prescription.id || 
             log.medication_name.toLowerCase() === prescription.medication_name.toLowerCase()) &&
            timeDiff <= twoHoursMs
          );
        });

        let status: 'taken' | 'missed' | 'upcoming';
        if (matchingDose) {
          status = 'taken';
        } else if (isBefore(scheduledTime, now)) {
          status = 'missed';
        } else {
          status = 'upcoming';
        }

        doses.push({
          id: `${reminder.id}-${format(day, 'yyyy-MM-dd')}`,
          prescriptionId: prescription.id,
          medicationName: prescription.medication_name,
          dosage: prescription.dosage,
          scheduledTime,
          status,
          doseLogId: matchingDose?.id,
        });
      });
    });

    // Sort by scheduled time
    return doses.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
  }, [reminders, prescriptions, doseLogs, currentDate, view]);

  // Group doses by date for weekly view
  const dosesByDate = useMemo(() => {
    const grouped = new Map<string, ScheduledDose[]>();
    scheduledDoses.forEach(dose => {
      const dateKey = format(dose.scheduledTime, 'yyyy-MM-dd');
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(dose);
    });
    return grouped;
  }, [scheduledDoses]);

  const navigateDate = (direction: 'prev' | 'next') => {
    if (view === 'daily') {
      setCurrentDate(direction === 'prev' ? subDays(currentDate, 1) : addDays(currentDate, 1));
    } else {
      setCurrentDate(direction === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    }
  };

  const getStatusIcon = (status: 'taken' | 'missed' | 'upcoming') => {
    switch (status) {
      case 'taken':
        return <Check className="w-4 h-4" />;
      case 'missed':
        return <X className="w-4 h-4" />;
      case 'upcoming':
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusStyles = (status: 'taken' | 'missed' | 'upcoming') => {
    switch (status) {
      case 'taken':
        return 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30';
      case 'missed':
        return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'upcoming':
        return 'bg-primary/10 text-primary border-primary/30';
    }
  };

  const getStatusBadgeStyles = (status: 'taken' | 'missed' | 'upcoming') => {
    switch (status) {
      case 'taken':
        return 'bg-green-500 text-white';
      case 'missed':
        return 'bg-destructive text-destructive-foreground';
      case 'upcoming':
        return 'bg-primary text-primary-foreground';
    }
  };

  // Stats for the current view
  const stats = useMemo(() => {
    const taken = scheduledDoses.filter(d => d.status === 'taken').length;
    const missed = scheduledDoses.filter(d => d.status === 'missed').length;
    const upcoming = scheduledDoses.filter(d => d.status === 'upcoming').length;
    const total = scheduledDoses.length;
    const adherenceRate = total > 0 ? Math.round(((taken) / (taken + missed)) * 100) : 100;
    return { taken, missed, upcoming, total, adherenceRate };
  }, [scheduledDoses]);

  // Quick log handler for missed doses
  const handleQuickLog = useCallback(async (dose: ScheduledDose) => {
    if (!user) return;
    
    setLoggingDose(dose.id);
    try {
      const { error } = await supabase.from('dose_logs').insert({
        user_id: user.id,
        prescription_id: dose.prescriptionId,
        medication_name: dose.medicationName,
        taken_at: new Date().toISOString(),
        verified: false,
        notes: `Quick-logged from schedule (originally scheduled for ${format(dose.scheduledTime, 'h:mm a')})`,
      });

      if (error) throw error;

      // Update local state to reflect the change
      setDoseLogs(prev => [...prev, {
        id: crypto.randomUUID(),
        medication_name: dose.medicationName,
        taken_at: new Date().toISOString(),
        prescription_id: dose.prescriptionId,
      }]);

      toast({
        title: 'Dose logged',
        description: `${dose.medicationName} marked as taken.`,
      });
    } catch (err) {
      console.error('Error logging dose:', err);
      toast({
        title: 'Error',
        description: 'Failed to log dose. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoggingDose(null);
    }
  }, [user, toast]);

  const renderDoseCard = (dose: ScheduledDose, index: number) => (
    <motion.div
      key={dose.id}
      className={`flex items-center gap-3 p-3 rounded-xl border ${getStatusStyles(dose.status)}`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStatusBadgeStyles(dose.status)}`}>
        {getStatusIcon(dose.status)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{dose.medicationName}</p>
        <p className="text-xs text-muted-foreground">
          {format(dose.scheduledTime, 'h:mm a')}
          {dose.dosage && ` • ${dose.dosage}`}
        </p>
      </div>
      {dose.status === 'missed' ? (
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 text-xs border-destructive/50 hover:bg-destructive/10"
          onClick={() => handleQuickLog(dose)}
          disabled={loggingDose === dose.id}
        >
          {loggingDose === dose.id ? (
            <motion.div
              className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          ) : (
            <Plus className="w-3 h-3" />
          )}
          Log Now
        </Button>
      ) : (
        <span className={`text-xs px-2 py-1 rounded-full capitalize ${getStatusBadgeStyles(dose.status)}`}>
          {dose.status}
        </span>
      )}
    </motion.div>
  );

  return (
    <div className="space-y-4">
      {/* View Tabs */}
      <Tabs value={view} onValueChange={(v) => setView(v as 'daily' | 'weekly')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Date Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigateDate('prev')}
          aria-label="Previous"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="text-center">
          <p className="font-display font-semibold text-foreground">
            {view === 'daily'
              ? isToday(currentDate)
                ? 'Today'
                : format(currentDate, 'EEEE, MMM d')
              : `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 0 }), 'MMM d')}`
            }
          </p>
          {view === 'daily' && !isToday(currentDate) && (
            <Button
              variant="link"
              size="sm"
              className="text-xs text-muted-foreground p-0 h-auto"
              onClick={() => setCurrentDate(new Date())}
            >
              Go to today
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigateDate('next')}
          aria-label="Next"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Stats Summary */}
      <motion.div
        className="grid grid-cols-3 gap-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="bg-green-500/10 rounded-xl p-3 text-center border border-green-500/20">
          <p className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.taken}</p>
          <p className="text-xs text-muted-foreground">Taken</p>
        </div>
        <div className="bg-destructive/10 rounded-xl p-3 text-center border border-destructive/20">
          <p className="text-2xl font-bold text-destructive">{stats.missed}</p>
          <p className="text-xs text-muted-foreground">Missed</p>
        </div>
        <div className="bg-primary/10 rounded-xl p-3 text-center border border-primary/20">
          <p className="text-2xl font-bold text-primary">{stats.upcoming}</p>
          <p className="text-xs text-muted-foreground">Upcoming</p>
        </div>
      </motion.div>

      {/* Adherence Rate */}
      {stats.taken + stats.missed > 0 && (
        <motion.div
          className="bg-card rounded-xl p-4 border border-border"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Adherence Rate</span>
            <span className="text-sm font-semibold text-foreground">{stats.adherenceRate}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${stats.adherenceRate}%` }}
              transition={{ duration: 0.5, delay: 0.2 }}
            />
          </div>
        </motion.div>
      )}

      {/* Dose List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : scheduledDoses.length === 0 ? (
        <motion.div
          className="bg-card rounded-xl p-6 border border-border text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="w-12 h-12 mx-auto mb-3 bg-secondary rounded-full flex items-center justify-center">
            <Pill className="w-6 h-6 text-primary" />
          </div>
          <p className="text-muted-foreground font-serif mb-2">
            No scheduled doses for this {view === 'daily' ? 'day' : 'week'}
          </p>
          <p className="text-xs text-muted-foreground">
            Add reminders to your prescriptions to see your schedule here.
          </p>
        </motion.div>
      ) : view === 'daily' ? (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {scheduledDoses.map((dose, index) => renderDoseCard(dose, index))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from({ length: 7 }, (_, i) => {
            const day = addDays(startOfWeek(currentDate, { weekStartsOn: 0 }), i);
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayDoses = dosesByDate.get(dateKey) || [];
            const dayIsToday = isToday(day);

            return (
              <motion.div
                key={dateKey}
                className={`rounded-xl border overflow-hidden ${
                  dayIsToday ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                }`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                {/* Day Header */}
                <div className={`px-4 py-2 flex items-center justify-between ${
                  dayIsToday ? 'bg-primary/10' : 'bg-muted/30'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${dayIsToday ? 'text-primary' : 'text-foreground'}`}>
                      {format(day, 'EEE')}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {format(day, 'MMM d')}
                    </span>
                    {dayIsToday && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                        Today
                      </span>
                    )}
                  </div>
                  {dayDoses.length > 0 && (
                    <div className="flex gap-1">
                      {dayDoses.filter(d => d.status === 'taken').length > 0 && (
                        <span className="w-5 h-5 bg-green-500 text-white text-xs rounded-full flex items-center justify-center">
                          {dayDoses.filter(d => d.status === 'taken').length}
                        </span>
                      )}
                      {dayDoses.filter(d => d.status === 'missed').length > 0 && (
                        <span className="w-5 h-5 bg-destructive text-white text-xs rounded-full flex items-center justify-center">
                          {dayDoses.filter(d => d.status === 'missed').length}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Day Doses */}
                <div className="p-2 space-y-1">
                  {dayDoses.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      No doses scheduled
                    </p>
                  ) : (
                    dayDoses.map((dose) => (
                      <div
                        key={dose.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg ${getStatusStyles(dose.status)}`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${getStatusBadgeStyles(dose.status)}`}>
                          {getStatusIcon(dose.status)}
                        </div>
                        <span className="text-sm font-medium text-foreground truncate flex-1">
                          {dose.medicationName}
                        </span>
                        {dose.status === 'missed' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 gap-1 text-xs"
                            onClick={() => handleQuickLog(dose)}
                            disabled={loggingDose === dose.id}
                          >
                            {loggingDose === dose.id ? (
                              <motion.div
                                className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              />
                            ) : (
                              <Plus className="w-3 h-3" />
                            )}
                            Log
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {format(dose.scheduledTime, 'h:mm a')}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DoseTimeline;
