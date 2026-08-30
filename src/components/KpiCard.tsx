import type { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: number;
  helper: string;
  icon: LucideIcon;
  tone: 'gold' | 'blue' | 'amber' | 'green';
  onClick?: () => void;
  active?: boolean;
}

export function KpiCard({ label, value, helper, icon: Icon, tone, onClick, active=false }: Props) {
  const content = (
    <>
      <div className="kpi-icon"><Icon size={21} strokeWidth={1.8} /></div>
      <div>
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-helper">{helper}</div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={`kpi glass glass-hover tone-${tone} kpi-button ${active ? 'active' : ''}`}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <article className={`kpi glass glass-hover tone-${tone}`}>{content}</article>;
}
