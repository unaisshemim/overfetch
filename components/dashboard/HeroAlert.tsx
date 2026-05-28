import { motion } from 'framer-motion';
import logoUrl from '@/assets/logo.png';
import { CircularProgress } from './CircularProgress';
import type { HeroData } from '@/entrypoints/dashboard/types';

interface HeroAlertProps {
  data: HeroData;
}

export function HeroAlert({ data }: HeroAlertProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col gap-6 rounded-xl border border-of-purple/20 bg-gradient-to-r from-of-purple-light/60 via-white to-white p-6 shadow-sm md:flex-row md:items-center md:justify-between"
    >
      <div className="flex gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl">
          <img src={logoUrl} alt="Overfetch" className="h-full w-full object-contain" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">You&apos;re overfetching</h2>
          <p className="mt-1 text-sm text-gray-600">
            Your UI uses less data than this domain&apos;s APIs return.
          </p>
          <p className="mt-2 text-sm text-gray-700">
            Since tracking started on <span className="font-medium">{data.domain}</span>, your
            APIs returned {data.totalPayloadLabel}, but your UI only used {data.usedPayloadLabel}.
            You can remove {data.removableLabel}.
          </p>
          <p className="mt-2 text-sm text-of-muted">
            <span className="font-medium text-of-waste">{data.wastedLabel} wasted</span> across{' '}
            {data.apiCallsOnPage} API calls since tracking started.
          </p>
        </div>
      </div>
      <div className="flex justify-center md:justify-end">
        <CircularProgress percent={data.wastePercent} label="Waste" />
      </div>
    </motion.section>
  );
}
