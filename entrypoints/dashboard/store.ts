import {
  Activity,
  FileCode2,
  Gauge,
  Globe,
  Layers,
  Zap,
} from 'lucide-react';
import { create } from 'zustand';
import { formatBytes } from '@/lib/analyzer';
import type { SessionDashboardSnapshot } from '@/lib/session';
import { formatSessionTime } from '@/lib/session';
import type { CapturedEndpoint, UnusedField as SessionUnusedField } from '@/lib/session';
import type { AnalyzedRequest, AnalyticsSummary } from '@/lib/types';
import type {
  CapturedPage,
  DashboardMetric,
  DashboardNavTab,
  HeroData,
  SessionDiagnosis,
  TimelineStep,
  TrackingSession,
  DomainSessionSummary,
  UnusedEndpoint,
  UnusedField,
} from './types';

export type PagesViewMode = 'list' | 'detail';

interface DashboardState {
  activeTab: DashboardNavTab;
  refreshing: boolean;
  autoCapture: boolean;
  compareWithPrevious: boolean;
  pagesView: PagesViewMode;
  selectedVisitedPage: string | null;
  selectedPageId: string | null;
  session: TrackingSession | null;
  summary: DomainSessionSummary | null;
  hero: HeroData | null;
  metrics: DashboardMetric[];
  capturedPages: CapturedPage[];
  endpoints: UnusedEndpoint[];
  unusedFields: UnusedField[];
  sessionEndpoints: CapturedEndpoint[];
  sessionUnusedFields: SessionUnusedField[];
  analyzedRequests: AnalyzedRequest[];
  analyticsSummary: AnalyticsSummary | null;
  diagnosis: SessionDiagnosis;
  timeline: TimelineStep[];
  setActiveTab: (tab: DashboardNavTab) => void;
  setRefreshing: (value: boolean) => void;
  setAutoCapture: (value: boolean) => void;
  setCompareWithPrevious: (value: boolean) => void;
  setSelectedVisitedPage: (value: string | null) => void;
  openPageDetail: (pageId: string) => void;
  closePageDetail: () => void;
  setTabAnalytics: (
    requests: AnalyzedRequest[],
    summary: AnalyticsSummary | null,
  ) => void;
  hydrateFromSessionSnapshot: (snapshot: SessionDashboardSnapshot) => void;
  resetSessionView: () => void;
}

const emptyDiagnosis: SessionDiagnosis = {
  topWasteEndpoint: null,
  topWasteEndpointUnusedLabel: null,
  largestUnusedField: null,
  fullyUnusedEndpointCount: 0,
};

function buildMetrics(
  summary: DomainSessionSummary,
  domain: string,
): DashboardMetric[] {
  return [
    {
      id: 'pages',
      title: 'Pages Visited',
      value: String(summary.pagesVisited),
      helper: 'After tracking started',
      icon: Globe,
      accent: 'purple',
    },
    {
      id: 'calls',
      title: 'API Calls',
      value: String(summary.apiCalls),
      helper: `From ${domain}`,
      icon: Activity,
      accent: 'neutral',
    },
    {
      id: 'payload',
      title: 'Total Payload',
      value: formatBytes(summary.totalPayloadBytes),
      helper: 'Data returned by APIs',
      icon: Layers,
      accent: 'neutral',
    },
    {
      id: 'used',
      title: 'Used by UI',
      value: formatBytes(summary.usedBytes),
      helper: `${summary.usedFields} fields rendered`,
      icon: Zap,
      accent: 'used',
    },
    {
      id: 'wasted',
      title: 'Wasted',
      value: formatBytes(summary.wastedBytes),
      helper: `${summary.wastePercentage}% unused`,
      icon: FileCode2,
      accent: 'waste',
    },
    {
      id: 'efficiency',
      title: 'Efficiency Score',
      value: `${summary.efficiencyScore} / 100`,
      helper: 'For this domain session',
      icon: Gauge,
      accent: 'purple',
    },
  ];
}

function buildHero(summary: DomainSessionSummary): HeroData {
  return {
    wastePercent: summary.wastePercentage,
    wastedLabel: formatBytes(summary.wastedBytes),
    apiCallsOnPage: summary.apiCalls,
    domain: summary.domain,
    totalPayloadLabel: formatBytes(summary.totalPayloadBytes),
    usedPayloadLabel: formatBytes(summary.usedBytes),
    removableLabel: formatBytes(summary.wastedBytes),
  };
}

function buildTimeline(
  session: TrackingSession,
  summary: DomainSessionSummary,
  pages: CapturedPage[],
): TimelineStep[] {
  const primaryPage = pages[0];
  const pageLabel = primaryPage
    ? `${session.domain}${primaryPage.path}`
    : session.domain;

  return [
    { id: 'start', label: 'Tracking started' },
    { id: 'page', label: pageLabel },
    { id: 'calls', label: `${summary.apiCalls} API calls` },
    { id: 'payload', label: `${formatBytes(summary.totalPayloadBytes)} returned` },
    { id: 'waste', label: `${summary.wastePercentage}% wasted` },
  ];
}

export const useDashboardStore = create<DashboardState>((set) => ({
  activeTab: 'overview',
  refreshing: false,
  autoCapture: true,
  compareWithPrevious: false,
  pagesView: 'list',
  selectedVisitedPage: null,
  selectedPageId: null,
  session: null,
  summary: null,
  hero: null,
  metrics: [],
  capturedPages: [],
  endpoints: [],
  unusedFields: [],
  sessionEndpoints: [],
  sessionUnusedFields: [],
  analyzedRequests: [],
  analyticsSummary: null,
  diagnosis: emptyDiagnosis,
  timeline: [],

  setActiveTab: (activeTab) => set({ activeTab }),
  setRefreshing: (refreshing) => set({ refreshing }),
  setAutoCapture: (autoCapture) => set({ autoCapture }),
  setCompareWithPrevious: (compareWithPrevious) => set({ compareWithPrevious }),
  setSelectedVisitedPage: (selectedVisitedPage) => set({ selectedVisitedPage }),
  openPageDetail: (pageId) =>
    set({ selectedPageId: pageId, pagesView: 'detail', selectedVisitedPage: null }),
  closePageDetail: () => set({ pagesView: 'list', selectedPageId: null }),
  setTabAnalytics: (analyzedRequests, analyticsSummary) =>
    set({ analyzedRequests, analyticsSummary }),

  hydrateFromSessionSnapshot: (snapshot) => {
    if (!snapshot.session || !snapshot.summary) {
      set({
        session: snapshot.session,
        summary: null,
        hero: null,
        metrics: [],
        capturedPages: [],
        endpoints: [],
        unusedFields: [],
        sessionEndpoints: [],
        sessionUnusedFields: [],
        diagnosis: snapshot.diagnosis,
        timeline: [],
        pagesView: 'list',
        selectedPageId: null,
      });
      return;
    }

    const { session, summary } = snapshot;

    set({
      session,
      summary,
      hero: buildHero(summary),
      metrics: buildMetrics(summary, session.domain),
      capturedPages: snapshot.pages,
      sessionEndpoints: snapshot.endpoints,
      sessionUnusedFields: snapshot.unusedFields,
      endpoints: snapshot.endpoints.slice(0, 8).map((endpoint) => ({
        method: endpoint.method,
        path: endpoint.path,
        wastedLabel: `${formatBytes(endpoint.wastedBytes)} wasted`,
        wastePercent: endpoint.wastePercentage,
      })),
      unusedFields: snapshot.unusedFields.slice(0, 6).map((field) => ({
        path: field.path,
        type: field.type,
        wastedLabel: formatBytes(field.wastedBytes),
      })),
      diagnosis: snapshot.diagnosis,
      timeline: buildTimeline(session, summary, snapshot.pages),
      analyticsSummary: snapshot.analytics,
    });
  },

  resetSessionView: () => {
    set({
      session: null,
      summary: null,
      hero: null,
      metrics: [],
      capturedPages: [],
      endpoints: [],
      unusedFields: [],
      sessionEndpoints: [],
      sessionUnusedFields: [],
      analyzedRequests: [],
      analyticsSummary: null,
      diagnosis: emptyDiagnosis,
      timeline: [],
      pagesView: 'list',
      selectedPageId: null,
    });
  },
}));

export function sessionStartedLabel(session: TrackingSession): string {
  return formatSessionTime(session.startedAt);
}
