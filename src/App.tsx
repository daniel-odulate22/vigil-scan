import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import PrescriptionsPage from "./pages/PrescriptionsPage";
import ProfilePage from "./pages/ProfilePage";
import BottomNav from "./components/BottomNav";
import NotFound from "./pages/NotFound";
import { useState } from "react";
import BarcodeScanner from "./components/BarcodeScanner";
import VerifyModal from "./components/VerifyModal";

const queryClient = new QueryClient();

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [scannerOpen, setScannerOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      {children}
      <BottomNav onScanClick={() => setScannerOpen(false)} />
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/prescriptions" element={<ProtectedRoute><PrescriptionsPage /><BottomNav onScanClick={() => {}} /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /><BottomNav onScanClick={() => {}} /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
