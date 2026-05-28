import { formatBytes } from '@/lib/analyzer';
import type { CapturedPage } from '@/lib/session';

interface PageMetricStripProps {
  page: CapturedPage;
  efficiencyScore: number;
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'used' | 'waste' | 'purple';
}) {
  const valueClass =
    tone === 'used'
      ? 'text-of-used'
      : tone === 'waste'
        ? 'text-of-waste'
        : tone === 'purple'
          ? 'text-of-purple'
          : 'text-gray-900';

  return (
    <div className="min-w-[88px] flex-1 rounded-lg border border-of-border/80 bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[11px] font-medium text-of-muted">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}

function EfficiencyRing({ score }: { score: number }) {
  const size = 52;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex min-w-[120px] flex-col items-center rounded-lg border border-of-border/80 bg-white px-3 py-2 shadow-sm">
      <p className="text-[11px] font-medium text-of-muted">Efficiency</p>
      <div className="relative mt-1 flex items-center justify-center">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#ede9fe"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <span className="absolute text-xs font-semibold text-gray-900">{score}</span>
      </div>
    </div>
  );
}

export function PageMetricStrip({ page, efficiencyScore }: PageMetricStripProps) {
  return (
    <div className="flex flex-wrap items-stretch gap-2 lg:flex-nowrap lg:justify-end">
      <MetricCard label="Payload" value={formatBytes(page.totalPayloadBytes)} />
      <MetricCard label="Used by UI" value={formatBytes(page.usedBytes)} tone="used" />
      <MetricCard label="Unused" value={formatBytes(page.wastedBytes)} tone="waste" />
      <EfficiencyRing score={efficiencyScore} />
    </div>
  );
}
