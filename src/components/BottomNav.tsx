import { NavLink, useLocation } from 'react-router-dom';
import { Home, Pill, User, ScanBarcode } from 'lucide-react';
import { motion } from 'framer-motion';

interface BottomNavProps {
  onScanClick: () => void;
}

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/prescriptions', icon: Pill, label: 'Meds' },
  { to: '/profile', icon: User, label: 'Profile' },
];

const BottomNav = ({ onScanClick }: BottomNavProps) => {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
      <div className="relative flex items-center justify-around h-16 max-w-md mx-auto px-4">
        {/* Left nav items */}
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-16 h-full transition-colors ${
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`
          }
        >
          <Home className="w-5 h-5" />
          <span className="text-xs mt-1 font-medium">Home</span>
          {location.pathname === '/' && (
            <motion.div
              className="absolute top-0 left-[12%] w-10 h-0.5 bg-primary rounded-full"
              layoutId="nav-indicator"
            />
          )}
        </NavLink>

        {/* Spacer for center button */}
        <div className="w-20" />

        {/* Elevated SCAN button */}
        <motion.button
          onClick={onScanClick}
          className="absolute left-1/2 -translate-x-1/2 -top-5 w-16 h-16 bg-primary rounded-full flex items-center justify-center shadow-lg animate-pulse-glow"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Scan medication barcode"
        >
          <ScanBarcode className="w-7 h-7 text-primary-foreground" />
        </motion.button>

        {/* Right nav items */}
        <NavLink
          to="/prescriptions"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-16 h-full transition-colors ${
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`
          }
        >
          <Pill className="w-5 h-5" />
          <span className="text-xs mt-1 font-medium">Meds</span>
          {location.pathname === '/prescriptions' && (
            <motion.div
              className="absolute top-0 right-[24%] w-10 h-0.5 bg-primary rounded-full"
              layoutId="nav-indicator"
            />
          )}
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-16 h-full transition-colors ${
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`
          }
        >
          <User className="w-5 h-5" />
          <span className="text-xs mt-1 font-medium">Profile</span>
          {location.pathname === '/profile' && (
            <motion.div
              className="absolute top-0 right-[4%] w-10 h-0.5 bg-primary rounded-full"
              layoutId="nav-indicator"
            />
          )}
        </NavLink>
      </div>
    </nav>
  );
};

export default BottomNav;
