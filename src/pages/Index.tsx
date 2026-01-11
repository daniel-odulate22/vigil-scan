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

const ONBOARDING_COMPLETE_KEY = 'vigil_onboarding_complete';

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
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

  const handleConfirmDose = async (data: any) => {
    if (!user) return;
    try {
      await supabase.from('dose_logs').insert({
        user_id: user.id,
        medication_name: data.brand_name || data.generic_name || 'Unknown',
        verified: true,
      });
      toast({ title: 'Dose logged!', description: 'Your medication has been recorded.' });
      setVerifyModalOpen(false);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to log dose', variant: 'destructive' });
    }
  };

  const handleAddToPrescriptions = async (data: any) => {
    if (!user) return;
    try {
      await supabase.from('prescriptions').insert({
        user_id: user.id,
        medication_name: data.brand_name || data.generic_name || 'Unknown',
        manufacturer: data.manufacturer_name,
        ndc_code: data.product_ndc,
        dosage: data.dosage_form,
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
