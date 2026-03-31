'use client';

import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { formatWaitTime, calculateWaitTime } from '@/lib/wait-time';
import { format } from 'date-fns';

interface Token {
  _id: string;
  tokenNumber: number;
  patientName: string;
  status: 'waiting' | 'in-progress' | 'done' | 'cancelled';
  doctorId: { _id: string; name: string; specialization?: string } | string;
}

export default function DisplayPanel() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [currentToken, setCurrentToken] = useState<Token | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [animateToken, setAnimateToken] = useState(false);
  const [avgDuration, setAvgDuration] = useState(10);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch('/api/tokens');
      if (!res.ok) return;
      const data = await res.json();
      const allTokens: Token[] = data.tokens || [];
      setTokens(allTokens);
      const inProgress = allTokens.find((t) => t.status === 'in-progress');
      setCurrentToken((prev) => {
        if (inProgress && prev?._id !== inProgress._id) {
          setAnimateToken(true);
          setTimeout(() => setAnimateToken(false), 1000);
        }
        return inProgress || null;
      });
    } catch { /* silent */ }
  }, []);

  // Socket.io connection
  useEffect(() => {
    const socket: Socket = io('', {
      path: '/api/socket',
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('token_updated', () => fetchTokens());
    socket.on('queue_updated', () => fetchTokens());
    socket.on('token_created', () => fetchTokens());
    socket.on('doctor_called_next', () => fetchTokens());
    socket.on('consultation_completed', () => fetchTokens());

    return () => { socket.disconnect(); };
  }, [fetchTokens]);

  // Initial fetch
  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  // Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(format(now, 'EEEE, dd MMMM yyyy'));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const waiting = tokens.filter((t) => t.status === 'waiting');
  const nextTokens = waiting.slice(0, 5);
  const totalWaiting = waiting.length;

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        background: 'radial-gradient(ellipse at 20% 30%, rgba(99,102,241,0.2) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(6,182,212,0.15) 0%, transparent 50%), #0B0F1A',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 48px',
          borderBottom: '1px solid rgba(99,102,241,0.15)',
          background: 'rgba(17,24,39,0.8)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              boxShadow: '0 4px 20px rgba(99,102,241,0.5)',
            }}
          >
            🏥
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#F9FAFB' }}>MediQueue</div>
            <div style={{ fontSize: 13, color: '#6B7280' }}>Real-Time Token Display</div>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: '#F9FAFB',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.05em',
            }}
          >
            {currentTime}
          </div>
          <div style={{ fontSize: 13, color: '#9CA3AF' }}>{currentDate}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: isConnected ? '#22C55E' : '#EF4444',
              boxShadow: isConnected ? '0 0 10px rgba(34,197,94,0.8)' : 'none',
              animation: isConnected ? 'pulse-glow 2s infinite' : 'none',
            }}
          />
          <span style={{ fontSize: 14, color: '#9CA3AF', fontWeight: 500 }}>
            {isConnected ? 'Live' : 'Reconnecting...'}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 380px', gap: 0 }}>
        
        {/* LEFT — Current Token */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 60px',
            borderRight: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 20 }}>
            Now Serving
          </div>

          {currentToken ? (
            <div
              style={{ textAlign: 'center' }}
              className={animateToken ? 'animate-token-appear' : ''}
            >
              <div
                style={{
                  fontSize: 'clamp(100px, 18vw, 180px)',
                  fontWeight: 900,
                  lineHeight: 1,
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6, #06B6D4)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: 'drop-shadow(0 0 40px rgba(99,102,241,0.6))',
                  marginBottom: 24,
                  animation: 'pulse-glow 3s ease-in-out infinite',
                }}
              >
                #{currentToken.tokenNumber}
              </div>

              <div
                style={{
                  fontSize: 28,
                  fontWeight: 600,
                  color: '#E5E7EB',
                  marginBottom: 12,
                }}
              >
                Please proceed to your doctor
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 28px',
                  background: 'rgba(99,102,241,0.15)',
                  border: '1px solid rgba(99,102,241,0.35)',
                  borderRadius: 40,
                  marginBottom: 20,
                }}
              >
                <span style={{ fontSize: 18 }}>👨‍⚕️</span>
                <span style={{ fontSize: 20, fontWeight: 600, color: '#C4B5FD' }}>
                  {typeof currentToken.doctorId === 'object' ? currentToken.doctorId.name : 'Your Doctor'}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 120,
                  fontWeight: 900,
                  color: 'rgba(99,102,241,0.15)',
                  lineHeight: 1,
                  marginBottom: 20,
                }}
              >
                —
              </div>
              <p style={{ fontSize: 22, color: '#4B5563' }}>No patient currently being seen</p>
            </div>
          )}
        </div>

        {/* RIGHT — Next Tokens + Stats */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(11,15,26,0.5)',
            padding: '32px 28px',
          }}
        >
          {/* Next tokens */}
          <div style={{ marginBottom: 32 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#6B7280',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                marginBottom: 16,
              }}
            >
              Up Next
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {nextTokens.length === 0 ? (
                <p style={{ color: '#4B5563', fontSize: 16, textAlign: 'center', padding: 20 }}>Queue is empty</p>
              ) : (
                nextTokens.map((t, idx) => (
                  <div
                    key={t._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '14px 18px',
                      background: idx === 0
                        ? 'rgba(99,102,241,0.12)'
                        : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${idx === 0 ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.04)'}`,
                      borderRadius: 12,
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <span
                      style={{
                        fontSize: idx === 0 ? 26 : 22,
                        fontWeight: 800,
                        color: idx === 0 ? '#A5B4FC' : '#6B7280',
                        minWidth: 60,
                      }}
                    >
                      #{t.tokenNumber}
                    </span>
                    <div>
                      <div style={{ fontSize: 16, color: idx === 0 ? '#E5E7EB' : '#9CA3AF', fontWeight: 600 }}>
                        {/* Masked patient name */}
                        {t.patientName.charAt(0)}{'•'.repeat(Math.min(t.patientName.length - 1, 5))}
                      </div>
                      <div style={{ fontSize: 12, color: '#4B5563', marginTop: 2 }}>
                        ~{formatWaitTime(calculateWaitTime(idx, avgDuration))}
                      </div>
                    </div>
                    {idx === 0 && (
                      <div style={{ marginLeft: 'auto', fontSize: 11, color: '#6366F1', fontWeight: 600, background: 'rgba(99,102,241,0.15)', padding: '3px 8px', borderRadius: 20 }}>
                        NEXT
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Stats */}
          <div
            style={{
              borderTop: '1px solid rgba(255,255,255,0.05)',
              paddingTop: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              Queue Status
            </div>
            {[
              { icon: '⏳', label: 'Waiting', value: totalWaiting, color: '#F59E0B' },
              { icon: '⏱️', label: 'Avg Wait', value: `${avgDuration} min`, color: '#6366F1' },
              { icon: '✅', label: 'Served Today', value: tokens.filter((t) => t.status === 'done').length, color: '#22C55E' },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{s.icon}</span>
                  <span style={{ fontSize: 14, color: '#9CA3AF' }}>{s.label}</span>
                </div>
                <span style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom ticker */}
      <div
        style={{
          padding: '14px 48px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(6,182,212,0.05))',
          borderTop: '1px solid rgba(99,102,241,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 40,
        }}
      >
        <span style={{ fontSize: 14, color: '#6B7280' }}>
          🏥 MediQueue · OPD Queue Management System
        </span>
        <span style={{ fontSize: 14, color: '#4B5563' }}>|</span>
        <span style={{ fontSize: 14, color: '#9CA3AF' }}>
          Follow the display board for your token number
        </span>
        <span style={{ fontSize: 14, color: '#4B5563' }}>|</span>
        <span style={{ fontSize: 14, color: '#6B7280' }}>
          📞 Emergency: 102
        </span>
      </div>
    </div>
  );
}
