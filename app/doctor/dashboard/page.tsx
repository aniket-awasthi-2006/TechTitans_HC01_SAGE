'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useAuth } from '@/components/providers/AuthProvider';
import { useSocket } from '@/components/providers/SocketProvider';
import { calculateWaitTime, formatWaitTime } from '@/lib/wait-time';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface Token {
  _id: string;
  tokenNumber: number;
  patientName: string;
  patientAge: number;
  patientPhone?: string;
  symptoms: string;
  vitals?: { bp?: string; temp?: string; pulse?: string; weight?: string; spo2?: string };
  status: 'waiting' | 'in-progress' | 'done' | 'cancelled';
  calledAt?: string;
  doctorId: { _id: string; name: string } | string;
  createdAt: string;
}

interface Consultation {
  _id: string;
  patientName: string;
  diagnosis: string;
  prescription: string;
  date: string;
}

export default function DoctorDashboard() {
  const { token, user } = useAuth();
  const { socket } = useSocket();
  const [queue, setQueue] = useState<Token[]>([]);
  const [selected, setSelected] = useState<Token | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'prescription'>('info');
  const [history, setHistory] = useState<Consultation[]>([]);
  const [consultForm, setConsultForm] = useState({ diagnosis: '', prescription: '', notes: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timerStart, setTimerStart] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [avgDuration, setAvgDuration] = useState(10);

  const fetchQueue = useCallback(async () => {
    if (!token) return;
    try {
      const [qRes, cRes] = await Promise.all([
        fetch('/api/tokens', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/consultations', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [qData, cData] = await Promise.all([qRes.json(), cRes.json()]);
      setQueue(qData.tokens || []);
      setHistory(cData.consultations || []);
      setAvgDuration(cData.avgDuration || 10);
    } catch { toast.error('Failed to load queue'); }
    finally { setIsLoading(false); }
  }, [token]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchQueue();
    socket.on('token_updated', refresh);
    socket.on('queue_updated', refresh);
    return () => {
      socket.off('token_updated', refresh);
      socket.off('queue_updated', refresh);
    };
  }, [socket, fetchQueue]);

  // Consultation timer
  useEffect(() => {
    if (!timerStart) { setElapsed(0); return; }
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - timerStart.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerStart]);

  const callNext = async () => {
    const nextWaiting = queue.find((t) => t.status === 'waiting');
    if (!nextWaiting) { toast.error('No waiting patients'); return; }

    try {
      const res = await fetch(`/api/tokens/${nextWaiting._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'in-progress' }),
      });
      if (res.ok) {
        setSelected(nextWaiting);
        setTimerStart(new Date());
        setActiveTab('info');
        toast.success(`Calling Token #${nextWaiting.tokenNumber}`);
      }
    } catch { toast.error('Failed'); }
  };

  const submitConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setIsSubmitting(true);
    try {
      const durationMin = Math.max(1, Math.round(elapsed / 60));
      const res = await fetch(`/api/tokens/${selected._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'done', ...consultForm, duration: durationMin }),
      });
      if (res.ok) {
        toast.success('Consultation saved!');
        setSelected(null);
        setTimerStart(null);
        setConsultForm({ diagnosis: '', prescription: '', notes: '' });
        fetchQueue();
      } else toast.error('Failed to save');
    } catch { toast.error('Network error'); }
    setIsSubmitting(false);
  };

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const waiting = queue.filter((t) => t.status === 'waiting');
  const inProgress = queue.find((t) => t.status === 'in-progress');

  return (
    <DashboardLayout title={`Dr. ${user?.name}`} subtitle="Your OPD Queue" requiredRole="doctor">
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, height: 'calc(100vh - 120px)' }}>
        
        {/* Queue List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          {/* Call Next CTA */}
          <button
            onClick={callNext}
            className="animate-pulse-glow"
            disabled={waiting.length === 0}
            style={{
              width: '100%',
              padding: '18px',
              background: waiting.length > 0 ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: 16,
              color: 'white',
              fontSize: 18,
              fontWeight: 700,
              cursor: waiting.length > 0 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'all 0.2s',
              boxShadow: waiting.length > 0 ? '0 8px 32px rgba(99,102,241,0.4)' : 'none',
            }}
          >
            <span style={{ fontSize: 24 }}>📢</span>
            Call Next Patient
          </button>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'Waiting', val: waiting.length, color: '#F59E0B' },
              { label: 'Done', val: queue.filter((t) => t.status === 'done').length, color: '#22C55E' },
              { label: 'Avg', val: `${avgDuration}m`, color: '#6366F1' },
            ].map((s) => (
              <div key={s.label} className="glass-card" style={{ flex: 1, padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Queue items */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {isLoading ? (
              <div style={{ textAlign: 'center', color: '#6B7280', padding: 32 }}>Loading...</div>
            ) : queue.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#6B7280', padding: 40 }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>☕</div>
                <p>Queue is empty today</p>
              </div>
            ) : (
              queue.map((t, idx) => {
                const isActive = t.status === 'in-progress';
                const waitPos = waiting.findIndex((w) => w._id === t._id);
                return (
                  <div
                    key={t._id}
                    onClick={() => setSelected(t)}
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      background: isActive
                        ? 'rgba(99,102,241,0.15)'
                        : selected?._id === t._id
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(255,255,255,0.03)',
                      border: isActive
                        ? '1px solid rgba(99,102,241,0.4)'
                        : '1px solid rgba(255,255,255,0.05)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      opacity: t.status === 'cancelled' ? 0.4 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: isActive ? '#A5B4FC' : '#F9FAFB' }}>
                        #{t.tokenNumber}
                      </span>
                      <StatusBadge status={t.status} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#E5E7EB' }}>{t.patientName}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                      {t.patientAge}y · {t.symptoms.substring(0, 40)}...
                    </div>
                    {t.status === 'waiting' && waitPos >= 0 && (
                      <div style={{ fontSize: 12, marginTop: 4, color: '#F59E0B' }}>
                        Wait: {formatWaitTime(calculateWaitTime(waitPos, avgDuration))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Patient Detail Panel */}
        <div className="glass-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#6B7280' }}>
              <div style={{ fontSize: 64 }}>👆</div>
              <p style={{ fontSize: 16 }}>Select a patient or call next</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: '#F9FAFB' }}>{selected.patientName}</h2>
                    <p style={{ fontSize: 13, color: '#9CA3AF' }}>
                      {selected.patientAge}y old · Token #{selected.tokenNumber}
                    </p>
                  </div>
                  {selected.status === 'in-progress' && (
                    <div
                      className="consultation-timer"
                      style={{
                        fontSize: 28,
                        fontWeight: 700,
                        color: elapsed > 600 ? '#EF4444' : '#22C55E',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: 12,
                        padding: '8px 16px',
                      }}
                    >
                      ⏱ {formatTimer(elapsed)}
                    </div>
                  )}
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, marginTop: 16 }}>
                  {(['info', 'history', 'prescription'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      style={{
                        padding: '6px 16px',
                        borderRadius: 8,
                        border: 'none',
                        background: activeTab === tab ? 'rgba(99,102,241,0.2)' : 'transparent',
                        color: activeTab === tab ? '#A5B4FC' : '#6B7280',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                {activeTab === 'info' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <InfoRow label="Symptoms" value={selected.symptoms} />
                    {selected.patientPhone && <InfoRow label="Phone" value={selected.patientPhone} />}
                    {selected.vitals && Object.values(selected.vitals).some(Boolean) && (
                      <div>
                        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vitals</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                          {selected.vitals.bp && <VitalCard label="BP" value={selected.vitals.bp} unit="mmHg" />}
                          {selected.vitals.temp && <VitalCard label="Temp" value={selected.vitals.temp} unit="°F" />}
                          {selected.vitals.pulse && <VitalCard label="Pulse" value={selected.vitals.pulse} unit="bpm" />}
                          {selected.vitals.weight && <VitalCard label="Weight" value={selected.vitals.weight} unit="kg" />}
                          {selected.vitals.spo2 && <VitalCard label="SpO2" value={selected.vitals.spo2} unit="%" />}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'history' && (
                  <div>
                    {history.filter((h) => h.patientName === selected.patientName).length === 0 ? (
                      <p style={{ color: '#6B7280' }}>No consultation history found.</p>
                    ) : (
                      history.filter((h) => h.patientName === selected.patientName).map((c) => (
                        <div key={c._id} className="glass-card" style={{ marginBottom: 12, padding: 16 }}>
                          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>{c.date}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#E5E7EB', marginBottom: 4 }}>Diagnosis: {c.diagnosis}</div>
                          <div style={{ fontSize: 13, color: '#9CA3AF' }}>Rx: {c.prescription}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'prescription' && selected.status === 'in-progress' && (
                  <form onSubmit={submitConsultation} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label className="form-label">Diagnosis *</label>
                      <textarea className="textarea-dark" rows={3} placeholder="Enter diagnosis..." value={consultForm.diagnosis} onChange={(e) => setConsultForm((f) => ({ ...f, diagnosis: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="form-label">Prescription *</label>
                      <textarea className="textarea-dark" rows={4} placeholder="Medicines, dosage, duration..." value={consultForm.prescription} onChange={(e) => setConsultForm((f) => ({ ...f, prescription: e.target.value }))} required />
                    </div>
                    <div>
                      <label className="form-label">Notes</label>
                      <textarea className="textarea-dark" rows={2} placeholder="Additional notes..." value={consultForm.notes} onChange={(e) => setConsultForm((f) => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <Button type="submit" isLoading={isSubmitting} style={{ width: '100%' }}>
                      ✅ Complete Consultation
                    </Button>
                  </form>
                )}

                {activeTab === 'prescription' && selected.status !== 'in-progress' && (
                  <p style={{ color: '#6B7280' }}>Call this patient first to write a prescription.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, color: '#E5E7EB', lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

function VitalCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#F9FAFB' }}>{value} <span style={{ fontSize: 11, color: '#9CA3AF' }}>{unit}</span></div>
    </div>
  );
}
