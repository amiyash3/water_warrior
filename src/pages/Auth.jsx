import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Droplets, Loader2, Mail, Lock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { getAuthRedirectUrl } from '@/lib/native';

/** signin | signup | forgot | reset */
function resolveInitialMode(searchParams) {
  const mode = searchParams.get('mode');
  if (mode === 'reset' || mode === 'recovery') return 'reset';
  if (mode === 'forgot') return 'forgot';
  return 'signin';
}

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') || '/';

  const [mode, setMode] = useState(() => resolveInitialMode(searchParams));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase) return undefined;

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const type = hashParams.get('type') || searchParams.get('type');
    if (type === 'recovery') {
      setMode('reset');
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset');
      }
    });

    return () => subscription.unsubscribe();
  }, [searchParams]);

  const redirectAfterAuth = () => {
    navigate(next, { replace: true });
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!supabase) {
      toast.error('Supabase is not configured.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      redirectAfterAuth();
    } catch (err) {
      toast.error(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!supabase) {
      toast.error('Supabase is not configured.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      toast.success('Account created! You can sign in now.');
      setMode('signin');
    } catch (err) {
      toast.error(err.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!supabase) {
      toast.error('Supabase is not configured.');
      return;
    }

    setLoading(true);
    try {
      const redirectTo = getAuthRedirectUrl('/auth?mode=reset');
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      toast.success('Check your email for a password reset link.');
      setMode('signin');
    } catch (err) {
      toast.error(err.message || 'Could not send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!supabase) {
      toast.error('Supabase is not configured.');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated! You are signed in.');
      window.history.replaceState({}, '', '/auth');
      redirectAfterAuth();
    } catch (err) {
      toast.error(err.message || 'Could not update password');
    } finally {
      setLoading(false);
    }
  };

  const titles = {
    signin: 'Sign in to hydrate with friends',
    signup: 'Create your account',
    forgot: 'Reset your password',
    reset: 'Choose a new password',
  };

  const renderForm = () => {
    if (mode === 'forgot') {
      return (
        <form onSubmit={handleForgotPassword} className="space-y-4 bg-card rounded-3xl border border-border/50 p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" />
              Email
            </label>
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-2xl h-12"
              placeholder="you@example.com"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full rounded-full h-12 water-gradient border-0">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send reset link'}
          </Button>
        </form>
      );
    }

    if (mode === 'reset') {
      return (
        <form onSubmit={handleResetPassword} className="space-y-4 bg-card rounded-3xl border border-border/50 p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Enter your new password below.
          </p>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" />
              New password
            </label>
            <Input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="rounded-2xl h-12"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Confirm password
            </label>
            <Input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="rounded-2xl h-12"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full rounded-full h-12 water-gradient border-0">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update password'}
          </Button>
        </form>
      );
    }

    const onSubmit = mode === 'signup' ? handleSignUp : handleSignIn;

    return (
      <form onSubmit={onSubmit} className="space-y-4 bg-card rounded-3xl border border-border/50 p-6 shadow-sm">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <Mail className="w-3.5 h-3.5" />
            Email
          </label>
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-2xl h-12"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" />
              Password
            </label>
            {mode === 'signin' && isSupabaseConfigured && (
              <button
                type="button"
                className="text-xs text-primary font-semibold"
                onClick={() => setMode('forgot')}
              >
                Forgot password?
              </button>
            )}
          </div>
          <Input
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-2xl h-12"
            placeholder="••••••••"
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full rounded-full h-12 water-gradient border-0 shadow-lg shadow-primary/30">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Please wait…
            </>
          ) : mode === 'signup' ? (
            'Create account'
          ) : (
            'Sign in'
          )}
        </Button>
      </form>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-3xl water-gradient flex items-center justify-center shadow-xl shadow-primary/30 mb-4">
            <Droplets className="w-10 h-10 text-white" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Water Warrior</h1>
          <p className="text-muted-foreground text-sm mt-2">{titles[mode]}</p>
        </div>

        {renderForm()}

        <div className="text-center text-sm text-muted-foreground mt-6 space-y-2">
          {(mode === 'forgot' || mode === 'reset') && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-primary font-semibold"
              onClick={() => setMode('signin')}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </button>
          )}

          {mode === 'signin' && (
            <p>
              New here?{' '}
              <button type="button" className="text-primary font-semibold" onClick={() => setMode('signup')}>
                Create account
              </button>
            </p>
          )}

          {mode === 'signup' && (
            <p>
              Already have an account?{' '}
              <button type="button" className="text-primary font-semibold" onClick={() => setMode('signin')}>
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
