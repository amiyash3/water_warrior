import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ML_PER_OZ = 29.574;

/**
 * A "type your own amount" row to pair with preset ml/oz buttons.
 * Calls onSubmit(mlValue) with the amount already converted to ml,
 * so callers never have to worry about which unit was picked.
 */
export default function CustomAmountInput({ onSubmit, disabled = false, className }) {
  const [unit, setUnit] = useState('ml');
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    const num = parseFloat(value);
    if (!num || num <= 0) return;
    const ml = unit === 'oz' ? Math.round(num * ML_PER_OZ) : Math.round(num);
    onSubmit(ml);
    setValue('');
  };

  return (
    <div className={cn('flex items-center gap-2 mt-2', className)}>
      <Input
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        placeholder="Custom amount"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
          }
        }}
        className="rounded-2xl flex-1"
        disabled={disabled}
      />
      <div className="flex rounded-2xl border border-border overflow-hidden shrink-0">
        {['ml', 'oz'].map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => setUnit(u)}
            className={cn(
              'px-3 py-2 text-xs font-semibold transition-colors',
              unit === u ? 'water-gradient text-white' : 'bg-background hover:bg-muted'
            )}
          >
            {u}
          </button>
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        className="rounded-2xl water-gradient border-0 shrink-0"
        onClick={handleSubmit}
        disabled={disabled || !value}
      >
        Set
      </Button>
    </div>
  );
}
