import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Bell,
  Shield,
  UserRound,
  Info,
  LogOut,
  Trash2,
  ExternalLink,
  Lock,
  Mail,
  Loader2,
  LifeBuoy,
  Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { api } from '@/api/client';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  getNotificationsEnabled,
  setNotificationsEnabled,
} from '@/lib/notificationPrefs';
import {
  cancelHydrationReminders,
  scheduleHydrationReminders,
} from '@/services/hydrationNotifications';
import BlockedUsersPanel from '@/components/BlockedUsersPanel';
import { openExternalUrl } from '@/lib/openExternalUrl';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const LEGAL_URLS = {
  privacyPolicy: 'https://amiyash3.github.io/water_warrior/privacy-policy/',
  privacyChoices: 'https://amiyash3.github.io/water_warrior/privacy-choices/',
  support: 'https://amiyash3.github.io/water_warrior/support/',
  termsOfService: 'https://amiyash3.github.io/water_warrior/terms-of-service/',
  communityGuidelines: 'https://amiyash3.github.io/water_warrior/community-guidelines/',
};

function openExternal(url) {
  openExternalUrl(url).catch(() => {
    window.open(url, '_blank', 'noopener,noreferrer');
  });
}

function SettingsRow({ icon: Icon, label, description, onClick, trailing, destructive }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors',
        onClick && 'hover:bg-muted/60 active:bg-muted'
      )}
    >
      {Icon && (
        <div
          className={cn(
            'w-9 h-9 rounded-2xl flex items-center justify-center shrink-0',
            destructive ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-primary'
          )}
        >
          <Icon className="w-4.5 h-4.5 w-4 h-4" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold', destructive && 'text-destructive')}>{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>}
      </div>
      {trailing}
    </Comp>
  );
}

function SettingsCard({ children, className }) {
  return (
    <div className={cn('bg-card rounded-3xl border border-border/50 overflow-hidden divide-y divide-border/50', className)}>
      {children}
    </div>
  );
}

function PanelHeader({ title, onBack }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      <button
        type="button"
        onClick={onBack}
        className="w-10 h-10 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center"
        aria-label="Back"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
    </div>
  );
}

function ProfileAccountPanel({ me, onBack }) {
  const [email, setEmail] = useState(me?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const saveEmail = async (e) => {
    e.preventDefault();
    const next = email.trim().toLowerCase();
    if (!next || next === me?.email) {
      toast.message('Enter a new email address to update.');
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      toast.error('Email changes require a Supabase account.');
      return;
    }
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: next });
      if (error) throw error;
      toast.success('Check your inbox to confirm the new email.');
    } catch (err) {
      toast.error(err?.message || 'Could not update email');
    } finally {
      setSavingEmail(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      toast.error('Password changes require a Supabase account.');
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword('');
      setConfirmPassword('');
      toast.success('Password updated.');
    } catch (err) {
      toast.error(err?.message || 'Could not update password');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="px-5 pb-10">
      <PanelHeader title="Profile" onBack={onBack} />
      <p className="text-sm text-muted-foreground mb-5">
        Manage sign-in details for your Water Warrior account.
      </p>

      <form onSubmit={saveEmail} className="space-y-4 bg-card rounded-3xl border border-border/50 p-5 mb-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Mail className="w-3.5 h-3.5" /> Email
        </label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-2xl h-12"
          autoComplete="email"
          required
        />
        <Button type="submit" disabled={savingEmail} className="w-full rounded-full h-11 water-gradient border-0">
          {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update email'}
        </Button>
      </form>

      <form onSubmit={savePassword} className="space-y-4 bg-card rounded-3xl border border-border/50 p-5">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Lock className="w-3.5 h-3.5" /> New password
        </label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-2xl h-12"
          autoComplete="new-password"
          minLength={6}
          placeholder="••••••••"
          required
        />
        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="rounded-2xl h-12"
          autoComplete="new-password"
          minLength={6}
          placeholder="Confirm password"
          required
        />
        <Button type="submit" disabled={savingPassword} className="w-full rounded-full h-11 water-gradient border-0">
          {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update password'}
        </Button>
      </form>
    </div>
  );
}

function PrivacyPanel({ onBack, onDeleteAccount, deletingAccount }) {
  return (
    <div className="px-5 pb-10">
      <PanelHeader title="Privacy" onBack={onBack} />
      <SettingsCard className="mb-4">
        <SettingsRow
          label="Privacy Policy"
          description="How we collect and use your information"
          onClick={() => openExternal(LEGAL_URLS.privacyPolicy)}
          trailing={<ExternalLink className="w-4 h-4 text-muted-foreground" />}
        />
        <SettingsRow
          label="Privacy Choices"
          description="Your data choices and rights"
          onClick={() => openExternal(LEGAL_URLS.privacyChoices)}
          trailing={<ExternalLink className="w-4 h-4 text-muted-foreground" />}
        />
        <SettingsRow
          label="Support"
          description="Get help with your account"
          onClick={() => openExternal(LEGAL_URLS.support)}
          trailing={<ExternalLink className="w-4 h-4 text-muted-foreground" />}
        />
      </SettingsCard>

      <SettingsCard>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/60 active:bg-muted transition-colors"
              disabled={deletingAccount}
            >
              <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 bg-destructive/10 text-destructive">
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-destructive">Delete account</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  Permanently remove your account and data
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your account and all your hydration posts. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-2xl">Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deletingAccount}
                onClick={onDeleteAccount}
                className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Yes, delete everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SettingsCard>
    </div>
  );
}

function AboutPanel({ onBack }) {
  return (
    <div className="px-5 pb-10">
      <PanelHeader title="About" onBack={onBack} />
      <SettingsCard>
        <SettingsRow
          label="Terms of Service"
          onClick={() => openExternal(LEGAL_URLS.termsOfService)}
          trailing={<ExternalLink className="w-4 h-4 text-muted-foreground" />}
        />
        <SettingsRow
          label="Privacy Policy"
          onClick={() => openExternal(LEGAL_URLS.privacyPolicy)}
          trailing={<ExternalLink className="w-4 h-4 text-muted-foreground" />}
        />
        <SettingsRow
          label="Community Guidelines"
          onClick={() => openExternal(LEGAL_URLS.communityGuidelines)}
          trailing={<ExternalLink className="w-4 h-4 text-muted-foreground" />}
        />
      </SettingsCard>
      <p className="text-xs text-muted-foreground text-center mt-6">Water Warrior</p>
    </div>
  );
}

function HelpSafetyPanel({ onBack, onOpenBlocked }) {
  return (
    <div className="px-5 pb-10">
      <PanelHeader title="Help & Safety" onBack={onBack} />
      <SettingsCard className="mb-4">
        <SettingsRow
          label="Community Guidelines"
          description="What is and is not allowed"
          onClick={() => openExternal(LEGAL_URLS.communityGuidelines)}
          trailing={<ExternalLink className="w-4 h-4 text-muted-foreground" />}
        />
        <SettingsRow
          label="Privacy Policy"
          onClick={() => openExternal(LEGAL_URLS.privacyPolicy)}
          trailing={<ExternalLink className="w-4 h-4 text-muted-foreground" />}
        />
        <SettingsRow
          label="Terms of Service"
          onClick={() => openExternal(LEGAL_URLS.termsOfService)}
          trailing={<ExternalLink className="w-4 h-4 text-muted-foreground" />}
        />
      </SettingsCard>
      <SettingsCard>
        <SettingsRow
          icon={Ban}
          label="Blocked Users"
          description="Manage people you have blocked"
          onClick={onOpenBlocked}
          trailing={<ChevronRight className="w-4 h-4 text-muted-foreground" />}
        />
        <SettingsRow
          label="Contact Support"
          description="Get help with your account"
          onClick={() => openExternal(LEGAL_URLS.support)}
          trailing={<ExternalLink className="w-4 h-4 text-muted-foreground" />}
        />
      </SettingsCard>
    </div>
  );
}

/**
 * Full-screen settings stack for Account.
 * @param {{ me: object, onClose: () => void, onDeleteAccount: () => void, deletingAccount: boolean }} props
 */
export default function AccountSettings({ me, onClose, onDeleteAccount, deletingAccount }) {
  const [panel, setPanel] = useState('root'); // root | profile | privacy | about | help | blocked
  const [notificationsOn, setNotificationsOn] = useState(() => getNotificationsEnabled());
  const [togglingNotifications, setTogglingNotifications] = useState(false);

  useEffect(() => {
    const onChange = (e) => setNotificationsOn(!!e.detail?.enabled);
    window.addEventListener('ww:notifications-changed', onChange);
    return () => window.removeEventListener('ww:notifications-changed', onChange);
  }, []);

  const toggleNotifications = async (checked) => {
    setTogglingNotifications(true);
    try {
      if (checked) {
        try {
          const ok = await scheduleHydrationReminders();
          if (!ok) {
            toast.error('Notification permission denied. Enable it in iOS Settings.');
            setNotificationsOn(false);
            setNotificationsEnabled(false);
            return;
          }
        } catch (err) {
          // Web / unsupported platforms: still store preference
          console.warn('Could not schedule native reminders', err);
        }
        setNotificationsEnabled(true);
        setNotificationsOn(true);
        toast.success('Hydration reminders on');
      } else {
        try {
          await cancelHydrationReminders();
        } catch (err) {
          console.warn('Could not cancel native reminders', err);
        }
        setNotificationsEnabled(false);
        setNotificationsOn(false);
        toast.message('Hydration reminders off');
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'Could not update notifications');
    } finally {
      setTogglingNotifications(false);
    }
  };

  if (panel === 'profile') {
    return <ProfileAccountPanel me={me} onBack={() => setPanel('root')} />;
  }
  if (panel === 'privacy') {
    return (
      <PrivacyPanel
        onBack={() => setPanel('root')}
        onDeleteAccount={onDeleteAccount}
        deletingAccount={deletingAccount}
      />
    );
  }
  if (panel === 'about') {
    return <AboutPanel onBack={() => setPanel('root')} />;
  }
  if (panel === 'help') {
    return (
      <HelpSafetyPanel
        onBack={() => setPanel('root')}
        onOpenBlocked={() => setPanel('blocked')}
      />
    );
  }
  if (panel === 'blocked') {
    return <BlockedUsersPanel onBack={() => setPanel('help')} />;
  }

  return (
    <div className="px-5 pb-10">
      <PanelHeader title="Settings" onBack={onClose} />

      <SettingsCard className="mb-4">
        <SettingsRow
          icon={UserRound}
          label="Profile"
          description="Email and password"
          onClick={() => setPanel('profile')}
          trailing={<ChevronRight className="w-4 h-4 text-muted-foreground" />}
        />
        <SettingsRow
          icon={Bell}
          label="Notifications"
          description="Hydration reminder alerts"
          trailing={
            <Switch
              checked={notificationsOn}
              disabled={togglingNotifications}
              onCheckedChange={toggleNotifications}
              aria-label="Toggle hydration notifications"
            />
          }
        />
      </SettingsCard>

      <SettingsCard className="mb-4">
        <SettingsRow
          icon={Shield}
          label="Privacy"
          description="Policy, choices, support, delete account"
          onClick={() => setPanel('privacy')}
          trailing={<ChevronRight className="w-4 h-4 text-muted-foreground" />}
        />
        <SettingsRow
          icon={LifeBuoy}
          label="Help & Safety"
          description="Guidelines, legal links, blocked users"
          onClick={() => setPanel('help')}
          trailing={<ChevronRight className="w-4 h-4 text-muted-foreground" />}
        />
        <SettingsRow
          icon={Info}
          label="About"
          description="Terms of service and privacy policy"
          onClick={() => setPanel('about')}
          trailing={<ChevronRight className="w-4 h-4 text-muted-foreground" />}
        />
      </SettingsCard>

      <SettingsCard>
        <SettingsRow
          icon={LogOut}
          label="Sign out"
          destructive
          onClick={() => api.auth.logout()}
        />
      </SettingsCard>
    </div>
  );
}
