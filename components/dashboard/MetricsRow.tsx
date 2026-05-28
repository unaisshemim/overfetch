import { DashboardMetricCard } from './DashboardMetricCard';
import type { DashboardMetric } from '@/entrypoints/dashboard/types';

interface MetricsRowProps {
  metrics: DashboardMetric[];
}

export function MetricsRow({ metrics }: MetricsRowProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {metrics.map((metric, index) => (
        <DashboardMetricCard key={metric.id} metric={metric} index={index} />
      ))}
    </section>
  );
}
