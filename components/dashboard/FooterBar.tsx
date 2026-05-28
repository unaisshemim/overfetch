import { Settings } from 'lucide-react';
import { useDashboardStore } from '@/entrypoints/dashboard/store';

export function FooterBar() {
  const autoCapture = useDashboardStore((s) => s.autoCapture);
  const setAutoCapture = useDashboardStore((s) => s.setAutoCapture);

  return (
    <footer className="mt-auto border-t border-of-border bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-of-muted">
          Tip: Click on any metric to see detailed breakdown and optimization suggestions.
        </p>
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-700">
            <span>Auto-capture</span>
            <button
              type="button"
              role="switch"
              aria-checked={autoCapture}
              onClick={() => setAutoCapture(!autoCapture)}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                autoCapture ? 'bg-of-purple' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  autoCapture ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
          <button
            type="button"
            className="rounded-lg border border-of-border p-2 text-of-muted transition hover:bg-gray-50 hover:text-gray-900"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </footer>
  );
}
