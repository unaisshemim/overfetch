import { motion } from 'framer-motion';
import { Globe, RefreshCw } from 'lucide-react';
import {
  sessionStartedLabel,
  useDashboardStore,
} from '@/entrypoints/dashboard/store';

interface SessionHeaderProps {
  onRefresh: () => void;
  onReset: () => void;
}

function DomainFavicon({
  favicon,
  domain,
}: {
  favicon?: string;
  domain: string;
}) {
  if (favicon) {
    return (
      <img
        src={favicon}
        alt=""
        className="h-10 w-10 shrink-0 rounded-lg border border-of-border object-cover"
      />
    );
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-of-purple text-sm font-bold text-white">
      {domain.charAt(0).toUpperCase()}
    </div>
  );
}

export function SessionHeader({ onRefresh, onReset }: SessionHeaderProps) {
  const session = useDashboardStore((s) => s.session);
  const refreshing = useDashboardStore((s) => s.refreshing);

  if (!session) return null;

  const primaryPage = useDashboardStore.getState().capturedPages[0];

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-of-border bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <DomainFavicon favicon={session.favicon ?? primaryPage?.favicon} domain={session.domain} />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-gray-900">Overview</h1>
            <p className="mt-1 text-sm text-of-muted">
              API usage for this domain while you browse.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-of-border bg-gray-50 px-3 py-1 text-xs text-gray-700">
                <Globe className="h-3.5 w-3.5 text-of-purple" />
                Domain: <span className="font-medium">{session.domain}</span>
              </span>
              <span className="inline-flex rounded-full border border-of-border bg-gray-50 px-3 py-1 text-xs text-gray-700">
                Tracking since: {sessionStartedLabel(session)}
              </span>
            </div>
            {session.pageTitle ? (
              <p className="mt-2 truncate text-xs text-of-muted">
                Analyzing: {session.pageTitle}
                {primaryPage?.path ? ` (${primaryPage.path})` : ''}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-of-border bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-of-purple/40 hover:text-of-purple disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-100"
          >
            Reset Data
          </button>
        </div>
      </div>
    </motion.header>
  );
}
