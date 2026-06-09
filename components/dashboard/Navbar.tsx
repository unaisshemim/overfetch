import { motion } from 'framer-motion';
import { ExternalLink, MoreVertical } from 'lucide-react';
import logoUrl from '@/assets/logo.png';
import { useDashboardStore } from '@/entrypoints/dashboard/store';
import type { DashboardNavTab } from '@/entrypoints/dashboard/types';

const navTabs: Array<{ id: DashboardNavTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'pages', label: 'Pages' },
  { id: 'requests', label: 'Requests' },
  { id: 'unused-fields', label: 'Unused Fields' },
  { id: 'duplicates', label: 'Duplicates' },
];

export function Navbar() {
  const activeTab = useDashboardStore((s) => s.activeTab);
  const setActiveTab = useDashboardStore((s) => s.setActiveTab);

  return (
    <header className="sticky top-0 z-50 border-b border-of-border bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl">
            <img src={logoUrl} alt="Overfetch" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-gray-900">
              Overfetch Dashboard
            </h1>
            <p className="truncate text-xs text-of-muted">
              API usage overview for your app at overfetch.site
            </p>
          </div>
        </div>

        <nav className="hidden items-center gap-1 lg:flex">
          {navTabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'text-of-purple'
                    : 'text-of-muted hover:text-gray-900'
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="nav-tab-bg"
                    className="absolute inset-0 rounded-lg bg-of-purple-light/80"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                ) : null}
                <span className="relative">{tab.label}</span>
                {active ? (
                  <motion.span
                    layoutId="nav-tab-underline"
                    className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-of-purple"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href="https://overfetch.site"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-2 rounded-lg border border-of-purple/30 bg-of-purple-light/70 px-3.5 py-2 text-sm font-semibold text-of-purple shadow-sm transition hover:border-of-purple/50 hover:bg-of-purple-light sm:inline-flex"
          >
            overfetch.site
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            className="rounded-lg border border-of-border p-2 text-of-muted transition hover:bg-gray-50 hover:text-gray-900"
            aria-label="More options"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6 pb-2 lg:hidden">
        <a
          href="https://overfetch.site"
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-of-purple-light px-3 py-1.5 text-xs font-semibold text-of-purple sm:hidden"
        >
          overfetch.site
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        {navTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
              activeTab === tab.id
                ? 'bg-of-purple-light text-of-purple'
                : 'text-of-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
