import { motion } from 'framer-motion';
import { useDashboardStore } from '@/entrypoints/dashboard/store';
import { CapturedPagesTable } from './CapturedPagesTable';
import { EndpointWasteList } from './EndpointWasteList';
import { FooterBar } from './FooterBar';
import { HeroAlert } from './HeroAlert';
import { MetricsRow } from './MetricsRow';
import { OverviewEmptyState } from './OverviewEmptyState';
import { ReadingTimeline } from './ReadingTimeline';
import { SessionDiagnosisCard } from './SessionDiagnosisCard';
import { SessionHeader } from './SessionHeader';
import { UnusedFieldList } from './UnusedFieldList';

interface OverviewPageProps {
  onRefresh: () => void;
  onReset: () => void;
  onViewPageDetails?: () => void;
}

export function OverviewPage({
  onRefresh,
  onReset,
  onViewPageDetails,
}: OverviewPageProps) {
  const session = useDashboardStore((s) => s.session);
  const summary = useDashboardStore((s) => s.summary);
  const hero = useDashboardStore((s) => s.hero);
  const metrics = useDashboardStore((s) => s.metrics);
  const capturedPages = useDashboardStore((s) => s.capturedPages);
  const endpoints = useDashboardStore((s) => s.endpoints);
  const unusedFields = useDashboardStore((s) => s.unusedFields);
  const timeline = useDashboardStore((s) => s.timeline);
  const setActiveTab = useDashboardStore((s) => s.setActiveTab);

  const hasSessionData = !!session && !!summary && !!hero;

  if (!hasSessionData) {
    return (
      <div className="flex min-h-full flex-col">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="mx-auto w-full max-w-7xl px-6 py-6"
        >
          <OverviewEmptyState />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="mx-auto w-full max-w-7xl space-y-6 px-6 py-6"
      >
        <SessionHeader onRefresh={onRefresh} onReset={onReset} />
        <HeroAlert data={hero} />
        <MetricsRow metrics={metrics} />
        <CapturedPagesTable
          pages={capturedPages}
          onViewPage={() => {
            setActiveTab('requests');
            onViewPageDetails?.();
          }}
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <SessionDiagnosisCard
            onGenerateFix={() => setActiveTab('unused-fields')}
            onViewRawPayload={() => setActiveTab('requests')}
          />
          <ReadingTimeline steps={timeline} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <EndpointWasteList endpoints={endpoints} />
          <UnusedFieldList fields={unusedFields} />
        </div>
      </motion.div>
      <FooterBar />
    </div>
  );
}
