import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, Camera, Users, User, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/api/client';
import UsernameSetup from './UsernameSetup';
import wallyMascot from '@/assets/wally-mascot.png';

const navItems = [
  { to: '/', icon: Home, label: 'Feed' },
  { to: '/discover', icon: Users, label: 'Friends' },
  { to: '/capture', icon: Camera, label: 'Capture', primary: true },
  { to: '/analytics', icon: BarChart2, label: 'Stats' },
  { to: '/account', icon: User, label: 'Account' },
];

export default function Layout() {
  const location = useLocation();
  const isCapture = location.pathname === '/capture';
  const [needsUsername, setNeedsUsername] = useState(false);

  useEffect(() => {
    api.auth.me().then(me => {
      if (!me.username) setNeedsUsername(true);
    });
  }, []);

  if (needsUsername) {
    return <UsernameSetup onComplete={() => setNeedsUsername(false)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 glass border-b border-border/50 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src={wallyMascot}
              alt="Wally the Water Warrior"
              className="w-10 h-10 rounded-full object-cover shadow-lg shadow-primary/20 ring-2 ring-primary/25 bg-white"
            />
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-none">Water Warrior</h1>
              <p className="text-[10px] text-muted-foreground tracking-wider uppercase mt-0.5">Stay Hydrated</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className={cn("max-w-2xl mx-auto", !isCapture && "pb-28")}>
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-2xl mx-auto px-4 pb-4">
          <div className="glass rounded-3xl border border-border/60 shadow-xl shadow-primary/5 px-2 py-2 flex items-center justify-around">
            {navItems.map((item) => {
              const Icon = item.icon;
              if (item.primary) {
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className="relative -mt-8"
                  >
                    {({ isActive }) => (
                      <div className={cn(
                        "w-16 h-16 rounded-full water-gradient flex items-center justify-center shadow-2xl shadow-primary/30 transition-all",
                        isActive ? "scale-110" : "hover:scale-105"
                      )}>
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
                  className={({ isActive }) => cn(
                    "flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
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