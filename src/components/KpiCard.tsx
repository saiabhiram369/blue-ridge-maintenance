import type { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: number;
  helper: string;
  icon: LucideIcon;
  tone: 'gold' | 'blue' | 'amber' | 'green';
}

export function KpiCard({ label, value, helper, icon: Icon, tone }: Props) {
  return (
    <article className={`kpi glass glass-hover tone-${tone}`}>
      <div className="kpi-icon"><Icon size={21} strokeWidth={1.8} /></div>
      <div>
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-helper">{helper}</div>
      </div>
    </article>
  );
}
