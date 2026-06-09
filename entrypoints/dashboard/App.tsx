import { Copy, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { OverviewPage } from '@/components/dashboard/OverviewPage';
import { PagesPage } from '@/components/dashboard/PagesPage';
import { Navbar } from '@/components/dashboard/Navbar';
import { WasteBar } from '@/components/WasteBar';
import { formatBytes } from '@/lib/analyzer';
import type { SessionDashboardSnapshot } from '@/lib/session';
import type { AnalyzedRequest, AnalyticsSummary, TabAnalyticsState } from '@/lib/types';
import { useDashboardStore } from './store';

function getTabId() {
  const fromQuery = new URLSearchParams(window.location.search).get('tabId');
  const parsed = Number(fromQuery);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-of-border bg-white p-10 text-sm text-of-muted">
      {message}
    </div>
  );
}

function RequestRow({
  request,
  selected,
  onSelect,
}: {
  request: AnalyzedRequest;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`grid w-full grid-cols-[90px_minmax(0,1fr)_110px_150px_80px] items-center gap-4 rounded-lg border px-4 py-3 text-left text-sm transition ${
        selected
          ? 'border-of-purple bg-of-purple-light/50'
          : 'border-of-border bg-white hover:border-of-purple/50'
      }`}
    >
      <span className="font-mono text-xs font-bold text-of-purple">{request.method}</span>
      <span className="truncate font-mono text-xs text-gray-900">{request.path}</span>
      <span className="whitespace-nowrap text-xs text-gray-600">
        {formatBytes(request.payloadBytes)}
      </span>
      <span>
        <span className="mb-1 flex justify-between text-[11px]">
          <span className="font-semibold text-of-waste">{request.wastePercent}% unused</span>
          <span className="text-of-muted">{request.efficiencyScore}/100</span>
        </span>
        <WasteBar percent={request.wastePercent} />
      </span>
      <span className="text-right text-xs text-gray-600">{request.status}</span>
    </button>
  );
}

export default function DashboardApp() {
  const [state, setState] = useState<TabAnalyticsState | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const tabId = useMemo(getTabId, []);

  const activeTab = useDashboardStore((s) => s.activeTab);
  const sessionSummary = useDashboardStore((s) => s.summary);
  const setRefreshing = useDashboardStore((s) => s.setRefreshing);
  const hydrateFromSessionSnapshot = useDashboardStore((s) => s.hydrateFromSessionSnapshot);
  const setTabAnalytics = useDashboardStore((s) => s.setTabAnalytics);

  const fetchInFlightRef = useRef(false);

  async function fetchSessionSnapshot(): Promise<SessionDashboardSnapshot | null> {
    if (!tabId) return null;
    const response = await browser.runtime.sendMessage({
      type: 'dashboard-get-session-snapshot',
      tabId,
    });
    return (response as SessionDashboardSnapshot | undefined) ?? null;
  }

  async function fetchAndApplySnapshot(kind: 'auto' | 'refresh'): Promise<void> {
    if (!tabId) return;
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;

    if (kind === 'refresh') setRefreshing(true);

    try {
      const snapshot = await fetchSessionSnapshot();
      if (!snapshot) return;

      hydrateFromSessionSnapshot(snapshot);

      if (snapshot.analytics && snapshot.session) {
        const response = await browser.runtime.sendMessage({
          type: 'dashboard-get-snapshot',
          tabId,
        });

        if (response?.state && response?.summary) {
          const nextState = response.state as TabAnalyticsState;
          const nextSummary = response.summary as AnalyticsSummary;
          setState(nextState);
          setSummary(nextSummary);
          setTabAnalytics(nextState.requests, nextSummary);
          setSelectedId((current) => {
            if (current && nextState.requests.some((r: AnalyzedRequest) => r.id === current)) {
              return current;
            }
            return nextState.requests[0]?.id ?? null;
          });
        } else {
          setState(null);
          setSummary(null);
          setTabAnalytics([], null);
        }
      } else {
        setState(null);
        setSummary(null);
        setTabAnalytics([], null);
        setSelectedId(null);
      }
    } finally {
      fetchInFlightRef.current = false;
      if (kind === 'refresh') setRefreshing(false);
    }
  }

  async function resetSessionData(): Promise<void> {
    const shouldReset = window.confirm(
      'Reset captured data for this domain session? This only clears data since the last reset.',
    );
    if (!shouldReset || !tabId) return;

    const response = await browser.runtime.sendMessage({
      type: 'dashboard-reset-session',
      tabId,
    });

    const snapshot = (response?.snapshot as SessionDashboardSnapshot | undefined) ?? null;
    if (snapshot) {
      hydrateFromSessionSnapshot(snapshot);
      setState(null);
      setSummary(null);
      setTabAnalytics([], null);
      setSelectedId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;
    void (async () => {
      if (!tabId) return;

      await fetchAndApplySnapshot('auto');
      if (cancelled) return;

      intervalId = window.setInterval(() => {
        void fetchAndApplySnapshot('auto');
      }, 2500);
    })();

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  const requests = state?.requests ?? [];
  const filteredRequests = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) => `${r.method} ${r.path}`.toLowerCase().includes(q));
  }, [requests, query]);

  const hasTraffic = !!sessionSummary && sessionSummary.apiCalls > 0;

  return (
    <div className="flex min-h-screen flex-col bg-of-surface text-gray-900">
      <Navbar />

      <main className="flex-1 overflow-y-auto">
        {activeTab === 'overview' ? (
          <OverviewPage
            onRefresh={() => void fetchAndApplySnapshot('refresh')}
            onReset={() => void resetSessionData()}
          />
        ) : null}

        {activeTab === 'pages' ? <PagesPage /> : null}

        {activeTab === 'requests' ? (
          <div className="mx-auto max-w-7xl space-y-4 px-6 py-6">
            {!hasTraffic ? (
              <EmptyState message="Browse this domain and trigger API calls to see captured requests here." />
            ) : (
              <>
                <div className="flex items-center gap-3 rounded-xl border border-of-border bg-white p-4 shadow-sm">
                  <Search className="h-4 w-4 text-of-muted" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search method or path"
                    className="h-9 flex-1 border-0 bg-transparent text-sm outline-none"
                  />
                </div>
                <div className="space-y-2">
                  {filteredRequests.map((request) => (
                    <RequestRow
                      key={request.id}
                      request={request}
                      selected={selectedId === request.id}
                      onSelect={() => setSelectedId(request.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : null}

        {activeTab === 'unused-fields' ? (
          <div className="mx-auto max-w-7xl px-6 py-6">
            {!hasTraffic ? (
              <EmptyState message="No unused fields detected yet for this domain." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {(summary?.biggestUnusedFields ?? []).map((field, index) => (
                  <div
                    key={`${field.path}-${index}`}
                    className="rounded-xl border border-of-border bg-white p-4 shadow-sm"
                  >
                    <div className="font-mono text-sm font-semibold text-gray-900">{field.path}</div>
                    <div className="mt-2 text-sm font-semibold text-of-waste">
                      {formatBytes(field.wastedBytes)} unused
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {activeTab === 'duplicates' ? (
          <div className="mx-auto max-w-7xl space-y-3 px-6 py-6">
            {!hasTraffic || !summary?.duplicateGroups.length ? (
              <EmptyState message="No duplicate requests detected for this domain yet." />
            ) : (
              summary.duplicateGroups.map((group) => (
                <div
                  key={group.key}
                  className="rounded-xl border border-orange-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-2 font-mono text-sm font-semibold">
                    <Copy className="h-4 w-4 text-orange-600" />
                    {group.method} {group.path}
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    Called {group.count} times, transferring {formatBytes(group.totalBytes)} total.
                  </p>
                </div>
              ))
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
