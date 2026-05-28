import { ArrowLeft, Clock, ExternalLink, Globe, Link2, Zap } from 'lucide-react';
import { formatBytes } from '@/lib/analyzer';
import { formatSessionTime } from '@/lib/session';
import type { PageDetailData } from './selectors';
import { PageMetricStrip } from './PageMetricStrip';
import { PageThumbnail } from './PageThumbnail';

interface PageDetailHeaderProps {
  data: PageDetailData;
  pageIndex: number;
  onBack: () => void;
}

export function PageDetailHeader({ data, pageIndex, onBack }: PageDetailHeaderProps) {
  const { page, avgLoadMs } = data;
  const fullUrl = page.url.startsWith('http') ? page.url : `https://${page.domain}${page.path}`;

  return (
    <header className="rounded-xl border border-of-border bg-white p-4 shadow-sm sm:p-5">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-lg border border-of-border px-3 py-1.5 text-sm font-medium text-of-purple transition hover:border-of-purple/40 hover:bg-of-purple-light/50"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Pages
      </button>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-start">
            <PageThumbnail
              title={page.title}
              imageUrl={page.thumbnail}
              index={pageIndex}
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">Page Details</h2>
              <p className="mt-1 truncate text-sm font-medium text-gray-800">{page.title}</p>
              <a
                href={fullUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate font-mono text-xs text-of-purple hover:underline"
              >
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{page.path}</span>
              </a>
              <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-of-muted">
                <div className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <dt className="sr-only">Loaded</dt>
                  <dd>Loaded {formatSessionTime(page.capturedAt)}</dd>
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  <dt className="sr-only">Load duration</dt>
                  <dd>
                    {avgLoadMs !== null ? `${avgLoadMs} ms avg` : 'Load time unavailable'}
                  </dd>
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  <dt className="sr-only">API calls</dt>
                  <dd>{page.apiCallCount} API calls</dd>
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <span className="font-medium text-gray-700">
                    {formatBytes(page.totalPayloadBytes)} total
                  </span>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start xl:w-auto xl:flex-col xl:items-end">
          <PageMetricStrip page={page} efficiencyScore={data.efficiencyScore} />
          <a
            href={fullUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-of-border bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-of-purple/40 hover:text-of-purple sm:w-auto"
          >
            <ExternalLink className="h-4 w-4" />
            Open in new tab
          </a>
        </div>
      </div>
    </header>
  );
}
