'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useSocket } from '@/components/providers/SocketProvider';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { Wifi, WifiOff } from 'lucide-react';
import React from 'react';

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  const { user } = useAuth();
  const { isConnected } = useSocket();

  return (
    <div className="topbar">
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</p>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <ThemeToggle compact />

        {/* Real-time status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isConnected
            ? <Wifi size={15} color="#22C55E" />
            : <WifiOff size={15} color="#EF4444" />}
          <span style={{ fontSize: 12, color: isConnected ? '#22C55E' : '#EF4444', fontWeight: 500 }}>
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>

        {/* Time */}
        <div style={{
          fontSize: 13, color: 'var(--text-muted)',
          background: 'var(--theme-toggle-bg)',
          padding: '6px 12px', borderRadius: 8,
          border: '1px solid var(--theme-toggle-border)',
        }}>
          <LiveClock />
        </div>
      </div>
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = React.useState('');
  React.useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, []);
  return <span>{time}</span>;
}
