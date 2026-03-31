'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/Card';
import StatusBadge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useAuth } from '@/components/providers/AuthProvider';
import { useSocket } from '@/components/providers/SocketProvider';
import { calculateWaitTime, formatWaitTime } from '@/lib/wait-time';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Ticket, Hourglass, Stethoscope, Timer, X, PhoneCall, CheckCircle, Plus } from 'lucide-react';

interface Doctor {
  _id: string;
  name: string;
  specialization?: string;
}

interface Token {
  _id: string;
  tokenNumber: number;
  patientName: string;
  patientAge: number;
  symptoms: string;
  status: 'waiting' | 'in-progress' | 'done' | 'cancelled';
  doctorId: { _id: string; name: string; specialization?: string } | string;
  createdAt: string;
}

export default function ReceptionDashboard() {
  const { token } = useAuth();
  const { socket } = useSocket();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [avgDuration, setAvgDuration] = useState(10);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [tokensRes, docRes, consultRes] = await Promise.all([
        fetch('/api/tokens', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/users?role=doctor', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/consultations', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [tokensData, docData, consultData] = await Promise.all([
        tokensRes.json(),
        docRes.json(),
        consultRes.json(),
      ]);
      setTokens(tokensData.tokens || []);
      setDoctors(docData.users || []);
      setAvgDuration(consultData.avgDuration || 10);
    } catch {
      toast.error('Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchData();
    socket.on('token_created', refresh);
    socket.on('token_updated', refresh);
    socket.on('queue_updated', refresh);
    return () => {
      socket.off('token_created', refresh);
      socket.off('token_updated', refresh);
      socket.off('queue_updated', refresh);
    };
  }, [socket, fetchData]);

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/tokens/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (res.ok) toast.success(`Token marked as ${status}`);
      else toast.error('Failed to update');
    } catch { toast.error('Network error'); }
  };

  const waiting = tokens.filter((t) => t.status === 'waiting');
  const inProgress = tokens.filter((t) => t.status === 'in-progress');
  const done = tokens.filter((t) => t.status === 'done');

  return (
    <DashboardLayout title="Reception Dashboard" subtitle="Manage OPD queue in real-time" requiredRole="reception">
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard title="Total Tokens Today" value={tokens.length} icon={<Ticket size={20} />} color="#6366F1" />
        <StatCard title="Waiting" value={waiting.length} icon={<Hourglass size={20} />} color="#F59E0B" />
        <StatCard title="In Progress" value={inProgress.length} icon={<Stethoscope size={20} />} color="#3B82F6" />
        <StatCard title="Avg Wait Time" value={formatWaitTime(avgDuration)} icon={<Timer size={20} />} color="#22C55E" />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#F9FAFB' }}>Queue — {format(new Date(), 'dd MMM yyyy')}</h2>
        <Button onClick={() => setShowModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plus size={15} /> Create Token</Button>
      </div>

      {/* Queue Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>Loading queue...</div>
        ) : tokens.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <p>No tokens yet today. Create the first one!</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Patient</th>
                <th>Age</th>
                <th>Doctor</th>
                <th>Symptoms</th>
                <th>Status</th>
                <th>Wait</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t, idx) => {
                const doc = typeof t.doctorId === 'object' ? t.doctorId : null;
                const patientsAhead = waiting.findIndex((w) => w._id === t._id);
                const wait = t.status === 'waiting' ? calculateWaitTime(patientsAhead, avgDuration) : 0;
                return (
                  <tr key={t._id} style={{ opacity: t.status === 'cancelled' ? 0.5 : 1 }}>
                    <td>
                      <span
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: t.status === 'in-progress' ? '#60A5FA' : '#F9FAFB',
                        }}
                      >
                        #{t.tokenNumber}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{t.patientName}</td>
                    <td style={{ color: '#9CA3AF' }}>{t.patientAge}y</td>
                    <td style={{ color: '#C4B5FD' }}>{doc?.name || 'Unassigned'}</td>
                    <td style={{ color: '#9CA3AF', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.symptoms}
                    </td>
                    <td><StatusBadge status={t.status} /></td>
                    <td style={{ color: '#6B7280', fontSize: 13 }}>
                      {t.status === 'waiting' ? formatWaitTime(wait) : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {t.status === 'waiting' && (
                          <button className="btn-ghost" style={{ height: 30, padding: '0 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => updateStatus(t._id, 'in-progress')}>
                            <PhoneCall size={12} /> Call
                          </button>
                        )}
                        {t.status === 'in-progress' && (
                          <button className="btn-ghost" style={{ height: 30, padding: '0 10px', fontSize: 12, color: '#22C55E', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => updateStatus(t._id, 'done')}>
                            <CheckCircle size={12} /> Done
                          </button>
                        )}
                        {!['done', 'cancelled'].includes(t.status) && (
                          <button className="btn-ghost" style={{ height: 30, padding: '0 10px', fontSize: 12, color: '#EF4444', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => updateStatus(t._id, 'cancelled')}>
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Token Create Modal */}
      {showModal && (
        <TokenCreateModal
          doctors={doctors}
          token={token!}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchData(); }}
        />
      )}
    </DashboardLayout>
  );
}

function TokenCreateModal({
  doctors,
  token,
  onClose,
  onCreated,
}: {
  doctors: Doctor[];
  token: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    patientName: '',
    patientAge: '',
    patientPhone: '',
    symptoms: '',
    doctorId: '',
    vitals: { bp: '', temp: '', pulse: '', weight: '', spo2: '' },
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.doctorId) { toast.error('Please select a doctor'); return; }
    setIsLoading(true);
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, patientAge: parseInt(form.patientAge) }),
      });
      if (res.ok) {
        toast.success('Token created!');
        onCreated();
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed');
      }
    } catch { toast.error('Network error'); }
    setIsLoading(false);
  };

  const setVital = (key: string, val: string) => {
    setForm((f) => ({ ...f, vitals: { ...f.vitals, [key]: val } }));
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#F9FAFB' }}>Create OPD Token</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Patient Name *</label>
              <input className="input-dark" placeholder="Full Name" value={form.patientName} onChange={(e) => setForm((f) => ({ ...f, patientName: e.target.value }))} required />
            </div>
            <div>
              <label className="form-label">Age *</label>
              <input className="input-dark" type="number" placeholder="Age" value={form.patientAge} onChange={(e) => setForm((f) => ({ ...f, patientAge: e.target.value }))} required />
            </div>
          </div>
          <div>
            <label className="form-label">Phone</label>
            <input className="input-dark" placeholder="+91 XXXXXXXXXX" value={form.patientPhone} onChange={(e) => setForm((f) => ({ ...f, patientPhone: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">Assign Doctor *</label>
            <select className="select-dark" value={form.doctorId} onChange={(e) => setForm((f) => ({ ...f, doctorId: e.target.value }))} required>
              <option value="">Select Doctor</option>
              {doctors.map((d) => (
                <option key={d._id} value={d._id}>{d.name}{d.specialization ? ` — ${d.specialization}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Symptoms *</label>
            <textarea className="textarea-dark" placeholder="Describe patient symptoms..." rows={3} value={form.symptoms} onChange={(e) => setForm((f) => ({ ...f, symptoms: e.target.value }))} required />
          </div>

          {/* Vitals */}
          <div>
            <label className="form-label">Vitals (optional)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[['bp', 'BP (mmHg)'], ['temp', 'Temp (°F)'], ['pulse', 'Pulse (bpm)'], ['weight', 'Wt (kg)'], ['spo2', 'SpO2 (%)']].map(([key, label]) => (
                <input key={key} className="input-dark" placeholder={label} value={form.vitals[key as keyof typeof form.vitals]} onChange={(e) => setVital(key, e.target.value)} style={{ fontSize: 13 }} />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            <Button type="submit" isLoading={isLoading} style={{ flex: 2 }}>Create Token</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
