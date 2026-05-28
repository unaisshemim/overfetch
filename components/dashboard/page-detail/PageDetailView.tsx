import { useMemo, useState } from 'react';
import { useDashboardStore } from '@/entrypoints/dashboard/store';
import { buildPageDetailData } from './selectors';
import { PageDetailHeader } from './PageDetailHeader';
import { PageAnalysisTabs } from './PageAnalysisTabs';
import { fieldSelectionFromNode } from './selectors';
import type { PageAnalysisTab, PageFieldSelection, PayloadTreeNode } from './types';

export function PageDetailView() {
  const selectedPageId = useDashboardStore((s) => s.selectedPageId);
  const capturedPages = useDashboardStore((s) => s.capturedPages);
  const analyzedRequests = useDashboardStore((s) => s.analyzedRequests);
  const sessionEndpoints = useDashboardStore((s) => s.sessionEndpoints);
  const analyticsSummary = useDashboardStore((s) => s.analyticsSummary);
  const sessionUnusedFields = useDashboardStore((s) => s.sessionUnusedFields);
  const closePageDetail = useDashboardStore((s) => s.closePageDetail);

  const [analysisTab, setAnalysisTab] = useState<PageAnalysisTab>('payload');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fieldSelection, setFieldSelection] = useState<PageFieldSelection | null>(null);

  const page = capturedPages.find((p) => p.id === selectedPageId) ?? null;
  const pageIndex = page ? capturedPages.findIndex((p) => p.id === page.id) : 0;

  const detailData = useMemo(() => {
    if (!page) return null;
    return buildPageDetailData(
      page,
      analyzedRequests,
      sessionEndpoints,
      sessionUnusedFields,
      analyticsSummary,
    );
  }, [
    page,
    analyzedRequests,
    sessionEndpoints,
    sessionUnusedFields,
    analyticsSummary,
  ]);

  if (!selectedPageId || !page || !detailData) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-of-border bg-white p-10 text-sm text-of-muted">
          Select a page from the list to view detailed payload analysis.
        </div>
      </div>
    );
  }

  function handleSelectNode(node: PayloadTreeNode) {
    setFieldSelection(fieldSelectionFromNode(node));
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-6">
      <PageDetailHeader
        data={detailData}
        pageIndex={Math.max(0, pageIndex)}
        onBack={closePageDetail}
      />
      <PageAnalysisTabs
        data={detailData}
        activeTab={analysisTab}
        onTabChange={setAnalysisTab}
        selectedPath={selectedPath}
        onSelectPath={setSelectedPath}
        fieldSelection={fieldSelection}
        onSelectNode={handleSelectNode}
      />
    </div>
  );
}
