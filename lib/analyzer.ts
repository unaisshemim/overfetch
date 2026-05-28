import type {
  AnalyticsSummary,
  AnalyzedRequest,
  DuplicateGroup,
  FieldShape,
  RequestCapturedPayload,
} from './types';

const textEncoder = new TextEncoder();

export function estimateJsonBytes(value: unknown): number {
  try {
    return textEncoder.encode(JSON.stringify(value)).length;
  } catch {
    return 0;
  }
}

export function getUrlPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

export function normalizeUrlPathForKey(url: string): string {
  // Used only for stable deduping keys, not for display.
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    const params = Array.from(parsed.searchParams.entries()).sort((a, b) => {
      if (a[0] !== b[0]) return a[0].localeCompare(b[0]);
      return a[1].localeCompare(b[1]);
    });
    const normalizedSearch = params
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return normalizedSearch ? `${pathname}?${normalizedSearch}` : pathname;
  } catch {
    return url;
  }
}

export function getDuplicateKey(method: string, url: string): string {
  return `${method.toUpperCase()} ${getUrlPath(url)}`;
}

function hashStringFNV1a(input: string): string {
  // Simple deterministic hash for keys; not for security.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Convert to unsigned 32-bit and hex.
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function getFieldShapeStructureKey(shape: FieldShape): string {
  // Structure only (ignore primitive values) so duplicates can be detected even
  // when payload content differs (e.g., dynamic IDs).
  if (shape.type === 'primitive') return 'p';
  if (shape.type === 'array') {
    return `a(${shape.itemShape ? getFieldShapeStructureKey(shape.itemShape) : '*'})`;
  }
  // object
  return `o(${shape.keys.slice().sort().join(',')})`;
}

export function getFieldShapeStructureHash(shape: FieldShape): string {
  return hashStringFNV1a(getFieldShapeStructureKey(shape));
}

export function getRequestDeduplicationKey(
  method: string,
  url: string,
  status: number,
  shape: FieldShape,
): string {
  const normalizedPath = normalizeUrlPathForKey(url);
  const shapeHash = getFieldShapeStructureHash(shape);
  return `${method.toUpperCase()} ${normalizedPath} ${status} ${shapeHash}`;
}

export function collectPathsFromShape(
  shape: FieldShape,
  prefix = '',
): string[] {
  if (shape.type === 'primitive') {
    return prefix ? [prefix] : [];
  }
  if (shape.type === 'array') {
    const arrayPath = prefix ? `${prefix}[]` : '[]';
    const childPaths = shape.itemShape
      ? collectPathsFromShape(shape.itemShape, arrayPath)
      : [];
    return [...new Set([arrayPath, ...childPaths])];
  }
  const paths: string[] = [];
  if (prefix) paths.push(prefix);
  for (const key of shape.keys) {
    const childPrefix = prefix ? `${prefix}.${key}` : key;
    const childShape = shape.children?.[key];
    if (childShape) {
      paths.push(...collectPathsFromShape(childShape, childPrefix));
    } else {
      paths.push(childPrefix);
    }
  }
  return paths;
}

export function normalizeUsedPath(path: string): string {
  return path
    .replace(/^(\d+)(?=\.|$)/, '[$1]')
    .replace(/\[\d+\]/g, '[]');
}

export function pathMatchesUsed(candidate: string, usedPaths: string[]): boolean {
  const normalizedCandidate = normalizeUsedPath(candidate);
  return usedPaths.some((used) => {
    const normalizedUsed = normalizeUsedPath(used);
    if (normalizedCandidate === normalizedUsed) return true;
    if (normalizedCandidate.startsWith(`${normalizedUsed}.`)) return true;
    if (normalizedUsed.startsWith(`${normalizedCandidate}.`)) return true;
    return false;
  });
}

export function estimatePathBytes(
  _shape: FieldShape,
  path: string,
  totalBytes: number,
  allPaths: string[],
): number {
  if (allPaths.length === 0) return 0;
  const depth = path.split('.').length;
  const weight = 1 / Math.max(depth, 1);
  const totalWeight = allPaths.reduce(
    (sum, p) => sum + 1 / Math.max(p.split('.').length, 1),
    0,
  );
  return Math.round((weight / totalWeight) * totalBytes);
}

export function analyzeRequest(
  payload: RequestCapturedPayload,
  usedPaths: string[],
  duplicateCount: number,
): AnalyzedRequest {
  const allPaths = collectPathsFromShape(payload.shape);
  const normalizedUsed = [
    ...new Set(usedPaths.map(normalizeUsedPath).filter(Boolean)),
  ];

  const usedFieldPaths = allPaths.filter((p) =>
    pathMatchesUsed(p, normalizedUsed),
  );
  const unusedPaths = allPaths.filter(
    (p) => !pathMatchesUsed(p, normalizedUsed),
  );

  const usedBytes =
    usedFieldPaths.length === 0
      ? 0
      : usedFieldPaths.reduce(
          (sum, path) =>
            sum +
            estimatePathBytes(
              payload.shape,
              path,
              payload.payloadBytes,
              allPaths,
            ),
          0,
        );

  const wastedBytes = Math.max(0, payload.payloadBytes - usedBytes);
  const wastePercent =
    payload.payloadBytes > 0
      ? Math.round((wastedBytes / payload.payloadBytes) * 100)
      : 0;
  const efficiencyScore = Math.max(
    0,
    Math.round((usedBytes / Math.max(payload.payloadBytes, 1)) * 100),
  );

  return {
    id: payload.id,
    url: payload.url,
    path: getUrlPath(payload.url),
    method: payload.method.toUpperCase(),
    status: payload.status,
    responseTimeMs: payload.responseTimeMs,
    payloadBytes: payload.payloadBytes,
    timestamp: payload.timestamp,
    shape: payload.shape,
    usedPaths: normalizedUsed,
    unusedPaths,
    usedBytes,
    wastedBytes,
    wastePercent,
    efficiencyScore,
    duplicateCount,
  };
}

export function buildDuplicateGroups(
  requests: AnalyzedRequest[],
): DuplicateGroup[] {
  const groups = new Map<string, DuplicateGroup>();

  for (const request of requests) {
    const key = getDuplicateKey(request.method, request.url);
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.totalBytes += request.payloadBytes;
      existing.requestIds.push(request.id);
    } else {
      groups.set(key, {
        key,
        method: request.method,
        path: request.path,
        count: 1,
        totalBytes: request.payloadBytes,
        requestIds: [request.id],
      });
    }
  }

  return [...groups.values()]
    .filter((g) => g.count > 1)
    .sort((a, b) => b.count - a.count);
}

export function buildSummary(requests: AnalyzedRequest[]): AnalyticsSummary {
  const totalPayloadBytes = requests.reduce((s, r) => s + r.payloadBytes, 0);
  const usedBytes = requests.reduce((s, r) => s + r.usedBytes, 0);
  const wastedBytes = requests.reduce((s, r) => s + r.wastedBytes, 0);
  const wastePercent =
    totalPayloadBytes > 0
      ? Math.round((wastedBytes / totalPayloadBytes) * 100)
      : 0;
  const efficiencyScore = Math.max(
    0,
    Math.round((usedBytes / Math.max(totalPayloadBytes, 1)) * 100),
  );

  const topEndpointsByWaste = [...requests]
    .sort((a, b) => b.wastedBytes - a.wastedBytes)
    .slice(0, 8);

  const worstEndpoint =
    topEndpointsByWaste.length > 0 ? topEndpointsByWaste[0] : null;

  const totalFields = requests.reduce(
    (s, r) => s + collectPathsFromShape(r.shape).length,
    0,
  );
  const usedFields = requests.reduce(
    (s, r) =>
      s +
      collectPathsFromShape(r.shape).filter((p) =>
        pathMatchesUsed(p, r.usedPaths),
      ).length,
    0,
  );

  const biggestUnusedFields = worstEndpoint
    ? (() => {
        const allPaths = collectPathsFromShape(worstEndpoint.shape);
        const byWaste = worstEndpoint.unusedPaths
          .map((path) => ({
            path,
            wastedBytes: estimatePathBytes(
              worstEndpoint.shape,
              path,
              worstEndpoint.payloadBytes,
              allPaths,
            ),
          }))
          .sort((a, b) => b.wastedBytes - a.wastedBytes)
          .slice(0, 6);
        return byWaste;
      })()
    : [];

  return {
    totalRequests: requests.length,
    totalPayloadBytes,
    usedBytes,
    wastedBytes,
    wastePercent,
    efficiencyScore,
    duplicateGroups: buildDuplicateGroups(requests),
    topEndpointsByWaste,
    worstEndpoint,

    totalFields,
    usedFields,
    biggestUnusedFields,
  };
}

export function buildDedupedSummary({
  dedupedRequests,
  rawRequestCount,
  duplicateGroups,
}: {
  dedupedRequests: AnalyzedRequest[];
  rawRequestCount: number;
  duplicateGroups: DuplicateGroup[];
}): AnalyticsSummary {
  const totalPayloadBytes = dedupedRequests.reduce(
    (s, r) => s + r.payloadBytes,
    0,
  );
  const usedBytes = dedupedRequests.reduce((s, r) => s + r.usedBytes, 0);
  const wastedBytes = dedupedRequests.reduce(
    (s, r) => s + r.wastedBytes,
    0,
  );

  const wastePercent =
    totalPayloadBytes > 0
      ? Math.round((wastedBytes / totalPayloadBytes) * 100)
      : 0;
  const efficiencyScore = Math.max(
    0,
    Math.round((usedBytes / Math.max(totalPayloadBytes, 1)) * 100),
  );

  const topEndpointsByWaste = [...dedupedRequests]
    .sort((a, b) => b.wastedBytes - a.wastedBytes)
    .slice(0, 8);
  const worstEndpoint =
    topEndpointsByWaste.length > 0 ? topEndpointsByWaste[0] : null;

  const totalFields = dedupedRequests.reduce(
    (s, r) => s + collectPathsFromShape(r.shape).length,
    0,
  );
  const usedFields = dedupedRequests.reduce(
    (s, r) =>
      s +
      collectPathsFromShape(r.shape).filter((p) =>
        pathMatchesUsed(p, r.usedPaths),
      ).length,
    0,
  );

  const biggestUnusedFields = worstEndpoint
    ? (() => {
        const allPaths = collectPathsFromShape(worstEndpoint.shape);
        const byWaste = worstEndpoint.unusedPaths
          .map((path) => ({
            path,
            wastedBytes: estimatePathBytes(
              worstEndpoint.shape,
              path,
              worstEndpoint.payloadBytes,
              allPaths,
            ),
          }))
          .sort((a, b) => b.wastedBytes - a.wastedBytes)
          .slice(0, 6);
        return byWaste;
      })()
    : [];

  return {
    // Important: after dedupe, payload totals should not be inflated, but
    // request count still represents captured traffic volume.
    totalRequests: rawRequestCount,
    totalPayloadBytes,
    usedBytes,
    wastedBytes,
    wastePercent,
    efficiencyScore,
    duplicateGroups: [...duplicateGroups].sort((a, b) => b.count - a.count),
    topEndpointsByWaste,
    worstEndpoint,
    totalFields,
    usedFields,
    biggestUnusedFields,
  };
}

export function buildFieldTree(paths: string[]): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const path of paths) {
    const parts = path.replace(/\[\]/g, '.[]').split('.').filter(Boolean);
    let node: Record<string, unknown> = root;
    for (const part of parts) {
      if (!(part in node)) {
        node[part] = {};
      }
      const next = node[part];
      if (typeof next === 'object' && next !== null && !Array.isArray(next)) {
        node = next as Record<string, unknown>;
      } else {
        const fresh: Record<string, unknown> = {};
        node[part] = fresh;
        node = fresh;
      }
    }
  }
  return root;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
