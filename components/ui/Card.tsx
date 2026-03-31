'use client';

import { ReactNode, CSSProperties } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  elevated?: boolean;
  onClick?: () => void;
}

export default function Card({ children, className = '', style, elevated = false, onClick }: CardProps) {
  return (
    <div
      className={`${elevated ? 'glass-card-elevated' : 'glass-card'} ${className}`}
      style={{ padding: 20, ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  color = '#6366F1',
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  color?: string;
  trend?: { value: number; label: string };
}) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: `${color}22`,
            border: `1px solid ${color}33`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
          }}
        >
          {icon}
        </div>
        {trend && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: trend.value >= 0 ? '#22C55E' : '#EF4444',
              background: trend.value >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              padding: '3px 8px',
              borderRadius: 20,
            }}
          >
            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#F9FAFB', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#9CA3AF' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}
