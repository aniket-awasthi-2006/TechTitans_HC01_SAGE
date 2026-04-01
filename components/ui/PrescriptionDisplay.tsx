'use client';

/* ─── Parser ──────────────────────────────────────────────────────────────── */
interface MedLine {
  index: number;
  name: string;
  qty: string;
  frequency: string;
  timing: string;
  duration: string;
}

function parsePrescription(text: string): MedLine[] {
  const lines = text.split('\n').filter(l => l.trim());
  const meds: MedLine[] = [];
  for (const line of lines) {
    const match = line.match(
      /^\d+\.\s+(.+?)\s+×(\S+)\s+(\d+×\/day)\s+(Before Meal|After Meal|With Meal|Any Time)(.*)?$/
    );
    if (match) {
      meds.push({
        index:     meds.length + 1,
        name:      match[1].trim(),
        qty:       match[2],
        frequency: match[3],
        timing:    match[4].trim(),
        duration:  (match[5] || '').replace(/^\s*—\s*/, '').trim(),
      });
    }
  }
  return meds;
}

/* ─── Config ──────────────────────────────────────────────────────────────── */
const TIMING_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  'Before Meal': { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', icon: '🍽️' },
  'After Meal':  { color: '#22C55E', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  icon: '✅' },
  'With Meal':   { color: '#60A5FA', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.3)', icon: '🥗' },
  'Any Time':    { color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.2)', icon: '🕐' },
};

const FREQ_DOTS: Record<string, number> = {
  '1×/day': 1, '2×/day': 2, '3×/day': 3, '4×/day': 4,
};

/* ─── Component ───────────────────────────────────────────────────────────── */
export default function PrescriptionDisplay({
  prescription,
  compact = false,
}: {
  prescription: string;
  compact?: boolean;
}) {
  const meds = parsePrescription(prescription);

  /* Fallback — plain text for old / unparseable prescriptions */
  if (meds.length === 0) {
    return (
      <div style={{ fontSize: 13, color: '#9CA3AF', whiteSpace: 'pre-line', lineHeight: 1.8 }}>
        {prescription}
      </div>
    );
  }

  const cellBase: React.CSSProperties = {
    padding: compact ? '7px 10px' : '10px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    fontSize: compact ? 12 : 13,
    verticalAlign: 'middle',
  };
  const headCell: React.CSSProperties = {
    padding: compact ? '6px 10px' : '8px 14px',
    fontSize: 10,
    fontWeight: 700,
    color: '#6B7280',
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    textAlign: 'left',
    background: 'rgba(255,255,255,0.03)',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  } as React.CSSProperties;

  return (
    <div style={{
      borderRadius: 10,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.08)',
      width: '100%',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...headCell, width: 28 }}>#</th>
            <th style={headCell}>Medicine / Dose</th>
            <th style={{ ...headCell, textAlign: 'center', width: compact ? 40 : 52 }}>Qty</th>
            {!compact && <th style={{ ...headCell, textAlign: 'center', width: 80 }}>Frequency</th>}
            <th style={{ ...headCell, textAlign: 'center', width: compact ? 90 : 120 }}>Timing</th>
            <th style={{ ...headCell, width: compact ? 70 : 90 }}>Course</th>
          </tr>
        </thead>
        <tbody>
          {meds.map((med, i) => {
            const timing  = TIMING_CONFIG[med.timing] || TIMING_CONFIG['Any Time'];
            const dots    = FREQ_DOTS[med.frequency] ?? 1;
            const isLast  = i === meds.length - 1;
            const rowBg   = i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent';
            const lastBorder = isLast ? 'none' : undefined;

            return (
              <tr key={med.index} style={{ background: rowBg }}>
                {/* # */}
                <td style={{ ...cellBase, borderBottom: lastBorder, fontWeight: 800, color: '#6366F1', textAlign: 'center' }}>
                  {med.index}
                </td>

                {/* Medicine name */}
                <td style={{ ...cellBase, borderBottom: lastBorder, fontWeight: 600, color: '#E5E7EB' }}>
                  {med.name}
                </td>

                {/* Qty */}
                <td style={{ ...cellBase, borderBottom: lastBorder, textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block', fontWeight: 800, color: '#A5B4FC',
                    background: 'rgba(99,102,241,0.15)', borderRadius: 6,
                    padding: '2px 8px', fontSize: compact ? 12 : 13,
                  }}>
                    ×{med.qty}
                  </span>
                </td>

                {/* Frequency — full mode only */}
                {!compact && (
                  <td style={{ ...cellBase, borderBottom: lastBorder, textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {Array.from({ length: dots }).map((_, j) => (
                          <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: '#93C5FD' }} />
                        ))}
                        {Array.from({ length: 4 - dots }).map((_, j) => (
                          <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
                        ))}
                      </div>
                      <span style={{ fontSize: 11, color: '#93C5FD', fontWeight: 700 }}>{med.frequency}</span>
                    </div>
                  </td>
                )}

                {/* Timing */}
                <td style={{ ...cellBase, borderBottom: lastBorder, textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block',
                    background: timing.bg, border: `1px solid ${timing.border}`,
                    color: timing.color, borderRadius: 8,
                    padding: compact ? '2px 7px' : '3px 10px',
                    fontSize: compact ? 10 : 11, fontWeight: 700, whiteSpace: 'nowrap',
                  }}>
                    {timing.icon} {compact ? med.timing.split(' ')[0] : med.timing}
                  </span>
                </td>

                {/* Course / Duration */}
                <td style={{ ...cellBase, borderBottom: lastBorder, color: '#6B7280' }}>
                  {med.duration ? (
                    <span style={{ fontSize: compact ? 11 : 12 }}>📅 {med.duration}</span>
                  ) : (
                    <span style={{ color: '#374151' }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
