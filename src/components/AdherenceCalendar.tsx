import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, subMonths, addMonths, startOfWeek, endOfWeek } from 'date-fns';

interface DoseData {
  date: string;
  count: number;
}

const AdherenceCalendar = () => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [doseData, setDoseData] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchDoseData = async () => {
      setLoading(true);
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const { data, error } = await supabase
        .from('dose_logs')
        .select('taken_at')
        .eq('user_id', user.id)
        .gte('taken_at', monthStart.toISOString())
        .lte('taken_at', monthEnd.toISOString());

      if (error) {
        console.error('Error fetching dose data:', error);
        setLoading(false);
        return;
      }

      // Group by date
      const countMap = new Map<string, number>();
      data?.forEach((dose) => {
        const dateKey = format(new Date(dose.taken_at), 'yyyy-MM-dd');
        countMap.set(dateKey, (countMap.get(dateKey) || 0) + 1);
      });

      setDoseData(countMap);
      setLoading(false);
    };

    fetchDoseData();
  }, [user, currentMonth]);

  const getHeatLevel = (count: number): string => {
    if (count === 0) return 'bg-muted/30';
    if (count === 1) return 'bg-primary/25';
    if (count === 2) return 'bg-primary/50';
    if (count === 3) return 'bg-primary/75';
    return 'bg-primary';
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <motion.div
      className="bg-card rounded-xl p-4 border border-border"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-foreground">
          Adherence Calendar
        </h3>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            whileTap={{ scale: 0.9 }}
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </motion.button>
          <span className="text-sm font-medium text-foreground min-w-[100px] text-center">
            {format(currentMonth, 'MMM yyyy')}
          </span>
          <motion.button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            whileTap={{ scale: 0.9 }}
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </motion.button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((day, i) => (
          <div
            key={i}
            className="text-center text-xs text-muted-foreground font-medium py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const count = doseData.get(dateKey) || 0;
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDate = isToday(day);

          return (
            <motion.div
              key={i}
              className={`
                aspect-square rounded-md flex items-center justify-center text-xs font-medium
                transition-colors relative
                ${isCurrentMonth ? getHeatLevel(count) : 'bg-transparent'}
                ${isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/30'}
                ${isTodayDate ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}
              `}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: loading ? 0 : i * 0.01 }}
              title={isCurrentMonth ? `${count} dose${count !== 1 ? 's' : ''} on ${format(day, 'MMM d')}` : ''}
            >
              {format(day, 'd')}
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-border">
        <span className="text-xs text-muted-foreground">Less</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 rounded bg-muted/30" />
          <div className="w-4 h-4 rounded bg-primary/25" />
          <div className="w-4 h-4 rounded bg-primary/50" />
          <div className="w-4 h-4 rounded bg-primary/75" />
          <div className="w-4 h-4 rounded bg-primary" />
        </div>
        <span className="text-xs text-muted-foreground">More</span>
      </div>
    </motion.div>
  );
};

export default AdherenceCalendar;
