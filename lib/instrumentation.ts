/**
 * Main-world instrumentation logic.
 * Runs in the page context — no Chrome extension APIs.
 */

import type { FieldShape, RequestCapturedPayload } from './types';
import { PAGE_MESSAGE_SOURCE } from './types';

const responseRequestIds = new WeakMap<Response, string>();
const responseCaptureMeta = new WeakMap<
  Response,
  {
    url: string;
    method: string;
    status: number;
    start: number;
    contentType: string;
  }
>();
const capturedResponses = new WeakSet<Response>();
const proxyEnabledRequestIds = new Set<string>();
const fieldAccessPostCounts = new Map<string, number>();
const fieldAccessPostedPaths = new Map<string, Set<string>>();
const textBodyRequestIds = new Map<string, { requestId: string; expiresAt: number }>();

// Safety rails: avoid proxying/tracking extremely large payloads that can freeze pages.
const MAX_PROXY_BYTES = 2_000_000; // 2MB
const MAX_FIELD_ACCESS_POSTS_PER_REQUEST = 800;
const TEXT_TRACK_TTL_MS = 60_000;
const MAX_TEXT_TRACKED_BODIES = 400;
const MAX_SHAPE_DEPTH = 8;
const MAX_OBJECT_KEYS_PER_SHAPE = 250;
const MAX_ARRAY_SHAPE_SAMPLES = 10;
const MAX_DOM_MATCH_FIELDS = 500;
const MAX_DOM_MATCH_ACTIVE_REQUESTS = 25;
const MAX_DOM_MATCH_TEXT_LENGTH = 120_000;
const DOM_MATCH_SCAN_DELAYS_MS = [150, 600, 1_500, 3_000];
const DOM_MATCH_KEEPALIVE_MS = 20_000;
const DOM_MATCH_MUTATION_DEBOUNCE_MS = 1_500;
const DOM_MATCH_MIN_SCAN_INTERVAL_MS = 2_000;
const DEBUG_PREFIX = '[Overfetch Debug]';

type DomMatchCandidate = {
  path: string;
  candidates: string[];
  digitCandidates: string[];
};

const domMatchCandidatesByRequest = new Map<string, DomMatchCandidate[]>();
let domMatchObserver: MutationObserver | null = null;
let domMatchMutationTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
let lastDomMatchScanAt = 0;

function debugLog(message: string, details?: Record<string, unknown>): void {
  if (localStorage.getItem('overfetch:debug') !== 'true') return;
  if (details) {
    console.info(`${DEBUG_PREFIX} ${message}`, details);
    return;
  }
  console.info(`${DEBUG_PREFIX} ${message}`);
}

function postToExtension(
  type: 'request-captured' | 'field-accessed' | 'route-changed',
  payload: unknown,
): void {
  window.postMessage(
    {
      source: PAGE_MESSAGE_SOURCE,
      type,
      payload,
    },
    '*',
  );
}

function bytesFromText(text: string): number {
  try {
    return new TextEncoder().encode(text).length;
  } catch {
    return text.length;
  }
}

function mergeFieldShapes(a: FieldShape | undefined, b: FieldShape): FieldShape {
  if (!a) return b;
  if (a.type === 'array' && b.type === 'array') {
    return {
      type: 'array',
      itemShape: b.itemShape
        ? mergeFieldShapes(a.itemShape, b.itemShape)
        : a.itemShape,
    };
  }
  if (a.type === 'object' && b.type === 'object') {
    const children: Record<string, FieldShape> = { ...(a.children ?? {}) };
    for (const key of b.keys) {
      const child = b.children?.[key];
      if (child) children[key] = mergeFieldShapes(children[key], child);
    }
    return {
      type: 'object',
      keys: [...new Set([...a.keys, ...b.keys])].slice(0, MAX_OBJECT_KEYS_PER_SHAPE),
      children,
    };
  }
  return a;
}

function getShape(value: unknown, depth = 0): FieldShape {
  if (value === null || value === undefined) {
    return { type: 'primitive', primitive: 'null' };
  }
  if (typeof value !== 'object') {
    return { type: 'primitive', primitive: typeof value };
  }
  if (depth >= MAX_SHAPE_DEPTH) {
    return { type: 'object', keys: [] };
  }
  if (Array.isArray(value)) {
    const samples = value
      .slice(0, MAX_ARRAY_SHAPE_SAMPLES)
      .filter((item) => item !== null && item !== undefined);
    const itemShape = samples.reduce<FieldShape | undefined>(
      (merged, item) => mergeFieldShapes(merged, getShape(item, depth + 1)),
      undefined,
    );
    return {
      type: 'array',
      itemShape,
    };
  }
  const entries = Object.entries(value as Record<string, unknown>).slice(
    0,
    MAX_OBJECT_KEYS_PER_SHAPE,
  );
  const children: Record<string, FieldShape> = {};
  for (const [key, child] of entries) {
    children[key] = getShape(child, depth + 1);
  }
  return {
    type: 'object',
    keys: entries.map(([key]) => key),
    children,
  };
}

function estimateBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return 0;
  }
}

function normalizeAccessPath(path: string): string {
  return path.replace(/^(\d+)(?=\.|$)/, '[$1]');
}

function recordFieldAccess(requestId: string, path: string): void {
  const normalizedPath = normalizeAccessPath(path);
  const postedPaths = fieldAccessPostedPaths.get(requestId) ?? new Set<string>();
  if (postedPaths.has(normalizedPath)) return;
  const current = fieldAccessPostCounts.get(requestId) ?? 0;
  if (current >= MAX_FIELD_ACCESS_POSTS_PER_REQUEST) return;
  fieldAccessPostCounts.set(requestId, current + 1);
  postedPaths.add(normalizedPath);
  fieldAccessPostedPaths.set(requestId, postedPaths);
  postToExtension('field-accessed', { requestId, path: normalizedPath });
}

function normalizeAbsoluteUrl(rawUrl: string): string {
  try {
    return new URL(rawUrl, window.location.href).toString();
  } catch {
    return rawUrl;
  }
}

function hashTextBody(text: string): string {
  // Lightweight deterministic hash for matching JSON.parse(text) calls.
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`;
}

function pruneTrackedTextBodies(now = Date.now()): void {
  if (textBodyRequestIds.size === 0) return;
  for (const [key, entry] of textBodyRequestIds) {
    if (entry.expiresAt <= now) textBodyRequestIds.delete(key);
  }
  if (textBodyRequestIds.size <= MAX_TEXT_TRACKED_BODIES) return;
  const overflow = textBodyRequestIds.size - MAX_TEXT_TRACKED_BODIES;
  const keys = [...textBodyRequestIds.keys()];
  for (let i = 0; i < overflow; i++) {
    textBodyRequestIds.delete(keys[i]!);
  }
}

function trackTextBodyRequestId(text: string, requestId: string): void {
  if (!text) return;
  const now = Date.now();
  pruneTrackedTextBodies(now);
  textBodyRequestIds.set(hashTextBody(text), {
    requestId,
    expiresAt: now + TEXT_TRACK_TTL_MS,
  });
}

function getTrackedRequestIdForText(text: string): string | null {
  if (!text) return null;
  const key = hashTextBody(text);
  const entry = textBodyRequestIds.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    textBodyRequestIds.delete(key);
    return null;
  }
  return entry.requestId;
}

function shouldIgnoreStaticAsset(url: string): boolean {
  try {
    const pathname = new URL(url, window.location.href).pathname.toLowerCase();
    return /\.(?:js|mjs|css|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|map)$/i.test(
      pathname,
    );
  } catch {
    return false;
  }
}

function isArrayIndexProperty(prop: string): boolean {
  if (!/^\d+$/.test(prop)) return false;
  return Number.isSafeInteger(Number(prop));
}

function shouldTrackPropertyAccess(target: unknown, prop: string): boolean {
  if (Array.isArray(target)) return isArrayIndexProperty(prop);
  return ![
    'then',
    'toJSON',
    'toString',
    'valueOf',
    'constructor',
    '__proto__',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
  ].includes(prop);
}

function normalizeComparableText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function digitsOnly(text: string): string {
  return text.replace(/\D+/g, '');
}

function trimTrailingZeros(value: string): string {
  return value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

function uniqStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function pathLooksMonetary(path: string): boolean {
  return /(?:price|amount|revenue|mrr|arr|cost|fee|payment|paid|sale|profit|income|earnings|valuation|value|salary|subscription|charge|refund|balance|total)/i.test(
    path,
  );
}

function pathLooksRatio(path: string): boolean {
  return /(?:ratio|rate|percent|percentage|margin|growth|multiple|conversion|churn|retention|revenue)/i.test(
    path,
  );
}

function getDateTextCandidates(value: string): string[] {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[tT].*)?$/);
  if (!match) return [];
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return [];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return [];
  const shortMonth = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
  const longMonth = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    timeZone: 'UTC',
  }).format(date);
  const yyyy = String(year);
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return [
    `${day} ${shortMonth}`,
    `${day} ${longMonth}`,
    `${shortMonth} ${day}`,
    `${longMonth} ${day}`,
    `${day} ${shortMonth} ${yyyy}`,
    `${shortMonth} ${day}, ${yyyy}`,
    `${mm}/${dd}/${yyyy}`,
    `${dd}/${mm}/${yyyy}`,
  ];
}

function addNumberFormats(candidates: Set<string>, value: number, monetary: boolean): void {
  if (!Number.isFinite(value)) return;
  const absolute = Math.abs(value);
  const raw = trimTrailingZeros(String(value));
  const us = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
  const india = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);

  candidates.add(raw);
  candidates.add(us);
  candidates.add(india);

  if (monetary) {
    candidates.add(`$${us}`);
    candidates.add(`$${raw}`);
    candidates.add(`₹${india}`);
    candidates.add(`rs ${india}`);
  }

  if (absolute >= 100_000) {
    const lakh = value / 100_000;
    candidates.add(`${trimTrailingZeros(lakh.toFixed(1))} L`);
    candidates.add(`${Math.round(lakh)} L`);
  }
  if (absolute >= 10_000_000) {
    const crore = value / 10_000_000;
    candidates.add(`${trimTrailingZeros(crore.toFixed(2))} Cr`);
    candidates.add(`${trimTrailingZeros(crore.toFixed(1))} Cr`);
  }
  if (absolute >= 1_000) {
    const thousand = value / 1_000;
    candidates.add(`${trimTrailingZeros(thousand.toFixed(1))} K`);
    candidates.add(`${Math.round(thousand)} K`);
  }
}

function getNumberTextCandidates(value: number, path: string): string[] {
  if (!Number.isFinite(value) || Math.abs(value) < 2) return [];
  const absolute = Math.abs(value);
  const candidates = new Set<string>();
  const monetary = pathLooksMonetary(path);
  const ratio = pathLooksRatio(path);

  addNumberFormats(candidates, value, monetary);

  // Many APIs store monetary values in cents/paise while the UI renders dollars/rupees.
  if (monetary && Number.isInteger(value) && absolute >= 100) {
    addNumberFormats(candidates, value / 100, true);
  }

  if (ratio && absolute > 0 && absolute < 100) {
    candidates.add(`${trimTrailingZeros(value.toFixed(2))}x`);
    candidates.add(`${trimTrailingZeros(value.toFixed(2))} x`);
    candidates.add(`${trimTrailingZeros(value.toFixed(1))}x`);
    candidates.add(`${trimTrailingZeros(value.toFixed(1))} x`);
  }

  if (ratio && absolute > 0 && absolute <= 1) {
    const percent = value * 100;
    candidates.add(`${trimTrailingZeros(percent.toFixed(2))}%`);
    candidates.add(`${trimTrailingZeros(percent.toFixed(1))}%`);
  }
  return [...candidates];
}

function buildPrimitiveTextCandidates(value: unknown, path: string): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length < 2 || trimmed.length > 180) return [];
    return [trimmed, ...getDateTextCandidates(trimmed)];
  }
  if (typeof value === 'number') {
    return getNumberTextCandidates(value, path);
  }
  return [];
}

function collectDomMatchCandidates(
  value: unknown,
  prefix = '',
  output: DomMatchCandidate[] = [],
): DomMatchCandidate[] {
  if (output.length >= MAX_DOM_MATCH_FIELDS) return output;
  if (value === null || value === undefined) return output;

  if (typeof value !== 'object') {
    const candidates = buildPrimitiveTextCandidates(value, prefix)
      .map(normalizeComparableText)
      .filter((candidate) => candidate.length >= 2);
    const digitCandidates = uniqStrings([
      typeof value === 'string' ? digitsOnly(value) : '',
      ...candidates.map(digitsOnly),
    ]).filter((candidate) => candidate.length >= 3);
    if (prefix && (candidates.length > 0 || digitCandidates.length > 0)) {
      output.push({
        path: normalizeAccessPath(prefix),
        candidates: [...new Set(candidates)],
        digitCandidates,
      });
    }
    return output;
  }

  if (Array.isArray(value)) {
    const limit = Math.min(value.length, 20);
    for (let i = 0; i < limit; i++) {
      const nextPrefix = prefix ? `${prefix}[${i}]` : `[${i}]`;
      collectDomMatchCandidates(value[i], nextPrefix, output);
      if (output.length >= MAX_DOM_MATCH_FIELDS) break;
    }
    return output;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    collectDomMatchCandidates(child, nextPrefix, output);
    if (output.length >= MAX_DOM_MATCH_FIELDS) break;
  }
  return output;
}

function getVisibleUiText(): { text: string; digits: string } {
  const parts: string[] = [];
  const bodyText = document.body?.textContent ?? '';
  if (bodyText) parts.push(bodyText.slice(0, MAX_DOM_MATCH_TEXT_LENGTH));

  if (parts.join(' ').length < MAX_DOM_MATCH_TEXT_LENGTH) {
    for (const element of document.querySelectorAll(
      'svg text, svg tspan, svg title, [aria-label], [title], [data-value]',
    )) {
      parts.push(element.textContent ?? '');
      parts.push(element.getAttribute('aria-label') ?? '');
      parts.push(element.getAttribute('title') ?? '');
      parts.push(element.getAttribute('data-value') ?? '');
    }
  }

  if (parts.join(' ').length < MAX_DOM_MATCH_TEXT_LENGTH) {
    for (const element of document.querySelectorAll('input, textarea, select')) {
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      ) {
        parts.push(element.value);
        if (element instanceof HTMLSelectElement) {
          parts.push(element.selectedOptions[0]?.textContent ?? '');
        }
      }
    }
  }
  const text = normalizeComparableText(parts.join(' ').slice(0, MAX_DOM_MATCH_TEXT_LENGTH));
  return { text, digits: digitsOnly(text) };
}

function runDomUsageScan(requestId?: string): void {
  if (domMatchCandidatesByRequest.size === 0 || !document.body) return;

  const now = Date.now();
  if (!requestId && now - lastDomMatchScanAt < DOM_MATCH_MIN_SCAN_INTERVAL_MS) return;
  lastDomMatchScanAt = now;

  const ui = getVisibleUiText();
  const entries = requestId
    ? ([[requestId, domMatchCandidatesByRequest.get(requestId) ?? []]] as const)
    : [...domMatchCandidatesByRequest.entries()];

  for (const [id, candidates] of entries) {
    if (candidates.length === 0) continue;
    for (const candidate of candidates) {
      const textMatched = candidate.candidates.some(
        (value) => value.length >= 3 && ui.text.includes(value),
      );
      const digitMatched = candidate.digitCandidates.some((value) =>
        ui.digits.includes(value),
      );
      if (textMatched || digitMatched) {
        recordFieldAccess(id, candidate.path);
      }
    }
  }
}

function pruneDomMatchCandidates(): void {
  const overflow = domMatchCandidatesByRequest.size - MAX_DOM_MATCH_ACTIVE_REQUESTS;
  if (overflow <= 0) return;
  const staleRequestIds = [...domMatchCandidatesByRequest.keys()].slice(0, overflow);
  for (const requestId of staleRequestIds) {
    domMatchCandidatesByRequest.delete(requestId);
    fieldAccessPostCounts.delete(requestId);
    fieldAccessPostedPaths.delete(requestId);
  }
}

function ensureDomMatchObserver(): void {
  if (domMatchObserver || !document.documentElement) return;
  domMatchObserver = new MutationObserver(() => {
    if (domMatchMutationTimer) globalThis.clearTimeout(domMatchMutationTimer);
    domMatchMutationTimer = globalThis.setTimeout(() => {
      runDomUsageScan();
    }, DOM_MATCH_MUTATION_DEBOUNCE_MS);
  });
  domMatchObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function scheduleDomUsageScans(requestId: string, body: unknown): void {
  const candidates = collectDomMatchCandidates(body);
  if (candidates.length === 0) return;
  domMatchCandidatesByRequest.set(requestId, candidates);
  pruneDomMatchCandidates();
  ensureDomMatchObserver();
  for (const delay of DOM_MATCH_SCAN_DELAYS_MS) {
    globalThis.setTimeout(() => runDomUsageScan(requestId), delay);
  }
  globalThis.setTimeout(() => {
    domMatchCandidatesByRequest.delete(requestId);
    fieldAccessPostCounts.delete(requestId);
    fieldAccessPostedPaths.delete(requestId);
  }, DOM_MATCH_KEEPALIVE_MS);
}

function createTrackingProxy<T extends object>(
  target: T,
  requestId: string,
  pathPrefix = '',
): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      if (typeof prop === 'symbol') {
        return Reflect.get(obj, prop, receiver);
      }
      if (!shouldTrackPropertyAccess(obj, String(prop))) {
        return Reflect.get(obj, prop, receiver);
      }
      const path = pathPrefix ? `${pathPrefix}.${String(prop)}` : String(prop);
      recordFieldAccess(requestId, path);
      const value = Reflect.get(obj, prop, receiver);
      if (value !== null && typeof value === 'object') {
        if (Array.isArray(value)) {
          return value.map((item, index) => {
            const itemPath = `${path}[${index}]`;
            recordFieldAccess(requestId, itemPath);
            if (item !== null && typeof item === 'object') {
              return createTrackingProxy(
                item as object,
                requestId,
                itemPath,
              );
            }
            return item;
          });
        }
        return createTrackingProxy(value as object, requestId, path);
      }
      return value;
    },
  });
}

function wrapJsonBody(
  requestId: string,
  body: unknown,
): unknown {
  if (!proxyEnabledRequestIds.has(requestId)) return body;
  if (body !== null && typeof body === 'object') {
    return createTrackingProxy(body as object, requestId);
  }
  return body;
}

function captureFromResponse(
  response: Response,
  requestId: string,
  body: unknown,
  payloadBytes: number,
): void {
  const meta = responseCaptureMeta.get(response);
  if (!meta) return;
  captureRequest({
    id: requestId,
    url: meta.url,
    method: meta.method,
    status: meta.status,
    responseTimeMs: Math.round(performance.now() - meta.start),
    payloadBytes,
    timestamp: Date.now(),
    body,
  });
}

function captureRequest(meta: Omit<RequestCapturedPayload, 'shape'> & { body: unknown }): void {
  const shape = getShape(meta.body);
  // Only proxy for reasonably-sized payloads so the "used field" tracking
  // can't overwhelm the page.
  if (meta.payloadBytes > 0 && meta.payloadBytes <= MAX_PROXY_BYTES) {
    proxyEnabledRequestIds.add(meta.id);
  } else {
    proxyEnabledRequestIds.delete(meta.id);
  }
  scheduleDomUsageScans(meta.id, meta.body);
  const payload: RequestCapturedPayload = {
    id: meta.id,
    url: meta.url,
    method: meta.method,
    status: meta.status,
    responseTimeMs: meta.responseTimeMs,
    payloadBytes: meta.payloadBytes,
    timestamp: meta.timestamp,
    shape,
  };
  debugLog('Captured request payload', {
    id: payload.id,
    method: payload.method,
    status: payload.status,
    url: payload.url,
    payloadBytes: payload.payloadBytes,
  });
  postToExtension('request-captured', payload);
}

function generateId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function installInstrumentation(): void {
  if ((window as Window & { __overfetchInstalled?: boolean }).__overfetchInstalled) {
    return;
  }
  (window as Window & { __overfetchInstalled?: boolean }).__overfetchInstalled = true;
  debugLog('Installing page instrumentation', { href: window.location.href });

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const start = performance.now();
    const method =
      init?.method ??
      (input instanceof Request ? input.method : 'GET');
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    const absoluteUrl = normalizeAbsoluteUrl(url);
    if (shouldIgnoreStaticAsset(absoluteUrl)) {
      return originalFetch(input, init);
    }
    debugLog('Fetch started', { method: method.toUpperCase(), url: absoluteUrl });

    const response = await originalFetch(input, init);
    const contentType = response.headers.get('content-type') ?? '';
    const requestId = generateId();

    responseRequestIds.set(response, requestId);
    responseCaptureMeta.set(response, {
      url: absoluteUrl,
      method: method.toUpperCase(),
      status: response.status,
      start,
      contentType,
    });

    const clone = response.clone();
    void (async () => {
      try {
        if (capturedResponses.has(response)) return;
        const text = await clone.text();
        const parsed = tryParseJson(text);
        if (parsed === null) {
          debugLog('Skipping non-JSON response body', {
            requestId,
            url: absoluteUrl,
            contentType,
            payloadBytes: bytesFromText(text),
          });
          return;
        }
        capturedResponses.add(response);
        captureFromResponse(
          response,
          requestId,
          parsed,
          bytesFromText(text),
        );
      } catch (error) {
        debugLog('Fetch capture failed', {
          requestId,
          url: absoluteUrl,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    debugLog('Fetch finished', {
      requestId,
      method: method.toUpperCase(),
      status: response.status,
      contentType,
      url: absoluteUrl,
    });

    return response;
  };

  const originalJson = Response.prototype.json;
  const originalText = Response.prototype.text;
  const originalJsonParse = JSON.parse;

  Response.prototype.text = async function patchedText(
    this: Response,
  ): Promise<string> {
    const text = await originalText.call(this);
    const existingId = responseRequestIds.get(this);
    if (existingId) {
      trackTextBodyRequestId(text, existingId);
    }
    return text;
  };

  Response.prototype.json = async function patchedJson(
    this: Response,
  ): Promise<unknown> {
    const data = await originalJson.call(this);
    const existingId = responseRequestIds.get(this);

    if (existingId) {
      if (
        data !== null &&
        typeof data === 'object' &&
        !proxyEnabledRequestIds.has(existingId) &&
        estimateBytes(data) <= MAX_PROXY_BYTES
      ) {
        proxyEnabledRequestIds.add(existingId);
      }
      if (!capturedResponses.has(this)) {
        const meta = responseCaptureMeta.get(this);
        if (meta?.contentType.includes('json')) {
          capturedResponses.add(this);
          captureFromResponse(
            this,
            existingId,
            data,
            estimateBytes(data),
          );
        }
      }
      debugLog('Response.json consumed for tracked response', { requestId: existingId });
      return wrapJsonBody(existingId, data);
    }

    const contentType = this.headers.get('content-type') ?? '';
    if (!contentType.includes('json')) {
      return data;
    }

    const requestId = generateId();
    const declaredBytes = (() => {
      const h = this.headers.get('content-length');
      if (!h) return null;
      const n = Number(h);
      return Number.isFinite(n) ? n : null;
    })();
    captureRequest({
      id: requestId,
      url: 'response.json()',
      method: 'GET',
      status: this.status,
      responseTimeMs: 0,
      payloadBytes: declaredBytes ?? estimateBytes(data),
      timestamp: Date.now(),
      body: data,
    });
    debugLog('Response.json captured without fetch metadata', { requestId });

    return wrapJsonBody(requestId, data);
  };

  JSON.parse = function patchedJsonParse(
    text: string,
    reviver?: (this: unknown, key: string, value: unknown) => unknown,
  ): unknown {
    const parsed = originalJsonParse(text, reviver);
    if (typeof text !== 'string') return parsed;
    const trackedRequestId = getTrackedRequestIdForText(text);
    if (!trackedRequestId) return parsed;
    return wrapJsonBody(trackedRequestId, parsed);
  };

  const XHROpen = XMLHttpRequest.prototype.open;
  const XHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function patchedOpen(
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ) {
    (this as XMLHttpRequest & { __overfetchMethod?: string; __overfetchUrl?: string }).__overfetchMethod =
      method.toUpperCase();
    (this as XMLHttpRequest & { __overfetchUrl?: string }).__overfetchUrl =
      String(url);
    return XHROpen.call(this, method, url, async ?? true, username, password);
  };

  XMLHttpRequest.prototype.send = function patchedSend(
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null,
  ) {
    const start = performance.now();
    const xhr = this as XMLHttpRequest & {
      __overfetchMethod?: string;
      __overfetchUrl?: string;
    };

    debugLog('XHR started', {
      method: xhr.__overfetchMethod ?? 'GET',
      url: normalizeAbsoluteUrl(xhr.__overfetchUrl ?? ''),
    });

    this.addEventListener('load', () => {
      try {
        const absoluteUrl = normalizeAbsoluteUrl(xhr.__overfetchUrl ?? '');
        if (shouldIgnoreStaticAsset(absoluteUrl)) return;
        const contentType = this.getResponseHeader('content-type') ?? '';
        const parsed = tryParseJson(this.responseText);
        if (parsed === null) {
          debugLog('Skipping non-JSON XHR response body', {
            method: xhr.__overfetchMethod ?? 'GET',
            contentType,
            url: absoluteUrl,
            payloadBytes: bytesFromText(this.responseText),
          });
          return;
        }
        const requestId = generateId();
        captureRequest({
          id: requestId,
          url: absoluteUrl,
          method: xhr.__overfetchMethod ?? 'GET',
          status: this.status,
          responseTimeMs: Math.round(performance.now() - start),
          payloadBytes: bytesFromText(this.responseText),
          timestamp: Date.now(),
          body: parsed,
        });
        trackTextBodyRequestId(this.responseText, requestId);
        debugLog('XHR finished', {
          requestId,
          method: xhr.__overfetchMethod ?? 'GET',
          status: this.status,
          contentType,
          url: absoluteUrl,
        });
      } catch {
        // ignore
      }
    });

    return XHRSend.call(this, body);
  };

  const emitRouteChange = () => {
    postToExtension('route-changed', {
      url: window.location.href,
      path: window.location.pathname + window.location.search,
      title: document.title,
    });
    debugLog('Route changed', { href: window.location.href });
  };
  const originalPushState = history.pushState.bind(history);
  history.pushState = function patchedPushState(...args): void {
    originalPushState(...args);
    emitRouteChange();
  };
  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = function patchedReplaceState(...args): void {
    originalReplaceState(...args);
    emitRouteChange();
  };
  window.addEventListener('popstate', emitRouteChange);
  emitRouteChange();
}
