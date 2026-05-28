import { Copy, Download } from 'lucide-react';
import { formatBytes } from '@/lib/analyzer';
import { WasteBar } from '@/components/WasteBar';
import type { PageAnalysisTab } from './types';
import type { PageDetailData } from './selectors';
import { FieldDetailsPanel } from './FieldDetailsPanel';
import { PayloadTree } from './PayloadTree';
import { TopUnusedSubtrees } from './TopUnusedSubtrees';
import { UsageDonut } from './UsageDonut';
import type { PageFieldSelection, PayloadTreeNode } from './types';
import { downloadPageReport } from './exportPageReport';

const tabs: Array<{ id: PageAnalysisTab; label: string }> = [
  { id: 'payload', label: 'Payload Breakdown' },
  { id: 'api-calls', label: 'API Calls' },
  { id: 'unused-fields', label: 'Unused Fields' },
  { id: 'duplicates', label: 'Duplicates' },
];

interface PageAnalysisTabsProps {
  data: PageDetailData;
  activeTab: PageAnalysisTab;
  onTabChange: (tab: PageAnalysisTab) => void;
  selectedPath: string | null;
  onSelectPath: (path: string | null) => void;
  fieldSelection: PageFieldSelection | null;
  onSelectNode: (node: PayloadTreeNode) => void;
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-of-border bg-white p-8 text-center text-sm text-of-muted">
      {message}
    </div>
  );
}

export function PageAnalysisTabs({
  data,
  activeTab,
  onTabChange,
  selectedPath,
  onSelectPath,
  fieldSelection,
  onSelectNode,
}: PageAnalysisTabsProps) {
  const { page, requests, primaryRequest, payloadTree, duplicateGroups, unusedFields } =
    data;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-of-border/80">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`rounded-t-lg px-3 py-2 text-sm font-medium transition sm:px-4 ${
                active
                  ? 'border border-b-0 border-of-border bg-white text-of-purple shadow-sm'
                  : 'text-of-muted hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'payload' ? (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.75fr)]">
            <PayloadTree
              nodes={payloadTree}
              selectedPath={selectedPath}
              onSelect={(node) => {
                onSelectNode(node);
                onSelectPath(node.path);
              }}
            />
            <FieldDetailsPanel selection={fieldSelection} primaryRequest={primaryRequest} />
            <div className="flex flex-col gap-4">
              <UsageDonut usedBytes={page.usedBytes} wastedBytes={page.wastedBytes} />
              <TopUnusedSubtrees items={data.topUnusedSubtrees} />
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-of-border bg-of-purple-light/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-700">
              <span className="font-semibold text-of-used">Green</span> fields are used by the UI.{' '}
              <span className="font-semibold text-of-waste">Red</span> fields are unused payload.{' '}
              <span className="font-semibold text-of-muted">Gray</span> indicates unknown usage.
            </p>
            <button
              type="button"
              onClick={() => downloadPageReport(data)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-of-purple px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-of-purple-dark"
            >
              <Download className="h-4 w-4" />
              Export this page report
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'api-calls' ? (
        requests.length === 0 ? (
          <EmptyTab message="No API calls captured for this page yet." />
        ) : (
          <div className="space-y-2">
            {requests.map((request) => (
              <div
                key={request.id}
                className="grid gap-3 rounded-xl border border-of-border bg-white p-4 shadow-sm sm:grid-cols-[72px_minmax(0,1fr)_100px_120px_64px]"
              >
                <span className="font-mono text-xs font-bold text-of-purple">{request.method}</span>
                <span className="truncate font-mono text-xs text-gray-900">{request.path}</span>
                <span className="text-xs text-gray-600">{formatBytes(request.payloadBytes)}</span>
                <div>
                  <span className="mb-1 flex justify-between text-[11px]">
                    <span className="font-semibold text-of-waste">{request.wastePercent}% unused</span>
                    <span className="text-of-muted">{request.efficiencyScore}/100</span>
                  </span>
                  <WasteBar percent={request.wastePercent} />
                </div>
                <span className="text-right text-xs text-gray-600">{request.status}</span>
              </div>
            ))}
          </div>
        )
      ) : null}

      {activeTab === 'unused-fields' ? (
        unusedFields.length === 0 ? (
          <EmptyTab message="No unused fields detected on this page." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unusedFields.map((field) => (
              <div
                key={`${field.path}-${field.endpointPath}`}
                className="rounded-xl border border-of-border bg-white p-4 shadow-sm"
              >
                <p className="font-mono text-sm font-semibold text-gray-900">{field.path}</p>
                <p className="mt-1 truncate font-mono text-xs text-of-muted">{field.endpointPath}</p>
                <p className="mt-2 text-sm font-semibold text-of-waste">
                  {formatBytes(field.wastedBytes)} unused
                </p>
              </div>
            ))}
          </div>
        )
      ) : null}

      {activeTab === 'duplicates' ? (
        duplicateGroups.length === 0 ? (
          <EmptyTab message="No duplicate API calls detected on this page." />
        ) : (
          <div className="space-y-3">
            {duplicateGroups.map((group) => (
              <div
                key={group.key}
                className="rounded-xl border border-orange-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 font-mono text-sm font-semibold">
                  <Copy className="h-4 w-4 text-orange-600" />
                  {group.method} {group.path}
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  Called {group.count} times, transferring {formatBytes(group.totalBytes)} total.
                </p>
              </div>
            ))}
          </div>
        )
      ) : null}
    </section>
  );
}
