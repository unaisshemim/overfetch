import type { UnusedSubtreeSummary } from './types';

interface TopUnusedSubtreesProps {
  items: UnusedSubtreeSummary[];
}

export function TopUnusedSubtrees({ items }: TopUnusedSubtreesProps) {
  return (
    <div className="rounded-xl border border-of-border bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Top Unused Subtrees</h3>
      {items.length === 0 ? (
        <p className="mt-4 text-xs text-of-muted">No unused subtrees detected on this page.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.path}
              className="rounded-lg border border-of-border/80 bg-of-surface px-3 py-2.5"
            >
              <p className="truncate font-mono text-xs font-medium text-gray-900">{item.path}</p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-of-muted">
                <span>{item.fieldCount} unused fields</span>
                <span className="font-semibold text-of-waste">{item.wastedLabel}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
