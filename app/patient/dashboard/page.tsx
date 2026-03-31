'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/components/providers/AuthProvider';
import { useSocket } from '@/components/providers/SocketProvider';
import { calculateWaitTime, formatWaitTime } from '@/lib/wait-time';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';

interface Token {
  _id: string;
  tokenNumber: number;
  patientName: string;
  status: 'waiting' | 'in-progress' | 'done' | 'cancelled';
  doctorId: { _id: string; name: string; specialization?: string } | string;
}

interface Consultation {
  _id: string;
  diagnosis: string;
  prescription: string;
  doctorName: string;
  date: string;
  notes?: string;
}

export default function PatientDashboard() {
  const { user, token } = useAuth();
  const { socket } = useSocket();
  const [myToken, setMyToken] = useState<Token | null>(null);
  const [allTokens, setAllTokens] = useState<Token[]>([]);
  const [history, setHistory] = useState<Consultation[]>([]);
  const [doctors, setDoctors] = useState<Array<{ _id: string; name: string; specialization?: string }>>([]);
  const [avgDuration, setAvgDuration] = useState(10);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinForm, setJoinForm] = useState({ symptoms: '', doctorId: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [animateQueue, setAnimateQueue] = useState(false);

  const fetchData = useCallback(async () => {
    if (!token || !user) return;
    try {
      const [tRes, cRes, dRes, consRes] = await Promise.all([
        fetch('/api/tokens', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/consultations', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/users?role=doctor', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/consultations', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [tData, cData, dData] = await Promise.all([tRes.json(), cRes.json(), dRes.json()]);
      const allT: Token[] = tData.tokens || [];
      setAllTokens(allT);
      const mine = allT.find((t) => t.patientName === user.name && ['waiting', 'in-progress'].includes(t.status));
      if (mine) setMyToken(mine);
      setHistory(cData.consultations?.filter((c: Consultation & { patientName?: string }) => c.patientName === user.name) || []);
      setDoctors(dData.users || []);
      setAvgDuration(cData.avgDuration || 10);
    } catch { toast.error('Failed to load data'); }
    finally { setIsLoading(false); }
  }, [token, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => {
      setAnimateQueue(true);
      setTimeout(() => setAnimateQueue(false), 500);
      fetchData();
    };
    socket.on('queue_updated', refresh);
    socket.on('token_updated', refresh);
    socket.on('doctor_called_next', refresh);
    return () => {
      socket.off('queue_updated', refresh);
      socket.off('token_updated', refresh);
      socket.off('doctor_called_next', refresh);
    };
  }, [socket, fetchData]);

  const joinQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinForm.doctorId) { toast.error('Select a doctor'); return; }
    setIsJoining(true);
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patientName: user?.name,
          patientAge: 25, // default — in a real app, get from profile
          symptoms: joinForm.symptoms,
          doctorId: joinForm.doctorId,
        }),
      });
      if (res.ok) {
        toast.success("You've joined the queue!");
        setShowJoinModal(false);
        fetchData();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed');
      }
    } catch { toast.error('Network error'); }
    setIsJoining(false);
  };

  const waiting = allTokens.filter((t) => t.status === 'waiting');
  const myPosition = myToken ? waiting.findIndex((t) => t._id === myToken._id) : -1;
  const estimatedWait = myPosition >= 0 ? calculateWaitTime(myPosition, avgDuration) : 0;

  const getStatusMessage = () => {
    if (!myToken) return null;
    if (myToken.status === 'in-progress') return { text: "You're being seen now!", color: '#22C55E' };
    if (myPosition === 0) return { text: "You're next! Please proceed.", color: '#60A5FA' };
    return { text: `${myPosition} patient(s) ahead of you`, color: '#F59E0B' };
  };

  const statusMsg = getStatusMessage();

  return (
    <DashboardLayout title={`Hello, ${user?.name?.split(' ')[0]} 👋`} subtitle="Your OPD status" requiredRole="patient">
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        
        {/* Queue Position Card */}
        {myToken ? (
          <div
            className={`glass-card-elevated ${myToken.status === 'in-progress' ? 'token-active-pulse' : ''}`}
            style={{ padding: 32, textAlign: 'center', marginBottom: 20 }}
          >
            <div style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Your Token Number
            </div>
            <div
              className={animateQueue ? 'animate-count-up' : ''}
              style={{
                fontSize: 80,
                fontWeight: 900,
                lineHeight: 1,
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                marginBottom: 16,
              }}
            >
              #{myToken.tokenNumber}
            </div>

            {statusMsg && (
              <div
                style={{
                  display: 'inline-block',
                  padding: '8px 20px',
                  borderRadius: 30,
                  background: `${statusMsg.color}20`,
                  border: `1px solid ${statusMsg.color}40`,
                  color: statusMsg.color,
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 20,
                }}
              >
                {statusMsg.text}
              </div>
            )}

            {/* Wait time */}
            {myToken.status === 'waiting' && myPosition > 0 && (
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: '#F9FAFB' }}>{myPosition}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>Position</div>
                </div>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
                <div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: '#F59E0B' }}>{formatWaitTime(estimatedWait)}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>Est. Wait</div>
                </div>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
                <div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: '#22C55E' }}>
                    {typeof myToken.doctorId === 'object' ? myToken.doctorId.name.split(' ').pop() : '—'}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>Doctor</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="glass-card-elevated" style={{ padding: 32, textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🏥</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#F9FAFB', marginBottom: 8 }}>
              Not in Queue
            </h2>
            <p style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 24 }}>
              Join the OPD queue to see your live position and estimated wait time.
            </p>
            <Button onClick={() => setShowJoinModal(true)} style={{ width: '100%' }}>
              + Join OPD Queue
            </Button>
          </div>
        )}

        {/* Current queue snapshot */}
        <div className="glass-card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#F9FAFB', marginBottom: 12 }}>Live Queue Snapshot</h3>
          {waiting.slice(0, 5).map((t, i) => (
            <div
              key={t._id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 0',
                borderBottom: i < Math.min(waiting.length, 5) - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 700, color: i === 0 ? '#6366F1' : '#6B7280', width: 40, textAlign: 'center' }}>
                #{t.tokenNumber}
              </span>
              <span style={{ fontSize: 14, color: '#9CA3AF' }}>
                {t.patientName.charAt(0)}{'*'.repeat(t.patientName.length - 1)} {/* Masked */}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6B7280' }}>
                ~{calculateWaitTime(i, avgDuration)}m
              </span>
            </div>
          ))}
          {waiting.length === 0 && <p style={{ color: '#6B7280', fontSize: 14, textAlign: 'center' }}>Queue is empty</p>}
        </div>

        {/* History */}
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#F9FAFB', marginBottom: 12 }}>Consultation History</h3>
          {history.length === 0 ? (
            <p style={{ color: '#6B7280', fontSize: 14 }}>No past consultations yet.</p>
          ) : (
            history.map((c) => (
              <div key={c._id} className="glass-card" style={{ marginBottom: 10, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: '#9CA3AF' }}>{c.date}</span>
                  <span style={{ fontSize: 12, color: '#C4B5FD' }}>Dr. {c.doctorName}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#E5E7EB', marginBottom: 4 }}>
                  🩺 {c.diagnosis}
                </div>
                <div style={{ fontSize: 13, color: '#9CA3AF' }}>💊 {c.prescription}</div>
                {c.notes && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>📝 {c.notes}</div>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Join Queue Modal */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowJoinModal(false)}>
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#F9FAFB' }}>Join OPD Queue</h2>
              <button onClick={() => setShowJoinModal(false)} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            <form onSubmit={joinQueue} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Select Doctor *</label>
                <select className="select-dark" value={joinForm.doctorId} onChange={(e) => setJoinForm((f) => ({ ...f, doctorId: e.target.value }))} required>
                  <option value="">Choose a doctor</option>
                  {doctors.map((d) => (
                    <option key={d._id} value={d._id}>{d.name}{d.specialization ? ` — ${d.specialization}` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Symptoms / Reason for Visit *</label>
                <textarea className="textarea-dark" rows={4} placeholder="Describe your symptoms..." value={joinForm.symptoms} onChange={(e) => setJoinForm((f) => ({ ...f, symptoms: e.target.value }))} required />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn-ghost" onClick={() => setShowJoinModal(false)} style={{ flex: 1 }}>Cancel</button>
                <Button type="submit" isLoading={isJoining} style={{ flex: 2 }}>Join Queue</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
