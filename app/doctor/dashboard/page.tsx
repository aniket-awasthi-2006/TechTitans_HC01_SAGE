'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatusBadge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useAuth } from '@/components/providers/AuthProvider';
import { useSocket } from '@/components/providers/SocketProvider';
import { calculateWaitTime, formatWaitTime } from '@/lib/wait-time';
import { sortQueueForDoctor, sortWaitingByPriority } from '@/lib/queue-sort';
import toast from 'react-hot-toast';
import { Megaphone, CheckCircle2, Timer, Hourglass, Coffee, Plus, Trash2, UserX, TriangleAlert } from 'lucide-react';
import PrescriptionDisplay from '@/components/ui/PrescriptionDisplay';

/* ─── Relationship Display ─────────────────────────────────────────────────── */
const RELATIONSHIP_COLORS: Record<string, string> = {
  self: '#6366F1', spouse: '#EC4899', parent: '#F59E0B',
  child: '#22C55E', sibling: '#06B6D4', other: '#9CA3AF',
};
const RELATIONSHIP_LABELS: Record<string, string> = {
  self: 'Self', spouse: 'Spouse', parent: 'Parent',
  child: 'Child', sibling: 'Sibling', other: 'Other',
};

/* ─── Types ────────────────────────────────────────────────────────────────── */
interface Token {
  _id: string;
  tokenNumber: number;
  patientName: string;
  patientAge: number;
  patientPhone?: string;
  relationship?: string;
  bookedById?: { _id: string; name: string } | string;
  vitals?: { bp?: string; temp?: string; pulse?: string; weight?: string; spo2?: string };
  status: 'waiting' | 'in-progress' | 'done' | 'cancelled';
  isPriority?: boolean;
  priorityMarkedAt?: string;
  calledAt?: string;
  doctorId: { _id: string; name: string } | string;
}

interface Consultation {
  _id: string;
  patientName: string;
  relationship?: string;
  bookedById?: { _id: string; name: string } | string | null;
  diagnosis: string;
  prescription: string;
  notes?: string;
  date: string;
  duration?: number;
}

interface MedicineRow {
  id: number;
  name: string;
  qty: string;
  frequency: string;   // '1' | '2' | '3' | '4'
  timing: string;      // 'before' | 'after' | 'with'
  duration: string;
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
const FREQ_OPTIONS = [
  { value: '1', label: '1×/day' },
  { value: '2', label: '2×/day' },
  { value: '3', label: '3×/day' },
  { value: '4', label: '4×/day' },
];
const TIMING_OPTIONS = [
  { value: 'before', label: 'Before Meal' },
  { value: 'after',  label: 'After Meal'  },
  { value: 'with',   label: 'With Meal'   },
  { value: 'any',    label: 'Any Time'    },
];

let nextId = 1;
const newRow = (): MedicineRow => ({
  id: nextId++, name: '', qty: '1', frequency: '1', timing: 'after', duration: '',
});

function serializeMedicines(rows: MedicineRow[]): string {
  return rows
    .filter(r => r.name.trim())
    .map((r, i) => {
      const freq = FREQ_OPTIONS.find(f => f.value === r.frequency)?.label || `${r.frequency}×/day`;
      const timing = TIMING_OPTIONS.find(t => t.value === r.timing)?.label || r.timing;
      const course = r.duration.trim() ? ` — ${r.duration}` : '';
      return `${i + 1}. ${r.name.trim()} ×${r.qty}  ${freq}  ${timing}${course}`;
    })
    .join('\n');
}

/* ─── Component ────────────────────────────────────────────────────────────── */
export default function DoctorDashboard() {
  const { token, user } = useAuth();
  const { socket } = useSocket();
  const [queue, setQueue] = useState<Token[]>([]);
  const [selected, setSelected] = useState<Token | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'prescription'>('history');
  const [history, setHistory] = useState<Consultation[]>([]);
  const [diagnosis, setDiagnosis] = useState('');
  const [medicines, setMedicines] = useState<MedicineRow[]>([newRow()]);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [avgDuration, setAvgDuration] = useState(10);

  /* fetch ------------------------------------------------------------------- */
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
    return () => { socket.off('token_updated', refresh); socket.off('queue_updated', refresh); };
  }, [socket, fetchQueue]);

  /* keep selected token in sync after queue refreshes ----------------------- */
  useEffect(() => {
    setSelected(prev => {
      if (queue.length === 0) return null;
      if (prev) {
        const updated = queue.find(t => t._id === prev._id);
        if (updated) return updated;
      }
      return queue.find(t => t.status === 'in-progress') || null;
    });
  }, [queue]);

  /* timer ------------------------------------------------------------------- */
  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  /* actions ----------------------------------------------------------------- */
  const callNext = async () => {
    const next = waiting[0];
    if (!next) { toast.error('No waiting patients'); return; }
    try {
      const res = await fetch(`/api/tokens/${next._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'in-progress' }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const updatedToken = data?.token as Token | undefined;
        setSelected(updatedToken || { ...next, status: 'in-progress', calledAt: new Date().toISOString() });
        setActiveTab('history');
        setDiagnosis(''); setMedicines([newRow()]); setNotes('');
        toast.success(`Calling Token #${next.tokenNumber}`);
      }
    } catch { toast.error('Failed'); }
  };

  const skipPatient = async () => {
    if (!selected) return;
    if (!confirm(`Mark ${selected.patientName} as absent and skip?`)) return;
    setIsSkipping(true);
    try {
      const res = await fetch(`/api/tokens/${selected._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (res.ok) {
        toast.success(`${selected.patientName} marked absent — skipped.`);
        setSelected(null);
        fetchQueue();
      } else toast.error('Failed to skip');
    } catch { toast.error('Network error'); }
    setIsSkipping(false);
  };

  const submitConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const validMeds = medicines.filter(r => r.name.trim());
    if (!diagnosis.trim()) { toast.error('Diagnosis is required'); return; }
    if (validMeds.length === 0) { toast.error('Add at least one medicine'); return; }

    const prescription = serializeMedicines(medicines);
    setIsSubmitting(true);
    try {
      const durationMin = Math.max(1, Math.round(elapsed / 60));
      const res = await fetch(`/api/tokens/${selected._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'done', diagnosis, prescription, notes, duration: durationMin }),
      });
      if (res.ok) {
        toast.success('Consultation saved!');
        setSelected(null);
        setDiagnosis(''); setMedicines([newRow()]); setNotes('');
        fetchQueue();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to save');
      }
    } catch { toast.error('Network error'); }
    setIsSubmitting(false);
  };

  /* medicine table helpers -------------------------------------------------- */
  const addMed = () => setMedicines(m => [...m, newRow()]);
  const removeMed = (id: number) => setMedicines(m => m.filter(r => r.id !== id));
  const updateMed = (id: number, field: keyof MedicineRow, value: string) =>
    setMedicines(m => m.map(r => r.id === id ? { ...r, [field]: value } : r));

  /* misc -------------------------------------------------------------------- */
  const formatTimer = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const parsedCalledAtMs =
    selected?.status === 'in-progress' && selected.calledAt
      ? new Date(selected.calledAt).getTime()
      : NaN;
  const timerStartMs = Number.isFinite(parsedCalledAtMs) ? parsedCalledAtMs : null;
  const elapsed = timerStartMs ? Math.max(0, Math.floor((nowMs - timerStartMs) / 1000)) : 0;

  const getPatientHistory = (t: Token) => {
    const bookedByIdStr = typeof t.bookedById === 'object' && t.bookedById
      ? t.bookedById._id
      : (typeof t.bookedById === 'string' ? t.bookedById : null);
    return history.filter(c => {
      if (c.patientName === t.patientName) return true;
      if (bookedByIdStr) {
        const cBookedBy = typeof c.bookedById === 'object' && c.bookedById
          ? c.bookedById._id
          : (typeof c.bookedById === 'string' ? c.bookedById : null);
        if (cBookedBy === bookedByIdStr) return true;
      }
      return false;
    });
  };

  const waiting = sortWaitingByPriority(queue.filter(t => t.status === 'waiting'));
  const displayQueue = sortQueueForDoctor(queue);

  /* ─── Render ─────────────────────────────────────────────────────────────── */
  return (
    <DashboardLayout title={user?.name || 'Doctor'} subtitle="Your OPD Queue" requiredRole="doctor">
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, height: 'calc(100vh - 120px)' }}>

        {/* ── Queue Sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          <button onClick={callNext} disabled={waiting.length === 0}
            style={{
              width: '100%', padding: '18px',
              background: waiting.length > 0 ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'rgba(255,255,255,0.04)',
              border: waiting.length > 0 ? '1.5px solid rgba(165,180,252,0.35)' : '1.5px solid rgba(255,255,255,0.08)',
              borderRadius: 16, color: waiting.length > 0 ? 'white' : '#4B5563',
              fontSize: 18, fontWeight: 700,
              cursor: waiting.length > 0 ? 'pointer' : 'not-allowed', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'all 0.2s',
            }}>
            <Megaphone size={22} /> Call Next Patient
          </button>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'Waiting', val: waiting.length, color: '#F59E0B', Icon: Hourglass },
              { label: 'Done', val: queue.filter(t => t.status === 'done').length, color: '#22C55E', Icon: CheckCircle2 },
              { label: 'Avg', val: `${avgDuration}m`, color: '#6366F1', Icon: Timer },
            ].map(s => (
              <div key={s.label} className="glass-card" style={{ flex: 1, padding: '12px', textAlign: 'center' }}>
                <s.Icon size={16} color={s.color} style={{ margin: '0 auto 4px' }} />
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Queue list */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {isLoading ? (
              <div style={{ textAlign: 'center', color: '#6B7280', padding: 32 }}>Loading...</div>
            ) : queue.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#6B7280', padding: 40 }}>
                <Coffee size={36} strokeWidth={1.3} style={{ margin: '0 auto 10px' }} />
                <p>Queue is empty today</p>
              </div>
            ) : (
              displayQueue.map(t => {
                const isActive = t.status === 'in-progress';
                const isPriorityWaiting = t.status === 'waiting' && t.isPriority;
                const waitPos = waiting.findIndex(w => w._id === t._id);
                const rel = t.relationship || 'self';
                const relColor = RELATIONSHIP_COLORS[rel] || '#6366F1';
                return (
                  <div key={t._id} onClick={() => setSelected(t)} style={{
                    padding: 14, borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
                    background: isActive
                      ? 'rgba(99,102,241,0.15)'
                      : isPriorityWaiting
                        ? 'rgba(239,68,68,0.08)'
                        : selected?._id === t._id
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(255,255,255,0.03)',
                    border: isActive
                      ? '1px solid rgba(99,102,241,0.4)'
                      : isPriorityWaiting
                        ? '1px solid rgba(239,68,68,0.25)'
                        : '1px solid rgba(255,255,255,0.05)',
                    opacity: t.status === 'cancelled' ? 0.4 : 1,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: isActive ? '#A5B4FC' : '#F9FAFB' }}>
                        #{t.tokenNumber}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {t.status === 'waiting' && t.isPriority && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '1px 6px',
                            borderRadius: 12,
                            color: '#FCA5A5',
                            background: 'rgba(239,68,68,0.15)',
                            border: '1px solid rgba(239,68,68,0.35)',
                          }}>
                            <TriangleAlert size={10} /> PRIORITY
                          </span>
                        )}
                        {rel !== 'self' && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 12, background: `${relColor}20`, color: relColor }}>
                            {RELATIONSHIP_LABELS[rel]}
                          </span>
                        )}
                        <StatusBadge status={t.status} />
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#E5E7EB' }}>{t.patientName}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{t.patientAge}y</div>
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

        {/* ── Patient Panel ── */}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#F9FAFB' }}>{selected.patientName}</h2>
                      {selected.status === 'waiting' && selected.isPriority && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '2px 10px',
                          borderRadius: 20,
                          color: '#FCA5A5',
                          background: 'rgba(239,68,68,0.12)',
                          border: '1px solid rgba(239,68,68,0.32)',
                        }}>
                          <TriangleAlert size={12} /> Priority
                        </span>
                      )}
                      {selected.relationship && selected.relationship !== 'self' && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                          background: `${RELATIONSHIP_COLORS[selected.relationship] || '#9CA3AF'}20`,
                          color: RELATIONSHIP_COLORS[selected.relationship] || '#9CA3AF',
                        }}>
                          {RELATIONSHIP_LABELS[selected.relationship] || selected.relationship}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: '#9CA3AF' }}>
                      {selected.patientAge}y old · Token #{selected.tokenNumber}
                    </p>
                    {selected.relationship !== 'self' && (
                      <p style={{ fontSize: 12, color: '#6366F1', marginTop: 2 }}>
                        👤 Patient: {selected.patientName}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Skip / Mark Absent button */}
                    {['waiting', 'in-progress'].includes(selected.status) && (
                      <button
                        onClick={skipPatient}
                        disabled={isSkipping}
                        title="Mark patient as absent and skip"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.35)',
                          background: 'rgba(239,68,68,0.08)', color: '#FCA5A5',
                          fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        <UserX size={15} /> {isSkipping ? 'Skipping…' : 'Skip / Absent'}
                      </button>
                    )}
                    {/* Consultation timer */}
                    {selected.status === 'in-progress' && (
                      <div style={{
                        fontSize: 28, fontWeight: 700, color: elapsed > 600 ? '#EF4444' : '#22C55E',
                        background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: '8px 16px',
                      }}>
                        ⏱ {formatTimer(elapsed)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, marginTop: 16 }}>
                  {(['history', 'prescription'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{
                      padding: '6px 16px', borderRadius: 8, border: 'none', textTransform: 'capitalize',
                      background: activeTab === tab ? 'rgba(99,102,241,0.2)' : 'transparent',
                      color: activeTab === tab ? '#A5B4FC' : '#6B7280',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}>
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>


                {activeTab === 'history' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {selected.relationship && selected.relationship !== 'self' && (
                      <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#9CA3AF', marginBottom: 4 }}>
                        <span style={{ color: '#A5B4FC', fontWeight: 700 }}>
                          {selected.patientName}
                        </span>{' '}
                        · Showing history for {selected.patientName} ({RELATIONSHIP_LABELS[selected.relationship]}) and family.
                      </div>
                    )}
                    {getPatientHistory(selected).length === 0 ? (
                      <p style={{ color: '#6B7280' }}>No past consultations for this patient.</p>
                    ) : (
                      getPatientHistory(selected).map(c => {
                        const rel = c.relationship || 'self';
                        const relColor = RELATIONSHIP_COLORS[rel] || '#6366F1';
                        return (
                          <div key={c._id} className="glass-card" style={{ padding: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#F9FAFB' }}>{c.patientName}</span>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 12, background: `${relColor}20`, color: relColor }}>
                                  {RELATIONSHIP_LABELS[rel] || rel}
                                </span>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: 12, color: '#6B7280' }}>
                                  {new Date(c.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                                {c.duration && <div style={{ fontSize: 11, color: '#4B5563' }}>⏱ {c.duration}m</div>}
                              </div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#E5E7EB', marginBottom: 8 }}>🩺 {c.diagnosis}</div>
                            <div style={{ marginBottom: c.notes ? 8 : 0 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', marginBottom: 6 }}>PRESCRIPTION</div>
                              <PrescriptionDisplay prescription={c.prescription} compact />
                            </div>
                            {c.notes && (
                              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '8px 12px', marginTop: 8 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: '#D97706', marginBottom: 4 }}>NOTES</div>
                                <div style={{ fontSize: 13, color: '#FCD34D' }}>📝 {c.notes}</div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* ── Prescription Tab ── */}
                {activeTab === 'prescription' && selected.status === 'in-progress' && (
                  <form onSubmit={submitConsultation} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Diagnosis */}
                    <div>
                      <label className="form-label">Diagnosis *</label>
                      <textarea className="textarea-dark" rows={2} placeholder="Enter diagnosis…"
                        value={diagnosis} onChange={e => setDiagnosis(e.target.value)} required />
                    </div>

                    {/* ── Medicine Table ── */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <label className="form-label" style={{ margin: 0 }}>Prescription *</label>
                        <button type="button" onClick={addMed} style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(99,102,241,0.4)',
                          background: 'rgba(99,102,241,0.12)', color: '#A5B4FC',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}>
                          <Plus size={13} /> Add Medicine
                        </button>
                      </div>

                      {/* Table header */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 60px 90px 110px 90px 36px',
                        gap: 6, marginBottom: 6,
                        padding: '0 4px',
                      }}>
                        {['Medicine / Dose', 'Qty', 'Freq', 'Timing', 'Course', ''].map(h => (
                          <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</div>
                        ))}
                      </div>

                      {/* Table rows */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {medicines.map((row) => (
                          <div key={row.id} style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 60px 90px 110px 90px 36px',
                            gap: 6, alignItems: 'center',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: 10, padding: '8px 10px',
                          }}>
                            {/* Medicine name */}
                            <input
                              className="input-dark"
                              placeholder={`e.g. Paracetamol 500mg`}
                              value={row.name}
                              onChange={e => updateMed(row.id, 'name', e.target.value)}
                              style={{ fontSize: 13, padding: '7px 10px', borderRadius: 8 }}
                            />
                            {/* Qty */}
                            <input
                              className="input-dark"
                              type="number" min="0.5" step="0.5"
                              value={row.qty}
                              onChange={e => updateMed(row.id, 'qty', e.target.value)}
                              style={{ fontSize: 13, padding: '7px 8px', borderRadius: 8, textAlign: 'center' }}
                            />
                            {/* Frequency */}
                            <select
                              className="select-dark"
                              value={row.frequency}
                              onChange={e => updateMed(row.id, 'frequency', e.target.value)}
                              style={{ fontSize: 12, padding: '7px 6px', borderRadius: 8 }}
                            >
                              {FREQ_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                            {/* Timing */}
                            <select
                              className="select-dark"
                              value={row.timing}
                              onChange={e => updateMed(row.id, 'timing', e.target.value)}
                              style={{ fontSize: 12, padding: '7px 6px', borderRadius: 8 }}
                            >
                              {TIMING_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                            {/* Duration */}
                            <input
                              className="input-dark"
                              placeholder="e.g. 5 days"
                              value={row.duration}
                              onChange={e => updateMed(row.id, 'duration', e.target.value)}
                              style={{ fontSize: 12, padding: '7px 8px', borderRadius: 8 }}
                            />
                            {/* Remove */}
                            <button
                              type="button"
                              onClick={() => removeMed(row.id)}
                              disabled={medicines.length === 1}
                              style={{
                                background: 'none', border: 'none', cursor: medicines.length === 1 ? 'not-allowed' : 'pointer',
                                color: medicines.length === 1 ? '#374151' : '#EF4444',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: 4, borderRadius: 6,
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Preview */}
                      {medicines.some(r => r.name.trim()) && (
                        <div style={{ marginTop: 10, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10, padding: '10px 14px' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', letterSpacing: '0.06em', marginBottom: 6 }}>PRESCRIPTION PREVIEW</div>
                          <pre style={{ fontSize: 12, color: '#D1D5DB', whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, lineHeight: 1.7 }}>
                            {serializeMedicines(medicines)}
                          </pre>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="form-label">Doctor&apos;s Notes</label>
                      <textarea className="textarea-dark" rows={2} placeholder="Additional notes, follow-up instructions…"
                        value={notes} onChange={e => setNotes(e.target.value)} />
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
