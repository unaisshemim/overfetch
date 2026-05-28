import { motion } from 'framer-motion';
import { Braces } from 'lucide-react';
import type { UnusedField } from '@/entrypoints/dashboard/types';

interface UnusedFieldListProps {
  fields: UnusedField[];
}

export function UnusedFieldList({ fields }: UnusedFieldListProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.25 }}
      whileHover={{ y: -2 }}
      className="rounded-xl border border-of-border bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Biggest Unused Fields</h2>
        <button
          type="button"
          className="text-xs font-medium text-of-purple transition hover:text-of-purple-dark"
        >
          View all
        </button>
      </div>
      <ul className="divide-y divide-of-border/70">
        {fields.map((field, index) => (
          <motion.li
            key={field.path}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 + index * 0.04 }}
            className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="inline-flex rounded-md bg-gray-100 p-1.5 text-of-muted">
                <Braces className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <span className="truncate font-mono text-xs text-gray-800">{field.path}</span>
                {field.type ? (
                  <span className="mt-0.5 block text-[10px] text-of-muted">{field.type}</span>
                ) : null}
              </div>
            </div>
            <span className="shrink-0 text-xs font-semibold text-of-waste">
              {field.wastedLabel}
            </span>
          </motion.li>
        ))}
      </ul>
    </motion.article>
  );
}
