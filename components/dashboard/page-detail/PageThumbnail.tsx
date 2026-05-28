interface PageThumbnailProps {
  title: string;
  imageUrl?: string;
  index?: number;
}

export function PageThumbnail({ title, imageUrl, index = 0 }: PageThumbnailProps) {
  const accent = ['bg-indigo-500', 'bg-purple-500', 'bg-violet-500', 'bg-blue-500'][
    index % 4
  ];

  if (imageUrl) {
    return (
      <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-of-border bg-white shadow-sm sm:h-24 sm:w-32">
        <img src={imageUrl} alt={title} className="h-full w-full object-cover object-top" />
      </div>
    );
  }

  return (
    <div className="h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-of-border bg-white shadow-sm sm:h-24 sm:w-32">
      <div className="flex h-full">
        <div className="w-5 bg-slate-900/90 p-1">
          <div className="space-y-1">
            <div className="h-1 w-full rounded bg-slate-600" />
            <div className="h-1 w-3 rounded bg-slate-500" />
            <div className="h-1 w-4 rounded bg-slate-700" />
          </div>
        </div>
        <div className="flex-1 bg-white p-1.5">
          <div className={`h-2 w-8 rounded ${accent}`} />
          <div className="mt-1.5 grid grid-cols-2 gap-1">
            <div className="h-2 rounded bg-slate-100" />
            <div className="h-2 rounded bg-slate-100" />
            <div className="col-span-2 h-4 rounded bg-slate-100" />
          </div>
          <div className="mt-1 h-1 w-full rounded bg-emerald-300" />
        </div>
      </div>
    </div>
  );
}
