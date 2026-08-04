import React, { createContext, useState, useContext, useEffect } from 'react';
import { api } from '@/api/client';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState({
    id: isSupabaseConfigured ? 'supabase' : 'local',
    public_settings: {},
  });

  useEffect(() => {
    checkAppState();

    if (!isSupabaseConfigured || !supabase) return undefined;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Don't load the main app yet — Auth screen handles the new password.
        try {
          sessionStorage.setItem('ww_password_recovery', '1');
        } catch {
          // ignore
        }
        window.dispatchEvent(new CustomEvent('ww:password-recovery'));
        if (!window.location.pathname.startsWith('/auth')) {
          window.location.replace('/auth?mode=reset');
        }
        return;
      }

      if (session?.user) {
        // Skip profile bootstrap while the user is choosing a new password.
        try {
          if (sessionStorage.getItem('ww_password_recovery') === '1') {
            setIsLoadingAuth(false);
            setAuthChecked(true);
            return;
          }
        } catch {
          // ignore
        }
        checkUserAuth();
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setAuthChecked(true);
        setIsLoadingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      if (isSupabaseConfigured && supabase) {
        try {
          if (sessionStorage.getItem('ww_password_recovery') === '1') {
            setIsLoadingAuth(false);
            setAuthChecked(true);
            setIsLoadingPublicSettings(false);
            if (!window.location.pathname.startsWith('/auth')) {
              window.location.replace('/auth?mode=reset');
            }
            return;
          }
        } catch {
          // ignore
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          setUser(null);
          setIsAuthenticated(false);
          setIsLoadingAuth(false);
          setAuthChecked(true);
          return;
        }
      }

      await checkUserAuth();
    } catch (error) {
      console.error('App state check failed:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'Failed to load app',
      });
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } finally {
      setIsLoadingPublicSettings(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await api.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);

      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required',
        });
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect && isSupabaseConfigured) {
      api.auth.logout(window.location.origin + '/auth');
    } else {
      api.auth.logout();
    }
  };

  const navigateToLogin = () => {
    api.auth.redirectToLogin(window.location.pathname + window.location.search);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
