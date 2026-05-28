import { motion } from 'framer-motion';
import logoUrl from '@/assets/logo.png';

export function OverviewEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-of-border bg-white px-8 py-16 text-center shadow-sm"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl">
        <img src={logoUrl} alt="Overfetch" className="h-full w-full object-contain" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900">No API data yet</h2>
      <p className="mt-2 max-w-md text-sm text-of-muted">
        Browse this domain and trigger API calls. Overfetch will capture JSON responses
        automatically and show what your UI actually uses.
      </p>
    </motion.div>
  );
}
