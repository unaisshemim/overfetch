import type { LucideIcon } from 'lucide-react';
import type {
  CapturedEndpoint,
  CapturedPage,
  DomainSessionSummary,
  SessionDiagnosis,
  TrackingSession,
  UnusedField as SessionUnusedField,
} from '@/lib/session';

export type {
  CapturedEndpoint,
  CapturedPage,
  DomainSessionSummary,
  SessionDiagnosis,
  TrackingSession,
  SessionUnusedField,
};

export type DashboardNavTab =
  | 'overview'
  | 'pages'
  | 'requests'
  | 'unused-fields'
  | 'duplicates';

export interface DashboardMetric {
  id: string;
  title: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  accent?: 'purple' | 'waste' | 'used' | 'neutral';
}

export interface UnusedEndpoint {
  method: string;
  path: string;
  wastedLabel: string;
  wastePercent: number;
}

export interface UnusedField {
  path: string;
  type?: string;
  wastedLabel: string;
}

export interface HeroData {
  wastePercent: number;
  wastedLabel: string;
  apiCallsOnPage: number;
  domain: string;
  totalPayloadLabel: string;
  usedPayloadLabel: string;
  removableLabel: string;
}

export interface TimelineStep {
  id: string;
  label: string;
}

/** @deprecated Legacy pages tab — not used on Overview */
export interface DashboardPageContext {
  currentUrl: string;
  previousPageLabel: string;
  pageTrail: string;
}

/** @deprecated Legacy pages tab — not used on Overview */
export interface PageComparisonRow {
  metric: string;
  thisPage: string;
  previousPage: string;
  change: string;
  trend: 'up-bad' | 'up-good' | 'down-bad' | 'down-good' | 'neutral';
}
