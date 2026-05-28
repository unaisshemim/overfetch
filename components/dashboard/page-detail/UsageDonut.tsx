import { formatBytes } from '@/lib/analyzer';
import { PayloadDonut } from '@/components/PayloadDonut';

interface UsageDonutProps {
  usedBytes: number;
  wastedBytes: number;
}

export function UsageDonut({ usedBytes, wastedBytes }: UsageDonutProps) {
  const total = usedBytes + wastedBytes;

  return (
    <div className="rounded-xl border border-of-border bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Usage Summary</h3>
      {total <= 0 ? (
        <p className="mt-4 py-8 text-center text-xs text-of-muted">
          No payload usage data for this page yet.
        </p>
      ) : (
        <>
          <div className="mt-2">
            <PayloadDonut usedBytes={usedBytes} wastedBytes={wastedBytes} />
          </div>
          <div className="mt-2 space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-of-used">
                <span className="h-2 w-2 rounded-full bg-of-used" />
                Used by UI
              </span>
              <span className="font-medium text-gray-900">{formatBytes(usedBytes)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-of-waste">
                <span className="h-2 w-2 rounded-full bg-of-waste" />
                Unused
              </span>
              <span className="font-medium text-gray-900">{formatBytes(wastedBytes)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
