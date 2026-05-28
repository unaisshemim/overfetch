import { Braces, Check, Copy } from 'lucide-react';
import { useState } from 'react';
import type { AnalyzedRequest } from '@/lib/types';
import type { PageFieldSelection } from './types';

interface FieldDetailsPanelProps {
  selection: PageFieldSelection | null;
  primaryRequest: AnalyzedRequest | null;
}

function usageLabel(usage: PageFieldSelection['usage']): string {
  if (usage === 'used') return 'Used by UI';
  if (usage === 'unused') return 'Unused';
  return 'Unknown usage';
}

function usageBadgeClass(usage: PageFieldSelection['usage']): string {
  if (usage === 'used') return 'bg-of-used-light text-of-used';
  if (usage === 'unused') return 'bg-of-waste-light text-of-waste';
  return 'bg-gray-100 text-of-muted';
}

export function FieldDetailsPanel({ selection, primaryRequest }: FieldDetailsPanelProps) {
  const [copied, setCopied] = useState(false);

  async function copyPath() {
    if (!selection?.path) return;
    try {
      await navigator.clipboard.writeText(selection.path);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  function viewJson() {
    if (!primaryRequest) return;
    const payload = {
      path: selection?.path ?? null,
      usage: selection?.usage ?? null,
      shape: primaryRequest.shape,
      usedPaths: primaryRequest.usedPaths,
      unusedPaths: primaryRequest.unusedPaths,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  return (
    <div className="flex h-full min-h-[280px] flex-col rounded-xl border border-of-border bg-white shadow-sm">
      <div className="border-b border-of-border/80 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Field Details</h3>
      </div>
      <div className="flex flex-1 flex-col p-4">
        {!selection ? (
          <p className="text-sm text-of-muted">
            Select a field in the payload tree to inspect its path and usage status.
          </p>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-of-muted">
                  Field path
                </p>
                <p className="mt-1 break-all font-mono text-sm text-gray-900">{selection.path}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-of-muted">
                  Status
                </p>
                <span
                  className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${usageBadgeClass(selection.usage)}`}
                >
                  {usageLabel(selection.usage)}
                </span>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-of-muted">
                  Type
                </p>
                <p className="mt-1 text-sm capitalize text-gray-800">{selection.type}</p>
              </div>
            </div>
            <div className="mt-auto flex flex-wrap gap-2 pt-6">
              <button
                type="button"
                onClick={() => void copyPath()}
                disabled={!selection.path}
                className="inline-flex items-center gap-1.5 rounded-lg border border-of-border px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-of-purple/40 hover:text-of-purple disabled:opacity-50"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-of-used" /> : <Copy className="h-3.5 w-3.5" />}
                Copy path
              </button>
              <button
                type="button"
                onClick={viewJson}
                disabled={!primaryRequest}
                className="inline-flex items-center gap-1.5 rounded-lg border border-of-border px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-of-purple/40 hover:text-of-purple disabled:opacity-50"
              >
                <Braces className="h-3.5 w-3.5" />
                View JSON
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
