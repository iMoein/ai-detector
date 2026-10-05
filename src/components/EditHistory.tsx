import { BadgeCheck, Clock3, WandSparkles } from 'lucide-react';
import type { ImageAnalysis } from '../types';

function validationLabel(value?: string) {
  if (value === 'Trusted') return 'معتبر و مورد اعتماد';
  if (value === 'Valid') return 'امضا و ساختار معتبر';
  if (value === 'Invalid') return 'نامعتبر';
  return value;
}

function formatDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function EditHistory({ analysis }: { analysis: ImageAnalysis }) {
  if (analysis.editHistory.length === 0 && !analysis.c2pa?.present) return null;

  return (
    <section className="app-panel overflow-hidden rounded-[22px]">
      <div className="flex items-center justify-between border-b app-hairline px-4 py-3.5">
        <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-sky-500/10 text-sky-600 dark:text-sky-300"><Clock3 className="h-3.5 w-3.5" /></span><div><h3 className="text-[12px] font-bold">سابقه ساخت و ویرایش</h3><p className="app-muted mt-0.5 text-[9px]">رویدادهای ثبت‌شده داخل Content Credentials و متادیتا</p></div></div>
        {analysis.c2pa?.present && <BadgeCheck className="h-4 w-4 text-sky-500" />}
      </div>

      {analysis.c2pa?.present && <div className="flex flex-wrap items-center gap-2 border-b app-hairline bg-sky-500/[.035] px-4 py-2.5 text-[9px]">
        <span className="font-bold text-sky-700 dark:text-sky-300">Content Credentials پیدا شد</span>
        {analysis.c2pa.validationState && <span className="rounded-full border app-hairline bg-white/50 px-2 py-0.5 font-semibold text-zinc-600 dark:bg-white/[.025] dark:text-zinc-300">{validationLabel(analysis.c2pa.validationState)}</span>}
      </div>}

      {analysis.editHistory.length > 0 ? <ol className="relative px-4 py-2">
        <span className="absolute bottom-6 right-[31px] top-6 w-px bg-zinc-900/[.08] dark:bg-white/[.08]" />
        {analysis.editHistory.map((event, index) => <li key={`${event.action}-${event.when ?? index}`} className="relative flex gap-3 py-3">
          <span className={`relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-4 border-[var(--surface-solid)] ${event.aiRelated ? 'bg-violet-500 text-white' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200'}`}><WandSparkles className="h-3 w-3" /></span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-1.5"><p className="text-[11px] font-bold">{event.title}</p>{event.aiRelated && <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[8px] font-bold text-violet-700 dark:text-violet-300">مرتبط با AI</span>}</div>
            {event.description && <p className="app-muted mt-1 text-[9px] leading-5">{event.description}</p>}
            <div className="app-muted mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[8px] font-medium">{event.software && <span>{event.software}</span>}{formatDate(event.when) && <span>{formatDate(event.when)}</span>}</div>
          </div>
        </li>)}
      </ol> : <p className="app-muted px-4 py-4 text-[10px] leading-5">Content Credentials داخل فایل وجود دارد، اما رویداد قابل نمایشی پیدا نشد.</p>}
    </section>
  );
}
