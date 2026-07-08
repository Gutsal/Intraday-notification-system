import type { ReactNode } from 'react';
import './Badge.scss';

export type BadgeTone = 'danger' | 'warning' | 'healthy' | 'neutral';

interface BadgeProps {
  tone: BadgeTone;
  children: ReactNode;
}

export function Badge({ tone, children }: BadgeProps) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
