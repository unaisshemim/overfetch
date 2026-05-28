import { motion } from 'framer-motion';
import logoUrl from '@/assets/logo.png';
import { useDashboardStore } from '@/entrypoints/dashboard/store';

interface SessionDiagnosisCardProps {
  onGenerateFix?: () => void;
  onViewRawPayload?: () => void;
}

export function SessionDiagnosisCard({
  onGenerateFix,
  onViewRawPayload,
}: SessionDiagnosisCardProps) {
  const diagnosis = useDashboardStore((s) => s.diagnosis);
  const summary = useDashboardStore((s) => s.summary);

  const bullets: string[] = [];

  if (diagnosis.topWasteEndpoint) {
    bullets.push(`Most waste came from ${diagnosis.topWasteEndpoint}`);
  }
  if (diagnosis.topWasteEndpointUnusedLabel && diagnosis.topWasteEndpoint) {
    bullets.push(
      `${diagnosis.topWasteEndpointUnusedLabel} was returned but not used by the UI`,
    );
  }
  if (diagnosis.largestUnusedField) {
    bullets.push(`The ${diagnosis.largestUnusedField} field is the largest unused field`);
  }
  if (diagnosis.fullyUnusedEndpointCount > 0) {
    bullets.push(
      `${diagnosis.fullyUnusedEndpointCount} endpoint${diagnosis.fullyUnusedEndpointCount === 1 ? '' : 's'} returned 100% unused data`,
    );
  }

  if (bullets.length === 0 && summary) {
    bullets.push(
      `This domain session returned ${summary.apiCalls} API calls with ${summary.wastePercentage}% waste.`,
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.16 }}
      className="rounded-xl border border-of-border bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex h-8 w-8 overflow-hidden rounded-lg">
          <img src={logoUrl} alt="Overfetch" className="h-full w-full object-contain" />
        </span>
        <h2 className="text-base font-semibold text-gray-900">
          Why this domain session is inefficient
        </h2>
      </div>
      <ul className="space-y-2 text-sm text-gray-700">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2">
            <span className="text-of-purple">•</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onGenerateFix}
          className="rounded-lg bg-of-purple px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-of-purple-dark"
        >
          Generate Fix
        </button>
        <button
          type="button"
          onClick={onViewRawPayload}
          className="rounded-lg border border-of-border px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          View raw payload
        </button>
      </div>
    </motion.article>
  );
}
