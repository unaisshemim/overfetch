import {
  Activity,
  AlertTriangle,
  BarChart3,
  Copy,
  Database,
  Gauge,
  Radio,
  RefreshCw,
  Settings,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import logoUrl from '@/assets/logo.png';
import { FieldTree } from '@/components/FieldTree';
import { MetricCard } from '@/components/MetricCard';
import { PayloadDonut } from '@/components/PayloadDonut';
import { WasteBar } from '@/components/WasteBar';
import { buildFieldTree, formatBytes } from '@/lib/analyzer';
import type { AnalyzedRequest, EndpointTab, PanelTab } from '@/lib/types';
import { connectPanelBridge } from './bridge';
import { getSelectedRequest, usePanelStore } from './store';

const panelTabs: { id: PanelTab; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'requests', label: 'Requests', icon: Activity },
  { id: 'endpoints', label: 'Endpoints', icon: Database },
  { id: 'duplicates', label: 'Duplicates', icon: Copy },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const endpointTabs: { id: EndpointTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'payload', label: 'Payload' },
  { id: 'used', label: 'Used Fields' },
  { id: 'unused', label: 'Unused Fields' },
  { id: 'optimization', label: 'Optimization' },
];

function StatusBadge({ status }: { status: number }) {
  const ok = status >= 200 && status < 300;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        ok ? 'bg-of-used-light text-of-used' : 'bg-of-waste-light text-of-waste'
      }`}
    >
      {status}
    </span>
  );
}

function EndpointRow({
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
      className={`w-full rounded-md border px-2.5 py-2 text-left transition ${
        selected
          ? 'border-of-purple bg-of-purple-light/40'
          : 'border-of-border bg-white hover:border-of-purple/40'
      }`}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-700">
          {request.method}
        </span>
        <span className="truncate font-mono text-[11px] text-gray-800">
          {request.path}
        </span>
      </div>
      <div className="mb-1 flex justify-between text-[10px] text-of-muted">
        <span>{formatBytes(request.payloadBytes)}</span>
        <span className="font-medium text-of-waste">{request.wastePercent}% waste</span>
      </div>
      <WasteBar percent={request.wastePercent} />
    </button>
  );
}

function OverviewTab() {
  const summary = usePanelStore((s) => s.summary);
  const state = usePanelStore((s) => s.state);
  const selectedId = usePanelStore((s) => s.selectedRequestId);
  const activeEndpointTab = usePanelStore((s) => s.activeEndpointTab);
  const setActiveEndpointTab = usePanelStore((s) => s.setActiveEndpointTab);
  const selectRequest = usePanelStore((s) => s.selectRequest);
  const setActivePanelTab = usePanelStore((s) => s.setActivePanelTab);

  const selected = getSelectedRequest(state, selectedId);

  if (!summary) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-of-muted">
        Waiting for API traffic on the inspected page…
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <div className="grid grid-cols-5 gap-2">
        <MetricCard
          label="Total Requests"
          value={String(summary.totalRequests)}
          icon={Activity}
          accent="purple"
        />
        <MetricCard
          label="Total Payload"
          value={formatBytes(summary.totalPayloadBytes)}
          icon={Database}
        />
        <MetricCard
          label="Data Used by UI"
          value={formatBytes(summary.usedBytes)}
          icon={Zap}
          accent="used"
        />
        <MetricCard
          label="Payload Waste"
          value={formatBytes(summary.wastedBytes)}
          sub={`${summary.wastePercent}% of total`}
          icon={AlertTriangle}
          accent="waste"
        />
        <MetricCard
          label="Efficiency Score"
          value={`${summary.efficiencyScore}`}
          sub="out of 100"
          icon={Gauge}
          accent="purple"
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr] gap-3">
        <div className="flex min-h-0 flex-col rounded-lg border border-of-border bg-white shadow-sm">
          <div className="border-b border-of-border px-3 py-2">
            <h3 className="text-xs font-semibold text-gray-900">
              Top Endpoints by Waste
            </h3>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
            {summary.topEndpointsByWaste.length === 0 ? (
              <p className="p-2 text-xs text-of-muted">No endpoints captured yet.</p>
            ) : (
              summary.topEndpointsByWaste.map((req) => (
                <EndpointRow
                  key={req.id}
                  request={req}
                  selected={selected?.id === req.id}
                  onSelect={() => selectRequest(req.id)}
                />
              ))
            )}
          </div>
          <div className="border-t border-of-border p-2">
            <button
              type="button"
              onClick={() => setActivePanelTab('endpoints')}
              className="w-full rounded-md border border-of-border py-1.5 text-xs font-medium text-of-purple hover:bg-of-purple-light"
            >
              View All Endpoints
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-lg border border-of-border bg-white shadow-sm">
          {selected ? (
            <>
              <div className="border-b border-of-border px-3 py-2.5">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-of-purple-light px-1.5 py-0.5 font-mono text-[10px] font-bold text-of-purple-dark">
                    {selected.method}
                  </span>
                  <span className="font-mono text-xs text-gray-900">{selected.path}</span>
                  <StatusBadge status={selected.status} />
                </div>
                <div className="flex flex-wrap gap-3 text-[10px] text-of-muted">
                  <span>{new Date(selected.timestamp).toLocaleTimeString()}</span>
                  <span>{selected.responseTimeMs} ms</span>
                  <span>{formatBytes(selected.payloadBytes)}</span>
                  {selected.duplicateCount > 0 ? (
                    <span className="text-orange-600">
                      {selected.duplicateCount + 1} duplicate calls
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex gap-1 border-b border-of-border px-2 pt-1">
                {endpointTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveEndpointTab(tab.id)}
                    className={`rounded-t px-2.5 py-1.5 text-[11px] font-medium ${
                      activeEndpointTab === tab.id
                        ? 'border border-b-white border-of-border bg-white text-of-purple'
                        : 'text-of-muted hover:text-gray-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <EndpointDetailContent request={selected} tab={activeEndpointTab} />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-xs text-of-muted">
              Select an endpoint to inspect payload usage
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EndpointDetailContent({
  request,
  tab,
}: {
  request: AnalyzedRequest;
  tab: EndpointTab;
}) {
  const setActiveEndpointTab = usePanelStore((s) => s.setActiveEndpointTab);
  const usedTree = buildFieldTree(request.usedPaths);
  const unusedTree = buildFieldTree(request.unusedPaths);
  const usagePercent = 100 - request.wastePercent;

  if (tab === 'overview') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-of-border p-3">
          <h4 className="mb-2 text-xs font-semibold text-gray-900">Payload Usage</h4>
          <PayloadDonut usedBytes={request.usedBytes} wastedBytes={request.wastedBytes} />
          <div className="mt-2 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-of-used">Used</span>
              <span>{formatBytes(request.usedBytes)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-of-waste">Unused</span>
              <span>{formatBytes(request.wastedBytes)}</span>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-of-border p-3">
          <h4 className="mb-2 text-xs font-semibold text-gray-900">Unused Fields</h4>
          <FieldTree tree={unusedTree} variant="unused" />
        </div>
        <div className="col-span-2 rounded-lg border border-of-purple/20 bg-of-purple-light/30 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-of-purple" />
            <h4 className="text-xs font-semibold text-of-purple-dark">AI Suggestion</h4>
          </div>
          <p className="text-xs leading-relaxed text-gray-700">
            You&apos;re only using {usagePercent}% of the data returned by this API.
            Consider optimizing the response to reduce payload size.
          </p>
          <button
            type="button"
            onClick={() => setActiveEndpointTab('optimization')}
            className="mt-3 rounded-md bg-of-purple px-3 py-1.5 text-xs font-medium text-white hover:bg-of-purple-dark"
          >
            View Optimization
          </button>
        </div>
      </div>
    );
  }

  if (tab === 'payload') {
    return (
      <pre className="max-h-64 overflow-auto rounded-md border border-of-border bg-of-surface p-2 font-mono text-[10px] text-gray-700">
        {JSON.stringify(request.shape, null, 2)}
      </pre>
    );
  }

  if (tab === 'used') {
    return <FieldTree tree={usedTree} variant="used" />;
  }

  if (tab === 'unused') {
    return <FieldTree tree={unusedTree} variant="unused" />;
  }

  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-lg border border-of-border p-3">
        <h4 className="mb-2 font-semibold text-gray-900">Optimization Opportunities</h4>
        <ul className="list-disc space-y-1.5 pl-4 text-gray-700">
          <li>
            Remove {request.unusedPaths.length} unused field
            {request.unusedPaths.length === 1 ? '' : 's'} (~
            {formatBytes(request.wastedBytes)} savings)
          </li>
          <li>
            Efficiency score is {request.efficiencyScore}/100 — aim for field-level
            GraphQL or sparse fieldsets
          </li>
          {request.duplicateCount > 0 ? (
            <li>
              This endpoint was called {request.duplicateCount + 1} times — consider
              caching or deduplication
            </li>
          ) : null}
        </ul>
      </div>
      <button
        type="button"
        className="rounded-md border border-of-border px-3 py-1.5 text-xs font-medium hover:bg-of-surface"
      >
        View Optimization
      </button>
    </div>
  );
}

function RequestsTab() {
  const state = usePanelStore((s) => s.state);
  const selectedId = usePanelStore((s) => s.selectedRequestId);
  const selectRequest = usePanelStore((s) => s.selectRequest);
  const setActivePanelTab = usePanelStore((s) => s.setActivePanelTab);

  const [query, setQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<
    'ALL' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  >('ALL');
  const [statusGroup, setStatusGroup] = useState<
    'ALL' | '2xx' | '3xx' | '4xx' | '5xx'
  >('ALL');
  const [minWaste, setMinWaste] = useState(0);
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);

  const filteredRequests = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (state?.requests ?? []).filter((r) => {
      if (methodFilter !== 'ALL' && r.method !== methodFilter) return false;
      if (duplicatesOnly && r.duplicateCount <= 0) return false;
      if (r.wastePercent < minWaste) return false;

      if (statusGroup !== 'ALL') {
        const s = r.status;
        const group =
          s >= 200 && s < 300
            ? '2xx'
            : s >= 300 && s < 400
              ? '3xx'
              : s >= 400 && s < 500
                ? '4xx'
                : s >= 500 && s < 600
                  ? '5xx'
                  : '';
        if (group !== statusGroup) return false;
      }

      if (q) {
        const haystack = `${r.method} ${r.path}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [state?.requests, query, methodFilter, statusGroup, minWaste, duplicatesOnly]);

  if (!state?.requests.length) {
    return <EmptyState message="No requests captured yet." />;
  }

  return (
    <div className="overflow-y-auto p-3">
      <div className="mb-3 rounded-lg border border-of-border bg-white p-3 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search path or method…"
            className="h-8 flex-1 min-w-[160px] rounded-md border border-of-border bg-white px-2 text-[11px] outline-none focus:border-of-purple"
          />
          <select
            value={methodFilter}
            onChange={(e) =>
              setMethodFilter(e.target.value as typeof methodFilter)
            }
            className="h-8 min-w-[110px] rounded-md border border-of-border bg-white px-2 text-[11px] outline-none focus:border-of-purple"
          >
            <option value="ALL">All methods</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="DELETE">DELETE</option>
          </select>
          <select
            value={statusGroup}
            onChange={(e) =>
              setStatusGroup(e.target.value as typeof statusGroup)
            }
            className="h-8 min-w-[90px] rounded-md border border-of-border bg-white px-2 text-[11px] outline-none focus:border-of-purple"
          >
            <option value="ALL">All status</option>
            <option value="2xx">2xx</option>
            <option value="3xx">3xx</option>
            <option value="4xx">4xx</option>
            <option value="5xx">5xx</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-of-muted">
              Min waste
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={minWaste}
              onChange={(e) => setMinWaste(Number(e.target.value))}
              className="w-40"
              style={{ accentColor: '#ef4444' }}
            />
            <span className="text-[11px] font-semibold text-of-waste">
              {minWaste}%
            </span>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-of-muted">
            <input
              type="checkbox"
              checked={duplicatesOnly}
              onChange={(e) => setDuplicatesOnly(e.target.checked)}
              className="h-4 w-4 accent-of-purple"
            />
            Duplicates only
          </label>
        </div>
      </div>

      <table className="w-full text-left text-[11px]">
        <thead>
          <tr className="border-b border-of-border text-of-muted">
            <th className="py-2 pr-2">Method</th>
            <th className="py-2 pr-2">Path</th>
            <th className="py-2 pr-2">Status</th>
            <th className="py-2 pr-2">Size</th>
            <th className="py-2 pr-2">Waste</th>
            <th className="py-2">Score</th>
          </tr>
        </thead>
        <tbody>
          {filteredRequests.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-6 text-center text-xs text-of-muted">
                No requests match your filters.
              </td>
            </tr>
          ) : (
            filteredRequests.map((req) => (
              <tr
                key={req.id}
                onClick={() => {
                  selectRequest(req.id);
                  setActivePanelTab('overview');
                }}
                className={`cursor-pointer border-b border-of-border/60 hover:bg-of-surface ${
                  selectedId === req.id ? 'bg-of-purple-light/30' : ''
                }`}
              >
                <td className="py-2 pr-2 font-mono font-semibold">{req.method}</td>
                <td className="max-w-[200px] truncate py-2 pr-2 font-mono">{req.path}</td>
                <td className="py-2 pr-2">{req.status}</td>
                <td className="py-2 pr-2 whitespace-nowrap">{formatBytes(req.payloadBytes)}</td>
                <td className="py-2 pr-2">
                  <div className="mb-1 flex items-center justify-between text-[10px] text-of-waste">
                    <span className="font-semibold whitespace-nowrap">
                      {req.wastePercent}%
                    </span>
                    <span className="whitespace-nowrap">unused</span>
                  </div>
                  <WasteBar percent={req.wastePercent} />
                </td>
                <td className="py-2">{req.efficiencyScore}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function EndpointsTab() {
  const state = usePanelStore((s) => s.state);
  const selectedId = usePanelStore((s) => s.selectedRequestId);
  const selectRequest = usePanelStore((s) => s.selectRequest);
  const setActivePanelTab = usePanelStore((s) => s.setActivePanelTab);

  if (!state?.requests.length) {
    return <EmptyState message="No endpoints yet." />;
  }

  return (
    <div className="grid gap-2 p-3 sm:grid-cols-2">
      {state.requests.map((req) => (
        <EndpointRow
          key={req.id}
          request={req}
          selected={selectedId === req.id}
          onSelect={() => {
            selectRequest(req.id);
            setActivePanelTab('overview');
          }}
        />
      ))}
    </div>
  );
}

function DuplicatesTab() {
  const summary = usePanelStore((s) => s.summary);

  if (!summary?.duplicateGroups.length) {
    return <EmptyState message="No duplicate requests detected." />;
  }

  return (
    <div className="space-y-2 p-3">
      {summary.duplicateGroups.map((group) => (
        <div
          key={group.key}
          className="rounded-lg border border-orange-200 bg-orange-50/50 p-3"
        >
          <div className="mb-1 flex items-center gap-2">
            <Copy className="h-3.5 w-3.5 text-orange-600" />
            <span className="font-mono text-xs font-semibold">
              {group.method} {group.path}
            </span>
          </div>
          <p className="text-[11px] text-gray-700">
            Called <strong>{group.count}</strong> times ·{' '}
            {formatBytes(group.totalBytes)} total transferred
          </p>
        </div>
      ))}
    </div>
  );
}

function SettingsTab() {
  const autoRefresh = usePanelStore((s) => s.autoRefresh);
  const setAutoRefresh = usePanelStore((s) => s.setAutoRefresh);
  const connected = usePanelStore((s) => s.connected);
  const tabId = usePanelStore((s) => s.tabId);

  return (
    <div className="space-y-4 p-4 text-xs">
      <label className="flex items-center justify-between rounded-lg border border-of-border bg-white p-3">
        <span className="font-medium text-gray-800">Auto-refresh panel</span>
        <input
          type="checkbox"
          checked={autoRefresh}
          onChange={(e) => setAutoRefresh(e.target.checked)}
          className="h-4 w-4 accent-of-purple"
        />
      </label>
      <div className="rounded-lg border border-of-border bg-of-surface p-3 text-of-muted">
        <p>Inspected tab ID: {tabId ?? '—'}</p>
        <p>Bridge: {connected ? 'Connected' : 'Disconnected'}</p>
      </div>
      <p className="text-of-muted">
        Instrumentation runs in the page main world and reports field access via
        postMessage → content script → background worker.
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-sm text-of-muted">
      {message}
    </div>
  );
}

export default function App() {
  const activePanelTab = usePanelStore((s) => s.activePanelTab);
  const setActivePanelTab = usePanelStore((s) => s.setActivePanelTab);
  const autoRefresh = usePanelStore((s) => s.autoRefresh);
  const setAutoRefresh = usePanelStore((s) => s.setAutoRefresh);
  const connected = usePanelStore((s) => s.connected);

  useEffect(() => connectPanelBridge(), []);

  return (
    <div className="flex h-screen flex-col bg-of-surface text-gray-900">
      <header className="flex items-center justify-between border-b border-of-border bg-white px-3 py-2 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg">
            <img src={logoUrl} alt="Overfetch" className="h-full w-full object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">
              Overfetch – API Analyzer
            </h1>
            <p className="text-[10px] text-of-muted">Runtime payload usage</p>
          </div>
        </div>
        <nav className="flex items-center gap-0.5">
          {panelTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActivePanelTab(tab.id)}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium ${
                  activePanelTab === tab.id
                    ? 'bg-of-purple text-white'
                    : 'text-of-muted hover:bg-gray-100'
                }`}
              >
                <Icon className="h-3 w-3" />
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div
          className={`flex items-center gap-1 text-[10px] ${
            connected ? 'text-of-used' : 'text-of-muted'
          }`}
        >
          <Radio className="h-3 w-3" />
          {connected ? 'Live' : 'Offline'}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activePanelTab === 'overview' && <OverviewTab />}
        {activePanelTab === 'requests' && <RequestsTab />}
        {activePanelTab === 'endpoints' && <EndpointsTab />}
        {activePanelTab === 'duplicates' && <DuplicatesTab />}
        {activePanelTab === 'settings' && <SettingsTab />}
      </main>

      <footer className="flex items-center justify-between border-t border-of-border bg-white px-3 py-1.5 text-[11px]">
        <label className="flex cursor-pointer items-center gap-2 text-of-muted">
          <RefreshCw className="h-3 w-3" />
          <span>Auto-refresh</span>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="h-3.5 w-3.5 accent-of-purple"
          />
        </label>
        <div className="flex gap-3">
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="text-of-purple hover:underline"
          >
            Learn more
          </a>
          <a
            href="mailto:feedback@overfetch.dev"
            className="text-of-muted hover:text-gray-800"
          >
            Send Feedback
          </a>
        </div>
      </footer>
    </div>
  );
}
