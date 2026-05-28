import type { PageDetailData } from './selectors';

export function downloadPageReport(data: PageDetailData): void {
  const report = {
    exportedAt: new Date().toISOString(),
    page: {
      id: data.page.id,
      title: data.page.title,
      url: data.page.url,
      path: data.page.path,
      capturedAt: data.page.capturedAt,
      apiCallCount: data.page.apiCallCount,
      totalPayloadBytes: data.page.totalPayloadBytes,
      usedBytes: data.page.usedBytes,
      wastedBytes: data.page.wastedBytes,
      wastePercentage: data.page.wastePercentage,
      efficiencyScore: data.efficiencyScore,
      avgLoadMs: data.avgLoadMs,
    },
    requests: data.requests.map((r) => ({
      id: r.id,
      method: r.method,
      path: r.path,
      status: r.status,
      payloadBytes: r.payloadBytes,
      usedBytes: r.usedBytes,
      wastedBytes: r.wastedBytes,
      wastePercent: r.wastePercent,
      efficiencyScore: r.efficiencyScore,
      usedPaths: r.usedPaths,
      unusedPaths: r.unusedPaths,
    })),
    duplicateGroups: data.duplicateGroups,
    unusedFields: data.unusedFields,
    topUnusedSubtrees: data.topUnusedSubtrees,
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const slug = data.page.path.replace(/[^\w.-]+/g, '_').slice(0, 48) || 'page';
  anchor.href = url;
  anchor.download = `overfetch-page-report-${slug}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
