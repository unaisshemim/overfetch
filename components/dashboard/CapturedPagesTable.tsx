import { motion } from 'framer-motion';
import { formatBytes } from '@/lib/analyzer';
import { formatSessionTime } from '@/lib/session';
import type { CapturedPage } from '@/entrypoints/dashboard/types';

interface CapturedPagesTableProps {
  pages: CapturedPage[];
  onViewPage?: (page: CapturedPage) => void;
}

export function CapturedPagesTable({ pages, onViewPage }: CapturedPagesTableProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.12 }}
      className="overflow-hidden rounded-xl border border-of-border bg-white shadow-sm"
    >
      <div className="border-b border-of-border/80 px-5 py-4">
        <h2 className="text-base font-semibold text-gray-900">Pages Captured After Start</h2>
        <p className="mt-1 text-sm text-of-muted">
          Pages visited on this domain while tracking is active.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead>
            <tr className="border-b border-of-border/80 text-left text-xs font-medium uppercase tracking-wide text-of-muted">
              <th className="px-5 py-3">Page</th>
              <th className="px-4 py-3">URL path</th>
              <th className="px-4 py-3">Time captured</th>
              <th className="px-4 py-3">API calls</th>
              <th className="px-4 py-3">Payload</th>
              <th className="px-4 py-3">Used by UI</th>
              <th className="px-4 py-3">Wasted</th>
              <th className="px-4 py-3">Waste %</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.id} className="border-b border-of-border/60 last:border-0">
                <td className="px-5 py-4 font-medium text-gray-900">{page.title}</td>
                <td className="px-4 py-4 font-mono text-xs text-of-muted">{page.path}</td>
                <td className="px-4 py-4 text-gray-700">
                  {formatSessionTime(page.capturedAt)}
                </td>
                <td className="px-4 py-4">{page.apiCallCount} calls</td>
                <td className="px-4 py-4">{formatBytes(page.totalPayloadBytes)}</td>
                <td className="px-4 py-4">{formatBytes(page.usedBytes)}</td>
                <td className="px-4 py-4 text-of-waste">{formatBytes(page.wastedBytes)}</td>
                <td className="px-4 py-4 font-semibold">{page.wastePercentage}%</td>
                <td className="px-4 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => onViewPage?.(page)}
                    className="rounded-lg border border-of-border px-3 py-1.5 text-xs font-medium text-of-purple transition hover:bg-of-purple-light/50"
                  >
                    View page details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.article>
  );
}
