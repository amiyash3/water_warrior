import { cn } from '@/lib/utils';
import wallyMascot from '@/assets/wally-mascot.png';

/**
 * Wally mark that blends white PNG fills into the app background
 * (pure white in the asset vs hsl(205 60% 98%) page bg).
 */
export default function WallyLogo({ className, alt = 'Wally the Water Warrior' }) {
  return (
    <img
      src={wallyMascot}
      alt={alt}
      className={cn('object-contain mix-blend-multiply', className)}
    />
  );
}
