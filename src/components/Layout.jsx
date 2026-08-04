import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, Camera, Users, User, UsersRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/api/client';
import UsernameSetup from './UsernameSetup';
import wallyMascot from '@/assets/wally-mascot.png';

const navItems = [
  { to: '/', icon: Home, label: 'Feed' },
  { to: '/discover', icon: Users, label: 'Friends' },
  { to: '/capture', icon: Camera, label: 'Capture', primary: true },
  { to: '/groups', icon: UsersRound, label: 'Groups' },
  { to: '/account', icon: User, label: 'Account' },
];
export default function Layout() {
  const location = useLocation();
  const isCapture = location.pathname === '/capture';
  const [needsUsername, setNeedsUsername] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    api.auth.me().then((me) => {
      if (!me.username) setNeedsUsername(true);
    });
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Reset header solid state when changing pages
  useEffect(() => {
    setScrolled(window.scrollY > 8);
  }, [location.pathname]);

  if (needsUsername) {
    return <UsernameSetup onComplete={() => setNeedsUsername(false)} />;
  }

  return (
    <div className="min-h-[100dvh] bg-background overscroll-none">
      {/* Top bar: solid white at rest → clear glass once scrolled */}
      <header
        className={cn(
          'sticky top-0 z-40 pt-[env(safe-area-inset-top)] transition-[background-color,backdrop-filter,border-color,box-shadow] duration-200',
          scrolled
            ? 'bg-transparent border-b border-transparent'
            : 'bg-background border-b border-border/40'
        )}
      >
        <div
          className={cn(
            'max-w-2xl mx-auto px-5 py-3 flex items-center justify-between transition-all duration-200',
            scrolled && 'py-2'
          )}
        >
          <div
            className={cn(
              'flex items-center gap-2.5 rounded-full transition-all duration-200',
              scrolled && 'pl-1.5 pr-3 py-1 bg-background/80 backdrop-blur-xl border border-border/40 shadow-sm'
            )}
          >
            <img
              src={wallyMascot}
              alt="Wally the Water Warrior"
              className="w-10 h-10 rounded-full object-cover bg-white shrink-0"
            />
            <div className={cn(!scrolled && 'pr-1')}>
              <h1 className="text-lg font-bold tracking-tight leading-none">Water Warrior</h1>
              {!scrolled && (
                <p className="text-[10px] text-muted-foreground tracking-wider uppercase mt-0.5">
                  Stay Hydrated
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className={cn('max-w-2xl mx-auto', !isCapture && 'pb-32')}>
        <Outlet />
      </main>

      {/* Solid fill under the home-indicator so bottom bounce isn't black */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-background"
        style={{ height: 'env(safe-area-inset-bottom)' }}
        aria-hidden
      />

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="bg-background/90 backdrop-blur-xl rounded-3xl border border-border/60 shadow-xl shadow-primary/5 px-2 py-2 flex items-center justify-around">
            {navItems.map((item) => {
              const Icon = item.icon;
              if (item.primary) {
                return (
                  <NavLink key={item.to} to={item.to} className="relative -mt-8">
                    {({ isActive }) => (
                      <div
                        className={cn(
                          'w-16 h-16 rounded-full water-gradient flex items-center justify-center shadow-2xl shadow-primary/30 transition-all',
                          isActive ? 'scale-110' : 'hover:scale-105'
                        )}
                      >
                        <Icon className="w-7 h-7 text-white" strokeWidth={2.5} />
                      </div>
                    )}
                  </NavLink>
                );
              }
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all',
                      isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                    )
                  }
                >
                  <Icon className="w-5 h-5" strokeWidth={2} />
                  <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
