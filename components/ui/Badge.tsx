'use client';

interface BadgeProps {
  status: 'waiting' | 'in-progress' | 'done' | 'cancelled';
}

const statusConfig = {
  waiting: { label: 'Waiting', className: 'badge-waiting', dot: '#F59E0B' },
  'in-progress': { label: 'In Progress', className: 'badge-progress', dot: '#60A5FA' },
  done: { label: 'Done', className: 'badge-done', dot: '#22C55E' },
  cancelled: { label: 'Cancelled', className: 'badge-cancelled', dot: '#EF4444' },
};

export default function StatusBadge({ status }: BadgeProps) {
  const config = statusConfig[status] || statusConfig.waiting;
  return (
    <span className={`badge ${config.className}`}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: config.dot,
          display: 'inline-block',
          animation: status === 'in-progress' ? 'pulse-glow 1.5s infinite' : undefined,
        }}
      />
      {config.label}
    </span>
  );
}
