import {
  buildFieldTree,
  estimatePathBytes,
  collectPathsFromShape,
  formatBytes,
} from '@/lib/analyzer';
import type { AnalyzedRequest, AnalyticsSummary, DuplicateGroup } from '@/lib/types';
import type { CapturedEndpoint, CapturedPage, UnusedField } from '@/lib/session';
import { buildPayloadTreeFromRequest } from './buildPayloadTree';
import type { PageFieldSelection, PayloadTreeNode, UnusedSubtreeSummary } from './types';

export interface PageDetailData {
  page: CapturedPage;
  requests: AnalyzedRequest[];
  primaryRequest: AnalyzedRequest | null;
  payloadTree: PayloadTreeNode[];
  duplicateGroups: DuplicateGroup[];
  unusedFields: Array<{ path: string; wastedBytes: number; endpointPath: string }>;
  avgLoadMs: number | null;
  efficiencyScore: number;
  topUnusedSubtrees: UnusedSubtreeSummary[];
}

function buildRequestUnusedFields(
  requests: AnalyzedRequest[],
): Array<{ path: string; wastedBytes: number; endpointPath: string }> {
  const fieldMap = new Map<
    string,
    { path: string; wastedBytes: number; endpointPath: string }
  >();

  for (const request of requests) {
    const allPaths = collectPathsFromShape(request.shape);
    for (const path of request.unusedPaths) {
      const key = `${request.path}:${path}`;
      const wastedBytes = estimatePathBytes(
        request.shape,
        path,
        request.payloadBytes,
        allPaths,
      );
      const existing = fieldMap.get(key);
      if (existing) {
        existing.wastedBytes += wastedBytes;
      } else {
        fieldMap.set(key, {
          path,
          wastedBytes,
          endpointPath: request.path,
        });
      }
    }
  }

  return [...fieldMap.values()].sort((a, b) => b.wastedBytes - a.wastedBytes);
}

export function getRequestIdsForPage(
  pagePath: string,
  endpoints: CapturedEndpoint[],
): Set<string> {
  return new Set(
    endpoints.filter((e) => e.pagePath === pagePath).map((e) => e.id),
  );
}

export function filterRequestsForPage(
  pagePath: string,
  requests: AnalyzedRequest[],
  endpoints: CapturedEndpoint[],
): AnalyzedRequest[] {
  const ids = getRequestIdsForPage(pagePath, endpoints);
  if (ids.size === 0) {
    return requests;
  }
  return requests.filter((r) => ids.has(r.id));
}

export function pickPrimaryRequest(requests: AnalyzedRequest[]): AnalyzedRequest | null {
  if (requests.length === 0) return null;
  return (
    [...requests].sort((a, b) => {
      const aFields = collectPathsFromShape(a.shape).length;
      const bFields = collectPathsFromShape(b.shape).length;
      if (aFields !== bFields) return bFields - aFields;
      if (a.wastePercent !== b.wastePercent) return b.wastePercent - a.wastePercent;
      return b.payloadBytes - a.payloadBytes;
    })[0] ?? null
  );
}

export function buildTopUnusedSubtrees(
  request: AnalyzedRequest | null,
  limit = 5,
): UnusedSubtreeSummary[] {
  if (!request) return [];
  const allPaths = collectPathsFromShape(request.shape);
  const tree = buildFieldTree(request.unusedPaths);
  const roots = Object.keys(tree);

  return roots.slice(0, limit).map((root) => {
    const prefix = root;
    const matching = request.unusedPaths.filter(
      (p) => p === prefix || p.startsWith(`${prefix}.`),
    );
    const wastedBytes = matching.reduce(
      (sum, path) =>
        sum + estimatePathBytes(request.shape, path, request.payloadBytes, allPaths),
      0,
    );
    return {
      path: prefix,
      fieldCount: matching.length,
      wastedLabel: formatBytes(wastedBytes),
    };
  });
}

export function buildPageDetailData(
  page: CapturedPage,
  requests: AnalyzedRequest[],
  endpoints: CapturedEndpoint[],
  sessionUnusedFields: UnusedField[],
  analytics: AnalyticsSummary | null,
): PageDetailData {
  const pageRequests = filterRequestsForPage(page.path, requests, endpoints);
  const primaryRequest = pickPrimaryRequest(pageRequests);

  const payloadTree = primaryRequest
    ? buildPayloadTreeFromRequest(
        primaryRequest.shape,
        primaryRequest.usedPaths,
        primaryRequest.unusedPaths,
      )
    : [];

  const pageRequestIds = new Set(pageRequests.map((r) => r.id));
  const duplicateGroups =
    analytics?.duplicateGroups.filter((g) =>
      g.requestIds.some((id) => pageRequestIds.has(id)),
    ) ?? [];

  const summaryUnusedFields = sessionUnusedFields
    .filter((f) => f.pagePath === page.path)
    .map((f) => ({
      path: f.path,
      wastedBytes: f.wastedBytes,
      endpointPath: f.endpointPath,
    }));
  const unusedFields =
    summaryUnusedFields.length > 0
      ? summaryUnusedFields
      : buildRequestUnusedFields(pageRequests);

  const avgLoadMs =
    pageRequests.length > 0
      ? Math.round(
          pageRequests.reduce((s, r) => s + r.responseTimeMs, 0) / pageRequests.length,
        )
      : null;

  const efficiencyScore = Math.max(0, 100 - page.wastePercentage);

  return {
    page,
    requests: pageRequests,
    primaryRequest,
    payloadTree,
    duplicateGroups,
    unusedFields,
    avgLoadMs,
    efficiencyScore,
    topUnusedSubtrees: buildTopUnusedSubtrees(primaryRequest),
  };
}

export function fieldSelectionFromNode(node: PayloadTreeNode): PageFieldSelection {
  return {
    path: node.path,
    usage: node.usage,
    type: node.type,
  };
}
