'use client';

import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { formatWaitTime, calculateWaitTime } from '@/lib/wait-time';
import { format } from 'date-fns';
import Image from 'next/image';
import { Wifi, WifiOff, Clock, Users, CheckCircle2, Timer, Stethoscope } from 'lucide-react';

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
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch('/api/display');
      if (!res.ok) {
        console.error('[Display] API error:', res.status);
        return;
      }
      const data = await res.json();
      const allTokens: Token[] = data.tokens || [];
      setTokens(allTokens);
      if (data.avgDuration) setAvgDuration(data.avgDuration);
      setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      const inProgress = allTokens.find((t) => t.status === 'in-progress');
      setCurrentToken((prev) => {
        if (inProgress && prev?._id !== inProgress._id) {
          setAnimateToken(true);
          setTimeout(() => setAnimateToken(false), 1000);
        }
        return inProgress || null;
      });
    } catch (err) {
      console.error('[Display] fetch error:', err);
    }
  }, []);

  // Socket.io — real-time updates
  useEffect(() => {
    const socket: Socket = io('', {
      path: '/api/socket',
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('token_updated', fetchTokens);
    socket.on('queue_updated', fetchTokens);
    socket.on('token_created', fetchTokens);
    socket.on('doctor_called_next', fetchTokens);
    socket.on('consultation_completed', fetchTokens);

    return () => { socket.disconnect(); };
  }, [fetchTokens]);

  // Initial fetch + polling fallback every 15s
  useEffect(() => {
    fetchTokens();
    const poll = setInterval(fetchTokens, 15000);
    return () => clearInterval(poll);
  }, [fetchTokens]);

  // Clock
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(format(now, 'EEEE, dd MMMM yyyy'));
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, []);

  const waiting = tokens.filter((t) => t.status === 'waiting');
  const done    = tokens.filter((t) => t.status === 'done');
  const nextTokens = waiting.slice(0, 6);

  const doctorName = currentToken && typeof currentToken.doctorId === 'object'
    ? currentToken.doctorId.name : 'Your Doctor';

  return (
    <div style={{
      minHeight: '100vh', width: '100vw',
      background: 'radial-gradient(ellipse at 20% 30%, rgba(99,102,241,0.18) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(6,182,212,0.12) 0%, transparent 50%), #0B0F1A',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>

      {/* ── Header Bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 40px',
        borderBottom: '1px solid rgba(99,102,241,0.15)',
        background: 'rgba(17,24,39,0.85)', backdropFilter: 'blur(20px)',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Image src="/logo.png" alt="MediQueue" width={64} height={64} style={{ borderRadius: 18, boxShadow: '0 4px 20px rgba(99,102,241,0.5)' }} />
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#F9FAFB' }}>MediQueue</div>
            <div style={{ fontSize: 13, color: '#6B7280' }}>Real-Time OPD Queue Display</div>
          </div>
        </div>

        {/* Clock */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 38, fontWeight: 800, color: '#F9FAFB', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>
            {currentTime}
          </div>
          <div style={{ fontSize: 13, color: '#9CA3AF' }}>{currentDate}</div>
        </div>

        {/* Status */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isConnected ? <Wifi size={16} color="#22C55E" /> : <WifiOff size={16} color="#EF4444" />}
            <span style={{ fontSize: 14, color: '#9CA3AF', fontWeight: 600 }}>
              {isConnected ? 'Live' : 'Reconnecting…'}
            </span>
          </div>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: '#4B5563', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={10} /> Updated {lastUpdated}
            </span>
          )}
        </div>
      </div>

      {/* ── Main Body ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 400px', minHeight: 0 }}>

        {/* LEFT — Now Serving */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '40px 60px', borderRight: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Stethoscope size={16} color="#6B7280" /> Now Serving
          </div>

          {currentToken ? (
            <div style={{ textAlign: 'center' }} className={animateToken ? 'animate-token-appear' : ''}>
              {/* Big token number */}
              <div style={{
                fontSize: 'clamp(100px, 18vw, 200px)', fontWeight: 900, lineHeight: 1,
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6, #06B6D4)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                filter: 'drop-shadow(0 0 40px rgba(99,102,241,0.5))',
                marginBottom: 20,
              }}>
                #{currentToken.tokenNumber}
              </div>

              <div style={{ fontSize: 22, fontWeight: 600, color: '#E5E7EB', marginBottom: 16 }}>
                Please proceed to your doctor
              </div>

              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '12px 28px', borderRadius: 40,
                background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)',
              }}>
                <span style={{ fontSize: 20 }}>👨‍⚕️</span>
                <span style={{ fontSize: 20, fontWeight: 600, color: '#C4B5FD' }}>{doctorName}</span>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 100, fontWeight: 900, color: 'rgba(99,102,241,0.12)', lineHeight: 1, marginBottom: 16 }}>—</div>
              <p style={{ fontSize: 20, color: '#4B5563' }}>No patient currently being seen</p>
              {waiting.length > 0 && (
                <p style={{ fontSize: 16, color: '#6B7280', marginTop: 8 }}>
                  {waiting.length} patient{waiting.length > 1 ? 's' : ''} waiting
                </p>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — Queue list + stats */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          background: 'rgba(11,15,26,0.6)',
          borderLeft: '1px solid rgba(255,255,255,0.04)',
          overflow: 'hidden',
        }}>
          {/* Up Next header */}
          <div style={{ padding: '24px 24px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 2 }}>
              📋 Up Next in Queue
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#F59E0B' }}>
              {waiting.length} <span style={{ fontSize: 14, fontWeight: 500, color: '#6B7280' }}>waiting</span>
            </div>
          </div>

          {/* Queue rows */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {nextTokens.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#4B5563', fontSize: 16 }}>
                🎉 Queue is empty!
              </div>
            ) : (
              nextTokens.map((t, idx) => {
                const doc = typeof t.doctorId === 'object' ? t.doctorId : null;
                return (
                  <div key={t._id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', borderRadius: 12,
                    background: idx === 0 ? 'rgba(99,102,241,0.14)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${idx === 0 ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)'}`,
                    transition: 'all 0.3s ease',
                  }}>
                    <span style={{ fontSize: idx === 0 ? 28 : 22, fontWeight: 800, color: idx === 0 ? '#A5B4FC' : '#6B7280', minWidth: 60, textAlign: 'center' }}>
                      #{t.tokenNumber}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: idx === 0 ? 17 : 15, fontWeight: 600, color: idx === 0 ? '#E5E7EB' : '#9CA3AF', marginBottom: 2 }}>
                        {t.patientName.charAt(0)}{'•'.repeat(Math.min(t.patientName.length - 1, 5))}
                      </div>
                      {doc && (
                        <div style={{ fontSize: 12, color: '#4B5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {doc.name}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, color: idx === 0 ? '#F59E0B' : '#4B5563', fontWeight: 600 }}>
                        ~{formatWaitTime(calculateWaitTime(idx, avgDuration))}
                      </div>
                      {idx === 0 && (
                        <div style={{ fontSize: 10, color: '#6366F1', fontWeight: 700, background: 'rgba(99,102,241,0.15)', padding: '2px 8px', borderRadius: 20, marginTop: 4 }}>
                          NEXT
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {waiting.length > 6 && (
              <div style={{ textAlign: 'center', fontSize: 13, color: '#4B5563', padding: '8px 0' }}>
                +{waiting.length - 6} more in queue
              </div>
            )}
          </div>

          {/* Stats footer */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { icon: <Users size={16} />,        label: 'Waiting',      value: waiting.length, color: '#F59E0B' },
              { icon: <Timer size={16} />,         label: 'Avg Wait',     value: `${avgDuration} min`,  color: '#6366F1' },
              { icon: <CheckCircle2 size={16} />,  label: 'Served Today', value: done.length,    color: '#22C55E' },
            ].map(s => (
              <div key={s.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: 'rgba(255,255,255,0.03)',
                borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {s.icon}
                  <span style={{ fontSize: 13, color: '#9CA3AF' }}>{s.label}</span>
                </div>
                <span style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Footer Ticker ── */}
      <div style={{
        padding: '12px 40px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(6,182,212,0.04))',
        borderTop: '1px solid rgba(99,102,241,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32, flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, color: '#6B7280' }}>🏥 MediQueue · OPD Queue Management</span>
        <span style={{ color: '#374151' }}>|</span>
        <span style={{ fontSize: 13, color: '#9CA3AF' }}>Watch the display for your token number</span>
        <span style={{ color: '#374151' }}>|</span>
        <span style={{ fontSize: 13, color: '#6B7280' }}>📞 Emergency: 102</span>
      </div>
    </div>
  );
}
