import { motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowDownRight,
  ArrowUpRight,
  Lightbulb,
  Settings,
} from 'lucide-react';
import logoUrl from '@/assets/logo.png';
import { formatBytes } from '@/lib/analyzer';
import { formatSessionTime } from '@/lib/session';
import { useDashboardStore } from '@/entrypoints/dashboard/store';
import type { CapturedPage } from '@/entrypoints/dashboard/types';
import { Switch } from '@/components/ui/switch';
import { PageDetailView } from './page-detail/PageDetailView';
import { PageThumbnail } from './page-detail/PageThumbnail';
import { OverviewEmptyState } from './OverviewEmptyState';

function toneForWaste(percent: number): string {
  if (percent >= 50) return 'bg-red-500';
  if (percent >= 40) return 'bg-orange-500';
  return 'bg-orange-400';
}

function ringTone(score: number): string {
  if (score < 50) return '#ef4444';
  if (score <= 70) return '#f59e0b';
  return '#22c55e';
}

function EfficiencyRing({ score }: { score: number }) {
  const size = 40;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = ringTone(score);

  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#ede9fe"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.75, ease: 'easeOut' }}
        />
      </svg>
      <span className="text-sm font-medium text-gray-900">{score} /100</span>
    </div>
  );
}

function comparePercent(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  const delta = Math.round(((current - previous) / previous) * 100);
  if (delta === 0) return '0%';
  return delta > 0 ? `↑ ${delta}%` : `↓ ${Math.abs(delta)}%`;
}

function compareTone(text: string): string {
  if (text.includes('↓')) return 'text-green-600';
  if (text.includes('↑')) return 'text-red-600';
  return 'text-of-muted';
}

function efficiencyScore(page: CapturedPage): number {
  return Math.max(0, 100 - page.wastePercentage);
}

function PageRowCompare({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  const label = comparePercent(current, previous);
  if (!label) return null;
  return <p className={`mt-1 text-xs font-medium ${compareTone(label)}`}>{label}</p>;
}

export function PagesPage() {
  const session = useDashboardStore((s) => s.session);
  const summary = useDashboardStore((s) => s.summary);
  const hero = useDashboardStore((s) => s.hero);
  const metrics = useDashboardStore((s) => s.metrics);
  const capturedPages = useDashboardStore((s) => s.capturedPages);
  const compareWithPrevious = useDashboardStore((s) => s.compareWithPrevious);
  const setCompareWithPrevious = useDashboardStore((s) => s.setCompareWithPrevious);
  const autoCapture = useDashboardStore((s) => s.autoCapture);
  const setAutoCapture = useDashboardStore((s) => s.setAutoCapture);
  const pagesView = useDashboardStore((s) => s.pagesView);
  const openPageDetail = useDashboardStore((s) => s.openPageDetail);

  const hasSessionData = !!session && !!summary && !!hero;

  if (!hasSessionData) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-6">
        <OverviewEmptyState />
      </div>
    );
  }

  if (pagesView === 'detail') {
    return <PageDetailView />;
  }

  const sortedPages = [...capturedPages].sort(
    (a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt),
  );
  const avgApiCalls =
    sortedPages.length > 0
      ? Math.round(summary.apiCalls / sortedPages.length)
      : 0;
  const wasteRingOffset = 251.2 - (251.2 * summary.wastePercentage) / 100;

  return (
    <div className="flex min-h-full flex-col">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="mx-auto w-full max-w-7xl space-y-6 px-6 py-6"
      >
        <div className="grid gap-4 lg:grid-cols-[1.25fr_1.85fr]">
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            whileHover={{ y: -2 }}
            className="flex items-center justify-between gap-5 rounded-xl border border-of-purple/25 bg-linear-to-r from-of-purple-light/70 via-white to-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl">
                <img src={logoUrl} alt="Overfetch" className="h-full w-full object-contain" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">You&apos;re overfetching</h2>
                <p className="mt-0.5 text-sm text-of-muted">Your UI uses less data than it requests.</p>
                <p className="mt-1.5 text-sm text-gray-700">
                  <span className="font-semibold text-red-600">
                    {formatBytes(summary.wastedBytes)} wasted
                  </span>{' '}
                  ({summary.wastePercentage}% unused) across {summary.apiCalls} API calls on{' '}
                  {summary.domain}.
                </p>
              </div>
            </div>
            <div className="relative h-24 w-24 shrink-0">
              <svg width="96" height="96" className="-rotate-90">
                <circle cx="48" cy="48" r="40" stroke="#fde2e8" strokeWidth="8" fill="none" />
                <motion.circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#f43f5e"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={251.2}
                  initial={{ strokeDashoffset: 251.2 }}
                  animate={{ strokeDashoffset: wasteRingOffset }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-semibold text-gray-900">
                  {summary.wastePercentage}%
                </span>
                <span className="text-[11px] text-of-muted">Waste</span>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.03 }}
            whileHover={{ y: -2 }}
            className="grid grid-cols-2 rounded-xl border border-of-border bg-white p-3 shadow-sm md:grid-cols-5"
          >
            {metrics.map((metric, index) => {
              const Icon = metric.icon;
              return (
                <div
                  key={metric.id}
                  className={`px-3 py-2 ${index !== metrics.length - 1 ? 'md:border-r md:border-of-border/70' : ''}`}
                >
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-of-muted">
                    <Icon className="h-3.5 w-3.5 text-of-purple" />
                    {metric.title}
                  </div>
                  <div className="text-2xl font-semibold leading-none text-gray-900">
                    {metric.value}
                  </div>
                  <p className="mt-1 text-xs text-of-muted">
                    {metric.id === 'calls' && avgApiCalls > 0
                      ? `${avgApiCalls} avg per page`
                      : metric.helper}
                  </p>
                </div>
              );
            })}
          </motion.section>
        </div>

        <section className="overflow-hidden rounded-xl border border-of-border bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-of-border/80 px-5 py-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Pages Visited</h3>
              <p className="mt-1 text-sm text-of-muted">
                API usage and overfetching for each page captured in this session.
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium text-gray-700">Compare with previous page</span>
              <Switch
                checked={compareWithPrevious}
                onCheckedChange={setCompareWithPrevious}
                aria-label="Compare with previous page"
              />
            </div>
          </div>

          {sortedPages.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-of-muted">
              No pages captured yet. Browse this domain to capture API calls.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1280px] w-full">
                <thead>
                  <tr className="border-b border-of-border/80 text-left text-xs font-medium uppercase tracking-wide text-of-muted">
                    <th className="px-5 py-3">Page</th>
                    <th className="px-4 py-3">
                      <span className="inline-flex items-center gap-1">
                        Time Visited
                        <ArrowDown className="h-3.5 w-3.5" />
                      </span>
                    </th>
                    <th className="px-4 py-3">API Calls</th>
                    <th className="px-4 py-3">Payload</th>
                    <th className="px-4 py-3">Used by UI</th>
                    <th className="px-4 py-3">Wasted</th>
                    <th className="px-4 py-3">Waste %</th>
                    <th className="px-4 py-3">Efficiency Score</th>
                    <th className="px-4 py-3">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPages.map((page, index) => {
                    const previous = sortedPages[index + 1];
                    const score = efficiencyScore(page);
                    const prevScore = previous ? efficiencyScore(previous) : null;
                    const scoreDelta =
                      prevScore !== null ? score - prevScore : null;

                    return (
                      <motion.tr
                        key={page.id}
                        onClick={() => openPageDetail(page.id)}
                        whileHover={{ backgroundColor: '#faf5ff' }}
                        className="h-24 cursor-pointer border-b border-of-border/70 bg-white transition hover:bg-of-purple-light/30"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <PageThumbnail title={page.title} imageUrl={page.thumbnail} index={index} />
                            <div>
                              <p className="font-medium text-gray-900">{page.title}</p>
                              <p className="mt-1 font-mono text-xs text-of-muted">{page.path}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-gray-900">
                            {formatSessionTime(page.capturedAt)}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-semibold text-gray-900">{page.apiCallCount}</p>
                          {compareWithPrevious && previous ? (
                            <PageRowCompare
                              current={page.apiCallCount}
                              previous={previous.apiCallCount}
                            />
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-semibold text-gray-900">
                            {formatBytes(page.totalPayloadBytes)}
                          </p>
                          {compareWithPrevious && previous ? (
                            <PageRowCompare
                              current={page.totalPayloadBytes}
                              previous={previous.totalPayloadBytes}
                            />
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-semibold text-gray-900">
                            {formatBytes(page.usedBytes)}
                          </p>
                          {compareWithPrevious && previous ? (
                            <PageRowCompare
                              current={page.usedBytes}
                              previous={previous.usedBytes}
                            />
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-semibold text-gray-900">
                            {formatBytes(page.wastedBytes)}
                          </p>
                          {compareWithPrevious && previous ? (
                            <PageRowCompare
                              current={page.wastedBytes}
                              previous={previous.wastedBytes}
                            />
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-semibold text-gray-900">
                            {page.wastePercentage}%
                          </p>
                          <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${page.wastePercentage}%` }}
                              transition={{ duration: 0.6, delay: index * 0.04 }}
                              className={`h-full rounded-full ${toneForWaste(page.wastePercentage)}`}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <EfficiencyRing score={score} />
                        </td>
                        <td className="px-4 py-4">
                          {compareWithPrevious && scoreDelta !== null ? (
                            <div>
                              <div
                                className={`inline-flex items-center gap-1 text-sm font-semibold ${
                                  scoreDelta >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                {scoreDelta >= 0 ? (
                                  <ArrowUpRight className="h-4 w-4" />
                                ) : (
                                  <ArrowDownRight className="h-4 w-4" />
                                )}
                                {Math.abs(scoreDelta)} pts
                              </div>
                              <p className="mt-1 text-xs text-of-muted">
                                ({scoreDelta >= 0 ? 'better' : 'worse'})
                              </p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-sm font-semibold text-of-muted">—</p>
                              <p className="mt-1 text-xs text-of-muted">(first page)</p>
                            </div>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </motion.div>

      <footer className="sticky bottom-0 mt-auto border-t border-of-purple/20 bg-of-purple-light/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-3.5 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2 text-gray-700">
            <Lightbulb className="h-4 w-4 text-of-purple" />
            Tip: Click a page row to open detailed payload analysis.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-of-muted">Auto-capture</span>
            <button
              type="button"
              onClick={() => setAutoCapture(!autoCapture)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                autoCapture ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {autoCapture ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              className="rounded-lg border border-of-border p-1.5 text-of-muted transition hover:bg-white hover:text-gray-900"
              aria-label="Auto-capture settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
