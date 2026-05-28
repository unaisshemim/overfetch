import { motion } from 'framer-motion';
import logoUrl from '@/assets/logo.png';
import type { DashboardMetric } from '@/entrypoints/dashboard/types';

const accentStyles = {
  purple: 'bg-of-purple-light text-of-purple-dark',
  waste: 'bg-of-waste-light text-of-waste',
  used: 'bg-of-used-light text-of-used',
  neutral: 'bg-gray-100 text-gray-600',
};

interface DashboardMetricCardProps {
  metric: DashboardMetric;
  index?: number;
}

export function DashboardMetricCard({ metric, index = 0 }: DashboardMetricCardProps) {
  const accent = metric.accent ?? 'neutral';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      className="rounded-xl border border-of-border bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-of-muted">{metric.title}</span>
        <span className={`inline-flex h-8 w-8 overflow-hidden rounded-lg p-1 ${accentStyles[accent]}`}>
          <img src={logoUrl} alt="" className="h-full w-full object-contain" />
        </span>
      </div>
      <div className="text-2xl font-semibold tracking-tight text-gray-900">
        {metric.value}
      </div>
      <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-of-muted">
        {metric.helper}
      </p>
    </motion.div>
  );
}
