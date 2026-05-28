import { motion } from 'framer-motion';
import { WasteBar } from '@/components/WasteBar';
import type { UnusedEndpoint } from '@/entrypoints/dashboard/types';

interface EndpointWasteListProps {
  endpoints: UnusedEndpoint[];
}

const methodColors: Record<string, string> = {
  GET: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  POST: 'bg-blue-50 text-blue-700 border-blue-200',
  PUT: 'bg-amber-50 text-amber-700 border-amber-200',
  PATCH: 'bg-orange-50 text-orange-700 border-orange-200',
  DELETE: 'bg-red-50 text-red-700 border-red-200',
};

export function EndpointWasteList({ endpoints }: EndpointWasteListProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.2 }}
      whileHover={{ y: -2 }}
      className="rounded-xl border border-of-border bg-white p-5 shadow-sm"
    >
      <h2 className="mb-4 text-base font-semibold text-gray-900">Top Waste by Endpoint</h2>
      <ul className="space-y-4">
        {endpoints.map((endpoint, index) => (
          <motion.li
            key={`${endpoint.method}-${endpoint.path}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 + index * 0.06 }}
            className="space-y-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                    methodColors[endpoint.method] ?? 'bg-gray-50 text-gray-700 border-gray-200'
                  }`}
                >
                  {endpoint.method}
                </span>
                <span className="truncate font-mono text-xs text-gray-800">{endpoint.path}</span>
              </div>
              <span className="shrink-0 text-xs font-medium text-of-waste">
                {endpoint.wastedLabel}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <WasteBar percent={endpoint.wastePercent} />
              </div>
              <span className="w-9 text-right text-[11px] font-semibold text-of-waste">
                {endpoint.wastePercent}%
              </span>
            </div>
          </motion.li>
        ))}
      </ul>
    </motion.article>
  );
}
