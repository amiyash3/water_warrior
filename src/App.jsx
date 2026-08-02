import { useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import PageNotFound from '@/lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { setupNativeAuthDeepLinks } from '@/lib/native';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from '@/components/Layout';
import Feed from '@/pages/Feed';
import Capture from '@/pages/Capture';
import Discover from '@/pages/Discover.jsx';
import Account from '@/pages/Account.jsx';
import Analytics from '@/pages/Analytics';
import Auth from '@/pages/Auth';
import LoadingScreen from '@/components/LoadingScreen';

const pageVariants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
};
const pageTransition = { duration: 0.22, ease: [0.4, 0, 0.2, 1] };

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        style={{ width: '100%' }}
      >
        <Routes location={location}>
          <Route element={<Layout />}>
            <Route path="/" element={<Feed />} />
            <Route path="/capture" element={<Capture />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/account" element={<Account />} />
            <Route path="/analytics" element={<Analytics />} />
          </Route>
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated } = useAuth();
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <LoadingScreen />;
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  if (isSupabaseConfigured && !isAuthenticated) {
    const next = location.pathname + location.search;
    return <Navigate to={`/auth?next=${encodeURIComponent(next)}`} replace />;
  }

  return <AnimatedRoutes />;
};

function App() {
  useEffect(() => setupNativeAuthDeepLinks(), []);

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/*" element={<AuthenticatedApp />} />
          </Routes>
        </Router>
        <Toaster />
        <SonnerToaster position="top-center" />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
