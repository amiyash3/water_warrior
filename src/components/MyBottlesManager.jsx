import React, { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Droplets, Plus, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SIZE_OPTIONS = [250, 500, 750, 1000, 1500, 2000];

function bottleErrorMessage(err, fallback) {
  const msg = err?.message || '';
  if (msg.includes('user_bottles') && (msg.includes('does not exist') || msg.includes('schema cache'))) {
    return 'Bottle storage is not set up yet. Run the user_bottles migration in Supabase (see README).';
  }
  if (msg.includes('permission denied') || err?.code === '42501') {
    return 'Database permission error — re-run the user_bottles migration in Supabase SQL Editor.';
  }
  return fallback;
}

export default function MyBottlesManager({ compact = false }) {
  const [bottles, setBottles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [sizeMl, setSizeMl] = useState(500);
  const [saving, setSaving] = useState(false);

  const loadBottles = async () => {
    try {
      const list = await api.entities.UserBottle.list();
      setBottles(list);
    } catch (err) {
      console.error(err);
      toast.error(bottleErrorMessage(err, 'Could not load your bottles'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBottles();
  }, []);

  const addBottle = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Give your bottle a name');
      return;
    }

    setSaving(true);
    try {
      await api.entities.UserBottle.create({
        name: trimmed,
        size_ml: sizeMl,
        is_default: bottles.length === 0,
      });
      setName('');
      setSizeMl(500);
      setShowForm(false);
      toast.success('Bottle saved');
      await loadBottles();
    } catch (err) {
      console.error(err);
      toast.error(bottleErrorMessage(err, 'Could not save bottle'));
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (id) => {
    try {
      await api.entities.UserBottle.update(id, { is_default: true });
      await loadBottles();
      toast.success('Default bottle updated');
    } catch (err) {
      console.error(err);
      toast.error('Could not update default bottle');
    }
  };

  const removeBottle = async (id) => {
    try {
      await api.entities.UserBottle.delete(id);
      await loadBottles();
      toast.success('Bottle removed');
    } catch (err) {
      console.error(err);
      toast.error('Could not remove bottle');
    }
  };

  if (loading) {
    return <div className={cn('bg-card rounded-3xl border border-border/50 animate-pulse', compact ? 'h-24' : 'h-40')} />;
  }

  return (
    <div className="bg-card rounded-3xl border border-border/50 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Droplets className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-base">My bottles</h3>
        {!showForm && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto rounded-full"
            onClick={() => setShowForm(true)}
          >
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Save the bottles you actually use — stats track each one separately.
      </p>

      {showForm && (
        <div className="mb-4 space-y-3 rounded-2xl border border-border/60 p-4 bg-background/60">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Gym Nalgene, Desk bottle"
            className="rounded-2xl"
          />
<p className="text-xs text-muted-foreground mb-1">ml</p>
<div className="grid grid-cols-3 gap-2 mb-3">
  {[250, 500, 750, 1000, 1500, 2000].map((ml) => (
    <button
      key={ml}
      type="button"
      onClick={() => setSizeMl(ml)}
      className={cn(
        'py-2 rounded-xl text-xs font-semibold border transition-all',
        sizeMl === ml
          ? 'water-gradient text-white border-transparent'
          : 'bg-background border-border hover:border-primary/40'
      )}
    >
      {ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`}
    </button>
  ))}
</div>
<p className="text-xs text-muted-foreground mb-1">oz</p>
<div className="grid grid-cols-3 gap-2">
  {[8, 12, 16, 24, 32, 64].map((s) => (
    <button
      key={s}
      type="button"
onClick={() => setSizeMl(Math.round(s * 29.574))}
      className={cn(
        'py-2 rounded-xl text-xs font-semibold border transition-all',
Math.abs(sizeMl - Math.round(s * 29.574)) < 10
          ? 'water-gradient text-white border-transparent'
          : 'bg-background border-border hover:border-primary/40'
      )}
    >
      {s}oz
    </button>
  ))}
</div>          
<div className="flex gap-2">
            <Button
              className="flex-1 rounded-2xl water-gradient border-0"
              disabled={saving}
              onClick={addBottle}
            >
              Save bottle
            </Button>
            <Button variant="ghost" className="rounded-2xl" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {bottles.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No bottles saved yet. Add one to track it in stats.
        </p>
      ) : (
        <div className="space-y-2">
          {bottles.map((bottle) => (
            <div
              key={bottle.id}
              className="flex items-center gap-3 rounded-2xl border border-border/50 px-4 py-3"
            >
              <div className="w-10 h-10 rounded-xl water-gradient-soft flex items-center justify-center shrink-0">
                <Droplets className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">{bottle.name}</p>
<p className="text-xs text-muted-foreground">{bottle.size_ml}ml · {Math.round(bottle.size_ml / 29.574)}oz</p>              
</div>
              {bottle.is_default ? (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary px-2 py-1 rounded-full bg-primary/10">
                  Default
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setDefault(bottle.id)}
                  className="p-2 rounded-full hover:bg-muted text-muted-foreground"
                  title="Set as default"
                >
                  <Star className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => removeBottle(bottle.id)}
                className="p-2 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                title="Remove bottle"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Pick a saved bottle, or "Other" for a cup/glass with manual size. */
export const OTHER_BOTTLE_ID = 'other';

export function BottlePicker({
  bottles,
  selectedId,
  onSelect,
  sizeOptions = [250, 500, 750, 1000],
  bottleSize,
  onSizeChange,
}) {
  if (bottles.length === 0) return null;

  const isOther = selectedId === OTHER_BOTTLE_ID || selectedId == null;

  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
        <Droplets className="w-3.5 h-3.5" />
        What did you drink from?
      </label>
      <div className="space-y-2">
        {bottles.map((bottle) => (
          <button
            key={bottle.id}
            type="button"
            onClick={() => onSelect(bottle.id)}
            className={cn(
              'w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all',
              selectedId === bottle.id
                ? 'water-gradient text-white border-transparent shadow-md shadow-primary/20'
                : 'bg-background border-border hover:border-primary/40'
            )}
          >
            <Droplets className="w-4 h-4 shrink-0" />
            <span className="font-semibold text-sm flex-1 truncate">{bottle.name}</span>
            <span
              className={cn(
                'text-xs font-medium',
                selectedId === bottle.id ? 'text-white/90' : 'text-muted-foreground'
              )}
            >
{bottle.size_ml}ml · {Math.round(bottle.size_ml / 29.574)}oz
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => onSelect(OTHER_BOTTLE_ID)}
          className={cn(
            'w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all',
            isOther
              ? 'water-gradient text-white border-transparent shadow-md shadow-primary/20'
              : 'bg-background border-border hover:border-primary/40'
          )}
        >
          <Droplets className="w-4 h-4 shrink-0" />
          <span className="font-semibold text-sm flex-1">Other</span>
          <span
            className={cn(
              'text-xs font-medium',
              isOther ? 'text-white/90' : 'text-muted-foreground'
            )}
          >
            cup, glass, etc.
          </span>
        </button>
      </div>

      {isOther && (
        <div className="mt-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
            How much water?
          </label>
<p className="text-xs text-muted-foreground mb-1">ml</p>
<div className="grid grid-cols-4 gap-2 mb-3">
  {[250, 500, 750, 1000].map((s) => (
    <button
      key={s}
      type="button"
      onClick={() => onSizeChange(s)}
      className={cn(
        'py-3 rounded-2xl text-sm font-semibold transition-all border',
        bottleSize === s
          ? 'water-gradient text-white border-transparent shadow-md shadow-primary/20'
          : 'bg-background border-border hover:border-primary/40'
      )}
    >
      {s}ml
    </button>
  ))}
</div>
<p className="text-xs text-muted-foreground mb-1">oz</p>
<div className="grid grid-cols-6 gap-2">
  {[8, 12, 16, 24, 32, 64].map((s) => (
    <button
      key={s}
      type="button"
onClick={() => onSizeChange(Math.round(s * 29.574))}
      className={cn(
        'py-3 rounded-2xl text-sm font-semibold transition-all border',
Math.abs(bottleSize - Math.round(s * 29.574)) < 10
          ? 'water-gradient text-white border-transparent shadow-md shadow-primary/20'
          : 'bg-background border-border hover:border-primary/40'
      )}
    >
      {s}oz
    </button>
  ))}
</div>        
</div>
      )}
    </div>
  );
}
