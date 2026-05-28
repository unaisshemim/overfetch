interface WasteBarProps {
  percent: number;
}

export function WasteBar({ percent }: WasteBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500 transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
