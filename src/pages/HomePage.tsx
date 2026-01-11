import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, TrendingUp, Pill, Clock, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface DashboardStats {
  todayDoses: number;
  weekStreak: number;
  activeMeds: number;
  lastDose: string | null;
}

const HomePage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    todayDoses: 0,
    weekStreak: 0,
    activeMeds: 0,
    lastDose: null,
  });
  const [recentDoses, setRecentDoses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchDashboardData = async () => {
      try {
        // Get today's doses
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { data: todayDosesData, error: dosesError } = await supabase
          .from('dose_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('taken_at', today.toISOString())
          .order('taken_at', { ascending: false });

        if (dosesError) throw dosesError;

        // Get active prescriptions count
        const { count: activeMedsCount, error: medsError } = await supabase
          .from('prescriptions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (medsError) throw medsError;

        // Get last dose
        const { data: lastDoseData } = await supabase
          .from('dose_logs')
          .select('taken_at, medication_name')
          .eq('user_id', user.id)
          .order('taken_at', { ascending: false })
          .limit(1)
          .single();

        // Get recent doses (last 5)
        const { data: recentData } = await supabase
          .from('dose_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('taken_at', { ascending: false })
          .limit(5);

        setStats({
          todayDoses: todayDosesData?.length || 0,
          weekStreak: calculateStreak(todayDosesData || []),
          activeMeds: activeMedsCount || 0,
          lastDose: lastDoseData?.taken_at || null,
        });

        setRecentDoses(recentData || []);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  // Simple streak calculation (placeholder - would need more complex logic)
  const calculateStreak = (doses: any[]) => {
    return doses.length > 0 ? Math.min(doses.length, 7) : 0;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="pb-24 pt-4 px-4">
      {/* Header */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="text-muted-foreground font-serif">{getGreeting()}</p>
        <h1 className="text-2xl font-display font-bold text-foreground">
          Your Health Dashboard
        </h1>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <motion.div
          className="bg-card rounded-xl p-4 border border-border"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.todayDoses}</p>
          <p className="text-xs text-muted-foreground">Doses today</p>
        </motion.div>

        <motion.div
          className="bg-card rounded-xl p-4 border border-border"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.weekStreak}</p>
          <p className="text-xs text-muted-foreground">Day streak</p>
        </motion.div>

        <motion.div
          className="bg-card rounded-xl p-4 border border-border"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
              <Pill className="w-4 h-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.activeMeds}</p>
          <p className="text-xs text-muted-foreground">Active meds</p>
        </motion.div>

        <motion.div
          className="bg-card rounded-xl p-4 border border-border"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-primary" />
            </div>
          </div>
          <p className="text-lg font-bold text-foreground">
            {stats.lastDose ? formatTime(stats.lastDose) : '--'}
          </p>
          <p className="text-xs text-muted-foreground">Last dose</p>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-lg font-display font-semibold text-foreground mb-3">
          Recent Activity
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-xl p-4 border border-border animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                <div className="h-3 bg-muted rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : recentDoses.length === 0 ? (
          <div className="bg-card rounded-xl p-6 border border-border text-center">
            <div className="w-12 h-12 mx-auto mb-3 bg-secondary rounded-full flex items-center justify-center">
              <Pill className="w-6 h-6 text-primary" />
            </div>
            <p className="text-muted-foreground font-serif mb-4">
              No doses logged yet. Scan a medication to get started!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentDoses.map((dose, index) => (
              <motion.div
                key={dose.id}
                className="bg-card rounded-xl p-4 border border-border flex items-center justify-between"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.05 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                    <Pill className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{dose.medication_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(dose.taken_at)} at {formatTime(dose.taken_at)}
                    </p>
                  </div>
                </div>
                {dose.verified && (
                  <span className="text-xs bg-secondary text-primary px-2 py-1 rounded-full">
                    Verified
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default HomePage;
