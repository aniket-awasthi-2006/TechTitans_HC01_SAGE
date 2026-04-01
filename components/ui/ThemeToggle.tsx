'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

interface ThemeToggleProps {
  compact?: boolean;
}

export default function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { theme, toggleTheme, isReady } = useTheme();

  const isLight = theme === 'light';
  const iconSize = compact ? 15 : 16;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      disabled={!isReady}
      aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      title={isLight ? 'Dark mode' : 'Light mode'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 0 : 7,
        height: compact ? 32 : 36,
        padding: compact ? '0 8px' : '0 12px',
        borderRadius: 10,
        border: '1px solid var(--theme-toggle-border)',
        background: 'var(--theme-toggle-bg)',
        color: 'var(--text-secondary)',
        cursor: isReady ? 'pointer' : 'not-allowed',
        transition: 'all 0.2s ease',
        fontSize: 12,
        fontWeight: 600,
      }}
      onMouseEnter={(e) => {
        if (!isReady) return;
        e.currentTarget.style.color = 'var(--text-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--text-secondary)';
      }}
    >
      {isLight ? <Moon size={iconSize} /> : <Sun size={iconSize} />}
      {!compact && <span>{isLight ? 'Dark' : 'Light'}</span>}
    </button>
  );
}
