'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useSocket } from '@/components/providers/SocketProvider';

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
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#F9FAFB' }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{subtitle}</p>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Real-time status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isConnected ? '#22C55E' : '#EF4444',
              boxShadow: isConnected ? '0 0 8px rgba(34,197,94,0.6)' : 'none',
              animation: isConnected ? 'pulse-glow 2s infinite' : 'none',
            }}
          />
          <span style={{ fontSize: 12, color: '#6B7280' }}>
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>

        {/* Time */}
        <div
          style={{
            fontSize: 13,
            color: '#6B7280',
            background: 'rgba(255,255,255,0.04)',
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <LiveClock />
        </div>

        {/* User avatar */}
        {user && (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: 'white',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(99,102,241,0.3)',
            }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = React.useState('');

  React.useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return <span>{time}</span>;
}

import React from 'react';
