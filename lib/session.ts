import {
  analyzeRequest,
  buildDedupedSummary,
  formatBytes,
  getRequestDeduplicationKey,
  getUrlPath,
  estimatePathBytes,
  collectPathsFromShape,
} from '@/lib/analyzer';
import type {
  AnalyzedRequest,
  AnalyticsSummary,
  DuplicateGroup,
  FieldShape,
  RequestCapturedPayload,
} from '@/lib/types';

export interface TrackingSession {
  id: string;
  tabId: number;
  domain: string;
  startedAt: string;
  favicon?: string;
  pageTitle?: string;
  pageUrl?: string;
}

export interface CapturedPage {
  id: string;
  sessionId: string;
  domain: string;
  title: string;
  url: string;
  path: string;
  thumbnail?: string;
  favicon?: string;
  capturedAt: string;
  apiCallCount: number;
  totalPayloadBytes: number;
  usedBytes: number;
  wastedBytes: number;
  wastePercentage: number;
}

export interface CapturedEndpoint {
  id: string;
  sessionId: string;
  domain: string;
  method: string;
  url: string;
  path: string;
  pagePath: string;
  status: number;
  payloadBytes: number;
  usedBytes: number;
  wastedBytes: number;
  wastePercentage: number;
}

export interface UnusedField {
  id: string;
  sessionId: string;
  domain: string;
  path: string;
  type: 'string' | 'number' | 'object' | 'array' | 'boolean';
  wastedBytes: number;
  endpointPath: string;
  pagePath: string;
}

export interface DomainSessionSummary {
  sessionId: string;
  domain: string;
  startedAt: string;
  pagesVisited: number;
  apiCalls: number;
  totalPayloadBytes: number;
  usedBytes: number;
  wastedBytes: number;
  wastePercentage: number;
  efficiencyScore: number;
  usedFields: number;
}

export interface SessionDiagnosis {
  topWasteEndpoint: string | null;
  topWasteEndpointUnusedLabel: string | null;
  largestUnusedField: string | null;
  fullyUnusedEndpointCount: number;
}

export interface SessionDashboardSnapshot {
  session: TrackingSession | null;
  summary: DomainSessionSummary | null;
  analytics: AnalyticsSummary | null;
  pages: CapturedPage[];
  endpoints: CapturedEndpoint[];
  unusedFields: UnusedField[];
  diagnosis: SessionDiagnosis;
}

export interface RawCaptureEntry {
  payload: RequestCapturedPayload;
  usedPaths: Set<string>;
  pageUrl: string;
  pagePath: string;
  pageTitle: string;
  favicon?: string;
}

export function getDomainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function getPathFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return '/';
  }
}

function normalizeHostname(hostname: string): string {
  const normalized = hostname.replace(/^www\./i, '').toLowerCase();
  if (normalized === '127.0.0.1' || normalized === '::1') {
    return 'localhost';
  }
  return normalized;
}

export function requestMatchesSessionDomain(
  requestUrl: string,
  sessionDomain: string,
): boolean {
  const domain = getDomainFromUrl(requestUrl);
  if (!domain) return false;
  const requestHost = normalizeHostname(domain);
  const sessionHost = normalizeHostname(sessionDomain);
  return (
    requestHost === sessionHost || requestHost.endsWith(`.${sessionHost}`)
  );
}

export function captureMatchesSession(
  requestUrl: string,
  pageUrl: string,
  sessionDomain: string,
): boolean {
  if (getDomainFromUrl(requestUrl)) {
    return requestMatchesSessionDomain(requestUrl, sessionDomain);
  }
  const pageDomain = getDomainFromUrl(pageUrl);
  if (!pageDomain) return false;
  return requestMatchesSessionDomain(`https://${pageDomain}/`, sessionDomain);
}

export function filterEntriesForSession(
  entries: RawCaptureEntry[],
  session: TrackingSession,
): RawCaptureEntry[] {
  return entries.filter((entry) => {
    if (!requestMatchesSessionDomain(entry.payload.url, session.domain)) {
      return false;
    }
    return true;
  });
}

function inferFieldType(shape: FieldShape): UnusedField['type'] {
  if (shape.type === 'array') return 'array';
  if (shape.type === 'object') return 'object';
  if (shape.primitive === 'number') return 'number';
  if (shape.primitive === 'boolean') return 'boolean';
  return 'string';
}

function rebuildDedupedRequests(
  entries: RawCaptureEntry[],
): { dedupedRequests: AnalyzedRequest[]; rawRequestCount: number; duplicateGroups: DuplicateGroup[] } {
  const groups = new Map<
    string,
    {
      representative: RequestCapturedPayload;
      usedPathsUnion: Set<string>;
      requestIds: string[];
      totalBytes: number;
      pagePath: string;
    }
  >();

  for (const entry of entries) {
    const payload = entry.payload;
    const key = getRequestDeduplicationKey(
      payload.method,
      payload.url,
      payload.status,
      payload.shape,
    );

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        representative: payload,
        usedPathsUnion: new Set(entry.usedPaths),
        requestIds: [payload.id],
        totalBytes: payload.payloadBytes,
        pagePath: entry.pagePath,
      });
    } else {
      if (payload.timestamp > existing.representative.timestamp) {
        existing.representative = payload;
      }
      for (const p of entry.usedPaths) existing.usedPathsUnion.add(p);
      existing.requestIds.push(payload.id);
      existing.totalBytes += payload.payloadBytes;
    }
  }

  const dedupedRequests: AnalyzedRequest[] = [];
  const duplicateGroups: DuplicateGroup[] = [];

  for (const [key, group] of groups) {
    const representative = group.representative;
    const duplicateCount = Math.max(0, group.requestIds.length - 1);
    dedupedRequests.push(
      analyzeRequest(representative, [...group.usedPathsUnion], duplicateCount),
    );

    if (group.requestIds.length > 1) {
      duplicateGroups.push({
        key,
        method: representative.method.toUpperCase(),
        path: getUrlPath(representative.url),
        count: group.requestIds.length,
        totalBytes: group.totalBytes,
        requestIds: group.requestIds,
      });
    }
  }

  dedupedRequests.sort((a, b) => b.timestamp - a.timestamp);
  return { dedupedRequests, rawRequestCount: entries.length, duplicateGroups };
}

function buildPages(
  session: TrackingSession,
  entries: RawCaptureEntry[],
  dedupedRequests: AnalyzedRequest[],
): CapturedPage[] {
  const pageMap = new Map<
    string,
    {
      title: string;
      url: string;
      favicon?: string;
      capturedAt: string;
      requestIds: Set<string>;
      totalPayloadBytes: number;
      usedBytes: number;
      wastedBytes: number;
    }
  >();

  for (const entry of entries) {
    const path = entry.pagePath || getPathFromUrl(entry.pageUrl);
    const existing = pageMap.get(path);
    if (!existing) {
      pageMap.set(path, {
        title: entry.pageTitle || path,
        url: entry.pageUrl,
        favicon: entry.favicon,
        capturedAt: new Date(entry.payload.timestamp).toISOString(),
        requestIds: new Set([entry.payload.id]),
        totalPayloadBytes: entry.payload.payloadBytes,
        usedBytes: 0,
        wastedBytes: 0,
      });
    } else {
      existing.requestIds.add(entry.payload.id);
      existing.totalPayloadBytes += entry.payload.payloadBytes;
      if (entry.payload.timestamp < Date.parse(existing.capturedAt)) {
        existing.capturedAt = new Date(entry.payload.timestamp).toISOString();
      }
    }
  }

  for (const request of dedupedRequests) {
    const matchingEntry = entries.find((e) => e.payload.id === request.id);
    const path = matchingEntry?.pagePath ?? getUrlPath(request.url);
    const page = pageMap.get(path);
    if (!page) continue;
    page.usedBytes += request.usedBytes;
    page.wastedBytes += request.wastedBytes;
  }

  return [...pageMap.entries()].map(([path, data]) => {
    const wastePercentage =
      data.totalPayloadBytes > 0
        ? Math.round((data.wastedBytes / data.totalPayloadBytes) * 100)
        : 0;
    return {
      id: `${session.id}:${path}`,
      sessionId: session.id,
      domain: session.domain,
      title: data.title,
      url: data.url,
      path,
      favicon: data.favicon ?? session.favicon,
      capturedAt: data.capturedAt,
      apiCallCount: data.requestIds.size,
      totalPayloadBytes: data.totalPayloadBytes,
      usedBytes: data.usedBytes,
      wastedBytes: data.wastedBytes,
      wastePercentage,
    };
  });
}

function buildEndpoints(
  session: TrackingSession,
  entries: RawCaptureEntry[],
  dedupedRequests: AnalyzedRequest[],
): CapturedEndpoint[] {
  const pagePathByRequestId = new Map<string, string>();
  for (const entry of entries) {
    pagePathByRequestId.set(entry.payload.id, entry.pagePath);
  }

  return dedupedRequests.map((request) => ({
    id: request.id,
    sessionId: session.id,
    domain: session.domain,
    method: request.method,
    url: request.url,
    path: request.path,
    pagePath: pagePathByRequestId.get(request.id) ?? getPathFromUrl(request.url),
    status: request.status,
    payloadBytes: request.payloadBytes,
    usedBytes: request.usedBytes,
    wastedBytes: request.wastedBytes,
    wastePercentage: request.wastePercent,
  }));
}

function buildUnusedFields(
  session: TrackingSession,
  entries: RawCaptureEntry[],
  dedupedRequests: AnalyzedRequest[],
): UnusedField[] {
  const pagePathByRequestId = new Map<string, string>();
  for (const entry of entries) {
    pagePathByRequestId.set(entry.payload.id, entry.pagePath);
  }

  const fieldMap = new Map<string, UnusedField>();

  for (const request of dedupedRequests) {
    const allPaths = collectPathsFromShape(request.shape);
    for (const path of request.unusedPaths) {
      const wastedBytes = estimatePathBytes(
        request.shape,
        path,
        request.payloadBytes,
        allPaths,
      );
      const key = path;
      const existing = fieldMap.get(key);
      if (existing) {
        existing.wastedBytes += wastedBytes;
      } else {
        const shapeLeaf = request.shape;
        fieldMap.set(key, {
          id: `${session.id}:${path}`,
          sessionId: session.id,
          domain: session.domain,
          path,
          type: inferFieldType(shapeLeaf),
          wastedBytes,
          endpointPath: request.path,
          pagePath: pagePathByRequestId.get(request.id) ?? getPathFromUrl(request.url),
        });
      }
    }
  }

  return [...fieldMap.values()].sort((a, b) => b.wastedBytes - a.wastedBytes);
}

function buildDiagnosis(
  analytics: AnalyticsSummary | null,
  unusedFields: UnusedField[],
  endpoints: CapturedEndpoint[],
): SessionDiagnosis {
  const worst = analytics?.worstEndpoint ?? null;
  const topField = unusedFields[0] ?? null;
  const fullyUnusedEndpointCount = endpoints.filter((e) => e.wastePercentage >= 100).length;

  return {
    topWasteEndpoint: worst ? `${worst.method} ${worst.path}` : null,
    topWasteEndpointUnusedLabel: worst ? formatBytes(worst.wastedBytes) : null,
    largestUnusedField: topField?.path ?? null,
    fullyUnusedEndpointCount,
  };
}

export function buildSessionDashboardSnapshot(
  session: TrackingSession | null,
  entries: RawCaptureEntry[],
): SessionDashboardSnapshot {
  if (!session) {
    return {
      session,
      summary: null,
      analytics: null,
      pages: [],
      endpoints: [],
      unusedFields: [],
      diagnosis: {
        topWasteEndpoint: null,
        topWasteEndpointUnusedLabel: null,
        largestUnusedField: null,
        fullyUnusedEndpointCount: 0,
      },
    };
  }

  const filtered = filterEntriesForSession(entries, session);
  const { dedupedRequests, rawRequestCount, duplicateGroups } =
    rebuildDedupedRequests(filtered);
  const analytics = buildDedupedSummary({
    dedupedRequests,
    rawRequestCount,
    duplicateGroups,
  });

  const pages = buildPages(session, filtered, dedupedRequests);
  const endpoints = buildEndpoints(session, filtered, dedupedRequests);
  const unusedFields = buildUnusedFields(session, filtered, dedupedRequests);

  const summary: DomainSessionSummary = {
    sessionId: session.id,
    domain: session.domain,
    startedAt: session.startedAt,
    pagesVisited: pages.length,
    apiCalls: analytics.totalRequests,
    totalPayloadBytes: analytics.totalPayloadBytes,
    usedBytes: analytics.usedBytes,
    wastedBytes: analytics.wastedBytes,
    wastePercentage: analytics.wastePercent,
    efficiencyScore: analytics.efficiencyScore,
    usedFields: analytics.usedFields,
  };

  return {
    session,
    summary,
    analytics,
    pages,
    endpoints,
    unusedFields,
    diagnosis: buildDiagnosis(analytics, unusedFields, endpoints),
  };
}

export function formatSessionTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function createSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
