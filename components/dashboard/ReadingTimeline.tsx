import { motion } from 'framer-motion';
import type { TimelineStep } from '@/entrypoints/dashboard/types';

interface ReadingTimelineProps {
  steps: TimelineStep[];
}

export function ReadingTimeline({ steps }: ReadingTimelineProps) {
  if (steps.length === 0) return null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.18 }}
      className="rounded-xl border border-of-border bg-white p-5 shadow-sm"
    >
      <h2 className="mb-4 text-base font-semibold text-gray-900">Session Timeline</h2>
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-of-border bg-gray-50 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-of-purple" />
              {step.label}
            </span>
            {index < steps.length - 1 ? (
              <span className="text-of-muted" aria-hidden>
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </motion.article>
  );
}
