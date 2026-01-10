import { useState, useEffect } from 'react';
import SplashScreen from '@/components/SplashScreen';
import OnboardingFlow from '@/components/OnboardingFlow';

const ONBOARDING_COMPLETE_KEY = 'vigil_onboarding_complete';

const Index = () => {
  const [appState, setAppState] = useState<'splash' | 'onboarding' | 'app'>('splash');

  useEffect(() => {
    // Check if user has completed onboarding before
    const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_COMPLETE_KEY);
    if (hasCompletedOnboarding === 'true') {
      // Skip to app after splash
      setAppState('splash');
    }
  }, []);

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

  if (appState === 'splash') {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (appState === 'onboarding') {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  // Main app placeholder - will be built in next phases
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-6">
          {/* Mini vigilant eyes logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-2 bg-primary rounded-full" />
            <div className="w-8 h-8 bg-primary-foreground rounded-full border-2 border-primary flex items-center justify-center">
              <div className="w-3 h-3 bg-primary rounded-full" />
            </div>
          </div>
        </div>
        
        <h1 className="text-3xl font-display font-bold text-foreground mb-3">
          Welcome to Vigil
        </h1>
        
        <p className="text-muted-foreground font-serif mb-8">
          Your medication adherence companion is ready. The main app experience will be built next.
        </p>

        <button
          onClick={() => {
            localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
            setAppState('splash');
          }}
          className="text-sm text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
        >
          Replay onboarding
        </button>
      </div>
    </div>
  );
};

export default Index;
