import { motion } from 'framer-motion';
import type { PageComparisonRow } from '@/entrypoints/dashboard/types';

interface PageApiSummaryProps {
  rows: PageComparisonRow[];
  previousPageLabel: string;
}

const trendStyles: Record<PageComparisonRow['trend'], string> = {
  'up-bad': 'text-of-waste',
  'up-good': 'text-of-used',
  'down-bad': 'text-of-waste',
  'down-good': 'text-of-used',
  neutral: 'text-gray-600',
};

export function PageApiSummary({ rows, previousPageLabel }: PageApiSummaryProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
      whileHover={{ y: -2 }}
      className="rounded-xl border border-of-border bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-900">Page API Summary</h2>
        <span className="text-xs text-of-muted">
          Compared to previous page ({previousPageLabel})
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-of-border text-left text-xs text-of-muted">
              <th className="pb-2 pr-4 font-medium">Metric</th>
              <th className="pb-2 pr-4 font-medium">This Page</th>
              <th className="pb-2 pr-4 font-medium">Previous Page</th>
              <th className="pb-2 font-medium text-right">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.metric} className="border-b border-of-border/60 last:border-0">
                <td className="py-3 pr-4 font-medium text-gray-900">{row.metric}</td>
                <td className="py-3 pr-4 text-gray-700">{row.thisPage}</td>
                <td className="py-3 pr-4 text-of-muted">{row.previousPage}</td>
                <td className={`py-3 text-right font-semibold ${trendStyles[row.trend]}`}>
                  {row.change}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.article>
  );
}
