import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import logoUrl from "@/assets/logo.png";
import type { AnalyticsSummary } from "@/lib/types";
import { formatBytes } from "@/lib/analyzer";
import type { SessionDashboardSnapshot, TrackingSession } from "@/lib/session";
import { formatSessionTime } from "@/lib/session";
const DEBUG_PREFIX = "[Overfetch Debug]";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatPct(n: number) {
  return `${clamp(Math.round(n), 0, 100)}%`;
}

function WasteUsedBar({ wastePercent }: { wastePercent: number }) {
  const waste = clamp(wastePercent, 0, 100);
  const used = 100 - waste;
  return (
    <div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full bg-linear-to-r from-red-400 to-orange-500"
          style={{ width: `${waste}%` }}
        />
        <div
          className="h-full bg-linear-to-r from-green-400 to-emerald-500"
          style={{ width: `${used}%`, marginLeft: `${waste}%` }}
        />
      </div>
    </div>
  );
}

function formatFields(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSessionSnapshot(
  tabId: number,
): Promise<SessionDashboardSnapshot | null> {
  console.info(`${DEBUG_PREFIX} Popup requesting session snapshot`, { tabId });
  const response = await browser.runtime.sendMessage({
    type: "get-reading-session",
    tabId,
  });
  console.info(`${DEBUG_PREFIX} Popup received session snapshot`, {
    tabId,
    hasSession: Boolean((response as SessionDashboardSnapshot | undefined)?.session),
    endpointCount: (response as SessionDashboardSnapshot | undefined)?.endpoints?.length ?? 0,
  });
  return (response as SessionDashboardSnapshot | undefined) ?? null;
}

async function fetchSummary(tabId: number): Promise<AnalyticsSummary | null> {
  console.info(`${DEBUG_PREFIX} Popup requesting summary`, { tabId });
  const response = await browser.runtime.sendMessage({
    type: "popup-get-summary",
    tabId,
  });
  console.info(`${DEBUG_PREFIX} Popup received summary`, {
    tabId,
    totalRequests: response?.summary?.totalRequests ?? 0,
    totalPayloadBytes: response?.summary?.totalPayloadBytes ?? 0,
  });
  return response?.summary ?? null;
}

async function waitForSummary(tabId: number): Promise<AnalyticsSummary | null> {
  const maxAttempts = 40;
  const delayMs = 500;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(delayMs);
    const next = await fetchSummary(tabId);
    if (next?.totalRequests) return next;

    try {
      const tab = await browser.tabs.get(tabId);
      if (tab.status === "complete" && attempt >= 6) return next;
    } catch {
      return next;
    }
  }

  return fetchSummary(tabId);
}

function isDetachedPopup() {
  return new URLSearchParams(window.location.search).get("detached") === "1";
}

function tabIdFromUrl(): number | null {
  const id = Number(new URLSearchParams(window.location.search).get("tabId"));
  return Number.isFinite(id) && id > 0 ? id : null;
}

function getWebsiteName(session: TrackingSession | null): string {
  if (!session) return "Current website";
  const title = session.pageTitle
    ?.replace(/^\d+\.\s*/, "")
    .split(/\s[-–—|]\s/)
    .map((part) => part.trim())
    .find((part) => part.length > 0 && !/^https?:\/\//i.test(part));

  if (title && title.length <= 42) return title;

  const host = session.domain.replace(/^www\./i, "");
  const label = host.split(".")[0] ?? host;
  return label
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getDomainInitial(domain?: string): string {
  const label = domain?.replace(/^www\./i, "").charAt(0).toUpperCase();
  return label || "W";
}

export default function PopupApp() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [session, setSession] = useState<TrackingSession | null>(null);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const autoRefreshStarted = useRef(false);

  async function syncSession(tabId: number) {
    const snapshot = await fetchSessionSnapshot(tabId);
    setSession(snapshot?.session ?? null);
    setSummary(snapshot?.analytics ?? null);
  }

  async function runPageReload(tabId: number) {
    setRefreshing(true);
    setLoading(true);
    setSummary(null);
    try {
      await browser.tabs.reload(tabId);
      const next = await waitForSummary(tabId);
      setSummary(next);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const params = new URLSearchParams(window.location.search);
      const urlTabId = tabIdFromUrl();
      let tabId = urlTabId;

      if (!tabId) {
        const [t] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        tabId = t?.id ?? null;
      }

      if (!tabId) {
        setLoading(false);
        return;
      }

      setActiveTabId(tabId);
      await syncSession(tabId);
      setLoading(false);

      if (params.get("autoRefresh") === "1" && !autoRefreshStarted.current) {
        autoRefreshStarted.current = true;
        await runPageReload(tabId);
      }
    })();
  }, []);

  useEffect(() => {
    if (!activeTabId) return;
    const intervalId = window.setInterval(() => {
      void syncSession(activeTabId);
    }, 2500);
    return () => window.clearInterval(intervalId);
  }, [activeTabId]);

  async function refreshCurrentPage() {
    if (!activeTabId || refreshing) return;

    if (!isDetachedPopup()) {
      await browser.windows.create({
        url: browser.runtime.getURL(
          `/popup.html?detached=1&tabId=${activeTabId}&autoRefresh=1` as Parameters<
            typeof browser.runtime.getURL
          >[0],
        ),
        type: "popup",
        width: 420,
        height: 620,
      });
      window.close();
      return;
    }

    await runPageReload(activeTabId);
  }

  async function openDashboard() {
    if (!activeTabId) return;
    await browser.tabs.create({
      url: browser.runtime.getURL(
        `/dashboard.html?tabId=${activeTabId}` as Parameters<
          typeof browser.runtime.getURL
        >[0],
      ),
    });
    window.close();
  }

  async function resetSessionData() {
    const shouldReset = window.confirm(
      "Reset captured data for this domain session?",
    );
    if (!shouldReset || !activeTabId) return;

    const response = await browser.runtime.sendMessage({
      type: "reset-session",
      tabId: activeTabId,
    });
    const snapshot = response?.snapshot as SessionDashboardSnapshot | undefined;
    setSession(snapshot?.session ?? null);
    setSummary(snapshot?.analytics ?? null);
  }

  const usedPercent = useMemo(() => {
    if (!summary) return 0;
    return clamp(100 - summary.wastePercent, 0, 100);
  }, [summary]);
  const websiteName = useMemo(() => getWebsiteName(session), [session]);

  return (
    <div className="flex h-[600px] w-[420px] flex-col overflow-hidden bg-white text-gray-900">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-5 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl">
            <img
              src={logoUrl}
              alt="Overfetch"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">Overfetch</div>
            <div className="text-[10px] text-of-muted">
              API payload analyzer
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.close()}
          className="rounded-md p-1 text-of-muted hover:bg-gray-100"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden px-5 py-3">
        <div className="space-y-3">
          {session ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-2.5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  {session.favicon ? (
                    <img
                      src={session.favicon}
                      alt=""
                      className="h-6 w-6 object-contain"
                    />
                  ) : (
                    <span className="text-sm font-extrabold text-of-purple">
                      {getDomainInitial(session.domain)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-of-muted">
                    Analyzing
                  </div>
                  <div className="truncate text-lg font-extrabold leading-tight text-gray-950">
                    {websiteName}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-gray-600">
                    <span className="rounded-full border border-of-border bg-white px-2 py-0.5">
                      {session.domain}
                    </span>
                    <span className="rounded-full border border-of-border bg-white px-2 py-0.5">
                      Since {formatSessionTime(session.startedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 text-xs font-semibold text-of-purple">
                You&apos;re overfetching
              </div>
              <div className="text-[13px] font-bold leading-snug">
                Your UI uses less than this domain&apos;s APIs return
              </div>
              <div className="mt-0.5 text-[11px] text-gray-600">
                {summary?.wastedBytes
                  ? `${formatBytes(summary.wastedBytes)} wasted across ${summary.totalRequests} API calls.`
                  : session
                    ? "Waiting for API calls on this domain…"
                    : "Open a normal website tab to start capturing API calls."}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {session ? (
                <button
                  type="button"
                  onClick={() => void resetSessionData()}
                  className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-100"
                  aria-label="Reset data"
                  title="Reset session data"
                >
                  Reset Data
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void refreshCurrentPage()}
                disabled={!activeTabId || loading}
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
                aria-label="Refresh page"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>

          <div className="rounded-[18px] border border-gray-200 bg-white p-3 shadow-sm">
            {loading ? (
              <div className="flex min-h-[158px] flex-col items-center justify-center py-8">
                <Loader2 className="h-7 w-7 animate-spin text-of-purple" />
                <p className="mt-2 text-[11px] font-medium text-gray-500">
                  Analyzing API payloads…
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <div className="text-[11px] text-gray-600">
                      Data Received
                    </div>
                    <div className="mt-1 text-[31px] font-bold leading-none">
                      {summary ? formatBytes(summary.totalPayloadBytes) : "—"}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      {summary
                        ? `${formatFields(summary.totalFields)} fields`
                        : "—"}
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="text-[11px] text-gray-600">
                      Data Used by UI
                    </div>
                    <div className="mt-1 text-[31px] font-bold leading-none text-gray-900">
                      {summary ? formatBytes(summary.usedBytes) : "—"}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      {summary
                        ? `${formatFields(summary.usedFields)} fields`
                        : "—"}
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-1 text-center">
                      <div className="text-base font-extrabold text-red-600">
                        {summary ? formatPct(summary.wastePercent) : "—"}
                      </div>
                      <div className="text-[10px] font-semibold text-red-700">
                        Unused
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-center">
                      <div className="text-base font-extrabold text-emerald-600">
                        {summary ? formatPct(usedPercent) : "—"}
                      </div>
                      <div className="text-[10px] font-semibold text-emerald-700">
                        Used
                      </div>
                    </div>
                  </div>
                </div>

                {summary ? (
                  <div className="mt-2.5">
                    <WasteUsedBar wastePercent={summary.wastePercent} />
                  </div>
                ) : null}
              </>
            )}
          </div>

          {session ? (
            <div className="rounded-[18px] border border-violet-100 bg-linear-to-br from-violet-50 via-white to-orange-50 p-3 shadow-sm">
              <div className="mb-2">
                <div className="text-[13px] font-extrabold text-gray-950">
                  See where the data goes
                </div>
                <div className="mt-0.5 text-[11px] leading-4 text-gray-600">
                  Pages, endpoints, unused fields, and payload leaks ranked for {websiteName}.
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-of-purple px-3 py-2 text-[11px] font-bold text-white shadow-sm hover:bg-of-purple-dark"
                  onClick={openDashboard}
                >
                  <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-md bg-white/15">
                    <img
                      src={logoUrl}
                      alt=""
                      className="h-4 w-4 object-contain"
                    />
                  </span>
                  <span className="truncate">Get the full report on overfetch.io</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function RequestsTab({ summary }: { summary: AnalyticsSummary | null }) {
  const [query, setQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<
    "ALL" | "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  >("ALL");
  const [minWaste, setMinWaste] = useState(0);
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);

  const filtered = useMemo(() => {
    const list = summary?.topEndpointsByWaste ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((r) => {
      if (methodFilter !== "ALL" && r.method !== methodFilter) return false;
      if (duplicatesOnly && r.duplicateCount <= 0) return false;
      if (r.wastePercent < minWaste) return false;
      if (q) {
        const haystack = `${r.method} ${r.path}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    summary?.topEndpointsByWaste,
    query,
    methodFilter,
    minWaste,
    duplicatesOnly,
  ]);

  if (!summary?.topEndpointsByWaste?.length) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-semibold text-gray-700">
          No requests captured yet.
        </div>
        <div className="mt-1 text-[11px] text-gray-600">
          Open a page that makes API calls, then come back.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-2 text-xs font-bold text-gray-900">
          Filter requests
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search path or method…"
            className="h-8 flex-1 min-w-[140px] rounded-md border border-of-border bg-white px-2 text-[11px] outline-none focus:border-of-purple"
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
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold text-of-waste">
              Min waste
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={minWaste}
              onChange={(e) => setMinWaste(Number(e.target.value))}
              className="w-36"
              style={{ accentColor: "#ef4444" }}
            />
            <span className="whitespace-nowrap text-[12px] font-semibold text-of-waste">
              {minWaste}%
            </span>
          </div>
          <label className="flex items-center gap-2 text-[11px] font-semibold text-gray-600">
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

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold">Top Waste by Request</div>
            <div className="text-[11px] text-gray-600">
              Highest payload waste first
            </div>
          </div>
          <div className="text-[11px] font-semibold text-gray-700">
            {filtered.length} shown
          </div>
        </div>

        <div className="space-y-2">
          {filtered.map((r) => {
            const waste = clamp(r.wastePercent, 0, 100);
            const used = 100 - waste;
            return (
              <div
                key={r.id}
                className="rounded-xl border border-gray-200 bg-white p-3"
              >
                <div className="grid grid-cols-[1fr_auto] items-start gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[12px] font-semibold text-blue-600">
                      {r.method} {r.path}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[12px] text-gray-600">
                      <span className="whitespace-nowrap">
                        <span className="font-semibold text-gray-900">
                          {waste}%
                        </span>{" "}
                        unused
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-gray-600 whitespace-nowrap">
                      Size
                    </div>
                    <div className="whitespace-nowrap font-semibold text-[12px] text-gray-900">
                      {formatBytes(r.payloadBytes)}
                    </div>
                  </div>
                </div>

                <div className="mt-2">
                  <WasteUsedBar wastePercent={waste} />
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-gray-600">
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                    {waste}% unused
                  </span>
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    {used}% used
                  </span>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 text-[11px] text-gray-500">
              No requests match your filters.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
