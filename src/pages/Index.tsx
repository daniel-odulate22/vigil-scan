import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SplashScreen from '@/components/SplashScreen';
import OnboardingFlow from '@/components/OnboardingFlow';
import BottomNav from '@/components/BottomNav';
import BarcodeScanner from '@/components/BarcodeScanner';
import VerifyModal from '@/components/VerifyModal';
import HomePage from '@/pages/HomePage';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { savePendingDose, PendingDose } from '@/lib/offlineStore';

const ONBOARDING_COMPLETE_KEY = 'vigil_onboarding_complete';

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { isOnline } = useOfflineSync();
  const [appState, setAppState] = useState<'splash' | 'onboarding' | 'app'>('splash');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');

  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_COMPLETE_KEY);
    if (hasCompletedOnboarding === 'true') {
      setAppState('splash');
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user && appState === 'app') {
      navigate('/auth');
    }
  }, [user, authLoading, appState, navigate]);

  const handleSplashComplete = () => {
    const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_COMPLETE_KEY);
    if (hasCompletedOnboarding === 'true') {
      setAppState('app');
    } else {
      setAppState('onboarding');
    }
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    setAppState('app');
  };

  const handleScanSuccess = (code: string) => {
    setScannedBarcode(code);
    setScannerOpen(false);
    setVerifyModalOpen(true);
  };

  // Helper to check if data is from manual entry (has medication_name) vs OpenFDA (has brand_name)
  const isManualEntry = (data: any): boolean => 'medication_name' in data;

  const handleConfirmDose = async (data: any) => {
    if (!user) return;
    
    const isManual = isManualEntry(data);
    const medicationName = isManual 
      ? data.medication_name 
      : (data.brand_name || data.generic_name || 'Unknown');
    
    const doseData = {
      user_id: user.id,
      medication_name: medicationName,
      verified: !isManual,
      taken_at: new Date().toISOString(),
    };

    try {
      // If manual entry, also add to prescriptions (only when online)
      if (isManual && isOnline) {
        await supabase.from('prescriptions').insert({
          user_id: user.id,
          medication_name: data.medication_name,
          manufacturer: data.manufacturer || null,
          ndc_code: data.ndc_code || null,
          dosage: data.dosage || null,
          frequency: data.frequency || null,
          instructions: data.instructions || null,
        });
      }

      if (isOnline) {
        // Online: save directly to database
        await supabase.from('dose_logs').insert(doseData);
        
        toast({ 
          title: 'Dose logged!', 
          description: isManual 
            ? 'Your medication has been recorded and added to prescriptions.' 
            : 'Your medication has been recorded.' 
        });
      } else {
        // Offline: save to IndexedDB
        const pendingDose: PendingDose = {
          id: crypto.randomUUID(),
          ...doseData,
          created_at: new Date().toISOString(),
        };
        await savePendingDose(pendingDose);
        
        toast({ 
          title: 'Saved offline', 
          description: 'Your dose will sync when you\'re back online.',
        });
      }
      
      setVerifyModalOpen(false);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to log dose', variant: 'destructive' });
    }
  };

  const handleAddToPrescriptions = async (data: any) => {
    if (!user) return;
    
    const isManual = isManualEntry(data);
    
    try {
      await supabase.from('prescriptions').insert({
        user_id: user.id,
        medication_name: isManual ? data.medication_name : (data.brand_name || data.generic_name || 'Unknown'),
        manufacturer: isManual ? (data.manufacturer || null) : (data.manufacturer_name || null),
        ndc_code: isManual ? (data.ndc_code || null) : (data.product_ndc || null),
        dosage: isManual ? (data.dosage || null) : (data.dosage_form || null),
        frequency: isManual ? (data.frequency || null) : null,
        instructions: isManual ? (data.instructions || null) : null,
      });
      toast({ title: 'Added!', description: 'Medication added to your prescriptions.' });
      setVerifyModalOpen(false);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to add prescription', variant: 'destructive' });
    }
  };

  if (appState === 'splash') return <SplashScreen onComplete={handleSplashComplete} />;
  if (appState === 'onboarding') return <OnboardingFlow onComplete={handleOnboardingComplete} />;

  if (!user && !authLoading) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <HomePage />
      <BottomNav onScanClick={() => setScannerOpen(true)} />
      <BarcodeScanner isOpen={scannerOpen} onClose={() => setScannerOpen(false)} onScanSuccess={handleScanSuccess} />
      <VerifyModal isOpen={verifyModalOpen} barcode={scannedBarcode} onClose={() => setVerifyModalOpen(false)} onConfirm={handleConfirmDose} onAddToPrescriptions={handleAddToPrescriptions} />
    </div>
  );
};

export default Index;
