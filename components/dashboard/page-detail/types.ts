import type { FieldShape } from '@/lib/types';

export type FieldUsage = 'used' | 'unused' | 'unknown';

export type PageAnalysisTab = 'payload' | 'api-calls' | 'unused-fields' | 'duplicates';

export interface PayloadTreeNode {
  id: string;
  key: string;
  path: string;
  type: FieldShape['type'];
  usage: FieldUsage;
  children: PayloadTreeNode[];
}

export interface UnusedSubtreeSummary {
  path: string;
  fieldCount: number;
  wastedLabel: string;
}

export interface PageFieldSelection {
  path: string;
  usage: FieldUsage;
  type: FieldShape['type'];
  requestId?: string;
}
