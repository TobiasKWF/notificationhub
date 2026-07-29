import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { connectWebSocket, disconnectWebSocket } from '@/lib/websocket';
import { useEffect } from 'react';
import { Bell, LayoutDashboard, Settings, Shield, Plug, Users, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

const nav = [
  { to: '/',             label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/notifications',label: 'Notifications',  icon: Bell },
  { to: '/rules',        label: 'Rules',           icon: Shield },
  { to: '/providers',    label: 'Providers',       icon: Plug },
  { to: '/settings',     label: 'Settings',        icon: Settings },
  { to: '/users',        label: 'Users',           icon: Users },
];

export function AppLayout() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  useEffect(() => {
    connectWebSocket();
    return () => disconnectWebSocket();
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 flex flex-col bg-card border-r border-border">
        <div className="px-5 py-4 text-lg font-semibold tracking-tight border-b border-border">
          NotificationHub
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="size-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
