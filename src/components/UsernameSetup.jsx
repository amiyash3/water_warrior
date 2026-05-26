import React, { useState } from 'react';
import { api } from '@/api/client';
import { Droplets, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function UsernameSetup({ onComplete }) {
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = username.trim().replace(/\s+/g, '_');
    if (trimmed.length < 2) {
      toast.error('Username must be at least 2 characters');
      return;
    }
    setSaving(true);
    await api.auth.updateMe({ username: trimmed });
    toast.success(`Welcome, @${trimmed}!`);
    setSaving(false);
    onComplete(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm text-center">
        {/* Icon */}
        <div className="w-24 h-24 mx-auto rounded-3xl water-gradient flex items-center justify-center shadow-2xl shadow-primary/30 mb-8 animate-float">
          <Droplets className="w-12 h-12 text-white" strokeWidth={2} />
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome to<br />Water Warrior</h1>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
          Choose a username so your friends can find you and cheer on your hydration journey.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm">@</span>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
              placeholder="yourname"
              className="pl-8 h-14 rounded-2xl text-center text-lg font-semibold tracking-wide border-border"
              autoFocus
              maxLength={30}
            />
          </div>
          <p className="text-xs text-muted-foreground">Letters, numbers, dots and underscores only.</p>

          <Button
            type="submit"
            disabled={username.trim().length < 2 || saving}
            size="lg"
            className="w-full rounded-full h-14 text-base water-gradient border-0 shadow-xl shadow-primary/30 disabled:opacity-40"
          >
            {saving ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Saving…</>
            ) : (
              <>Let's go <ArrowRight className="w-5 h-5 ml-2" /></>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}