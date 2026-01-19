import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPendingDoses, removePendingDose, getPendingDosesCount } from '@/lib/offlineStore';
import { useOnlineStatus } from './useOnlineStatus';
import { useToast } from './use-toast';
import { useAuth } from './useAuth';

export const useOfflineSync = () => {
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  const { user } = useAuth();
  const isSyncing = useRef(false);

  const syncPendingDoses = useCallback(async () => {
    if (!user || isSyncing.current) return;

    isSyncing.current = true;

    try {
      const pendingDoses = await getPendingDoses();
      
      if (pendingDoses.length === 0) {
        isSyncing.current = false;
        return;
      }

      let syncedCount = 0;
      let failedCount = 0;

      for (const dose of pendingDoses) {
        try {
          const { error } = await supabase.from('dose_logs').insert({
            user_id: dose.user_id,
            medication_name: dose.medication_name,
            verified: dose.verified,
            taken_at: dose.taken_at,
            prescription_id: dose.prescription_id || null,
            notes: dose.notes || null,
          });

          if (error) {
            console.error('Failed to sync dose:', error);
            failedCount++;
          } else {
            await removePendingDose(dose.id);
            syncedCount++;
          }
        } catch (err) {
          console.error('Error syncing dose:', err);
          failedCount++;
        }
      }

      if (syncedCount > 0) {
        toast({
          title: 'Synced!',
          description: `${syncedCount} offline dose${syncedCount > 1 ? 's' : ''} synced successfully.`,
        });
      }

      if (failedCount > 0) {
        toast({
          title: 'Sync incomplete',
          description: `${failedCount} dose${failedCount > 1 ? 's' : ''} failed to sync. Will retry later.`,
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      isSyncing.current = false;
    }
  }, [user, toast]);

  // Sync when coming back online
  useEffect(() => {
    if (isOnline && user) {
      // Small delay to ensure connection is stable
      const timeout = setTimeout(() => {
        syncPendingDoses();
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isOnline, user, syncPendingDoses]);

  // Also sync periodically when online (every 5 minutes)
  useEffect(() => {
    if (!isOnline || !user) return;

    const interval = setInterval(() => {
      syncPendingDoses();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isOnline, user, syncPendingDoses]);

  return {
    isOnline,
    syncPendingDoses,
    getPendingDosesCount,
  };
};
