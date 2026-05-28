import type { LucideIcon } from 'lucide-react';
import logoUrl from '@/assets/logo.png';

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  accent?: 'purple' | 'waste' | 'used' | 'neutral';
}

const accentStyles = {
  purple: 'bg-of-purple-light text-of-purple-dark',
  waste: 'bg-of-waste-light text-of-waste',
  used: 'bg-of-used-light text-of-used',
  neutral: 'bg-gray-100 text-gray-700',
};

export function MetricCard({
  label,
  value,
  sub,
  icon: _Icon,
  accent = 'neutral',
}: MetricCardProps) {
  return (
    <div className="rounded-lg border border-of-border bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-of-muted">{label}</span>
        <span
          className={`inline-flex h-7 w-7 overflow-hidden rounded-md p-1 ${accentStyles[accent]}`}
        >
          <img src={logoUrl} alt="" className="h-full w-full object-contain" />
        </span>
      </div>
      <div className="text-lg font-semibold text-gray-900">{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-of-muted">{sub}</div> : null}
    </div>
  );
}
