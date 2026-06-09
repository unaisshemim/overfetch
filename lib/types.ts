export const PAGE_MESSAGE_SOURCE = 'overfetch-page' as const;
export const EXT_MESSAGE_SOURCE = 'overfetch-extension' as const;

export type PageMessageType =
  | 'request-captured'
  | 'field-accessed'
  | 'route-changed';

export interface PageMessageBase {
  source: typeof PAGE_MESSAGE_SOURCE;
  type: PageMessageType;
}

export interface RequestCapturedPayload {
  id: string;
  url: string;
  method: string;
  status: number;
  responseTimeMs: number;
  payloadBytes: number;
  timestamp: number;
  shape: FieldShape;
}

export interface FieldAccessedPayload {
  requestId: string;
  path: string;
}

export interface PageRouteChangedPayload {
  url: string;
  path: string;
  title: string;
}

export type FieldShape =
  | { type: 'primitive'; primitive: string }
  | { type: 'object'; keys: string[]; children?: Record<string, FieldShape> }
  | { type: 'array'; itemShape?: FieldShape };

export interface PageRequestCapturedMessage extends PageMessageBase {
  type: 'request-captured';
  payload: RequestCapturedPayload;
}

export interface PageFieldAccessedMessage extends PageMessageBase {
  type: 'field-accessed';
  payload: FieldAccessedPayload;
}

export interface PageRouteChangedMessage extends PageMessageBase {
  type: 'route-changed';
  payload: PageRouteChangedPayload;
}

export type PageMessage =
  | PageRequestCapturedMessage
  | PageFieldAccessedMessage
  | PageRouteChangedMessage;

export type BackgroundMessageType =
  | 'snapshot'
  | 'state-update'
  | 'get-snapshot'
  | 'popup-get-summary'
  | 'clear-all-data'
  | 'dashboard-get-snapshot'
  | 'dashboard-refresh-snapshot'
  | 'dashboard-rebuild-snapshot'
  | 'clear-tab'
  | 'get-reading-session'
  | 'dashboard-get-session-snapshot'
  | 'dashboard-reset-session'
  | 'reset-session'
  | 'enable-capture';

export interface AnalyzedRequest {
  id: string;
  url: string;
  path: string;
  method: string;
  status: number;
  responseTimeMs: number;
  payloadBytes: number;
  timestamp: number;
  shape: FieldShape;
  usedPaths: string[];
  unusedPaths: string[];
  usedBytes: number;
  wastedBytes: number;
  wastePercent: number;
  efficiencyScore: number;
  duplicateCount: number;
}

export interface TabAnalyticsState {
  tabId: number;
  requests: AnalyzedRequest[];
  updatedAt: number;
}

export interface AnalyticsSummary {
  totalRequests: number;
  totalPayloadBytes: number;
  usedBytes: number;
  wastedBytes: number;
  wastePercent: number;
  efficiencyScore: number;
  duplicateGroups: DuplicateGroup[];
  topEndpointsByWaste: AnalyzedRequest[];
  worstEndpoint: AnalyzedRequest | null;

  // Aggregate field counts (estimated from captured JSON shapes)
  totalFields: number;
  usedFields: number;

  // For the popup: top unused paths for the worst endpoint.
  biggestUnusedFields: Array<{
    path: string;
    wastedBytes: number;
  }>;
}

export interface DuplicateGroup {
  key: string;
  method: string;
  path: string;
  count: number;
  totalBytes: number;
  requestIds: string[];
}

export type PanelTab = 'overview' | 'requests' | 'endpoints' | 'duplicates' | 'settings';
export type EndpointTab =
  | 'overview'
  | 'payload'
  | 'used'
  | 'unused'
  | 'optimization';

export interface BackgroundSnapshotMessage {
  type: 'snapshot';
  tabId: number;
  state: TabAnalyticsState;
  summary: AnalyticsSummary;
}

export interface BackgroundStateUpdateMessage {
  type: 'state-update';
  tabId: number;
  state: TabAnalyticsState;
  summary: AnalyticsSummary;
}

export interface BackgroundGetSnapshotMessage {
  type: 'get-snapshot';
  tabId: number;
}

export interface PopupGetSummaryMessage {
  type: 'popup-get-summary';
  tabId: number;
}

export interface BackgroundClearAllDataMessage {
  type: 'clear-all-data';
}

export interface DashboardGetSnapshotMessage {
  type: 'dashboard-get-snapshot';
  tabId: number;
}

export interface DashboardRefreshSnapshotMessage {
  type: 'dashboard-refresh-snapshot';
  tabId: number;
}

export interface DashboardRebuildSnapshotMessage {
  type: 'dashboard-rebuild-snapshot';
  tabId: number;
}

export interface BackgroundClearTabMessage {
  type: 'clear-tab';
  tabId: number;
}

export interface GetReadingSessionMessage {
  type: 'get-reading-session';
  tabId: number;
}

export interface DashboardGetSessionSnapshotMessage {
  type: 'dashboard-get-session-snapshot';
  tabId: number;
}

export interface DashboardResetSessionMessage {
  type: 'dashboard-reset-session';
  tabId: number;
}

export interface ResetSessionMessage {
  type: 'reset-session';
  tabId: number;
}

export interface EnableCaptureMessage {
  type: 'enable-capture';
  tabId: number;
}

export type BackgroundOutboundMessage =
  | BackgroundSnapshotMessage
  | BackgroundStateUpdateMessage;

export type BackgroundInboundMessage =
  | BackgroundGetSnapshotMessage
  | PopupGetSummaryMessage
  | BackgroundClearAllDataMessage
  | DashboardGetSnapshotMessage
  | DashboardRefreshSnapshotMessage
  | DashboardRebuildSnapshotMessage
  | BackgroundClearTabMessage
  | GetReadingSessionMessage
  | DashboardGetSessionSnapshotMessage
  | DashboardResetSessionMessage
  | ResetSessionMessage
  | EnableCaptureMessage
  | PageMessage;
