import { useRef, useState } from 'react';
import { Check, FileImage, Images, LockKeyhole, UploadCloud } from 'lucide-react';
import type { AnalysisProgress } from '../types';

const ACCEPT = '.jpg,.jpeg,.png,.webp,.tiff,.tif,.avif,image/jpeg,image/png,image/webp,image/tiff,image/avif';
const STAGES: Array<{ key: AnalysisProgress['stage']; label: string; at: number }> = [
  { key: 'reading', label: 'خواندن فایل', at: 1 },
  { key: 'metadata', label: 'متادیتا', at: 36 },
  { key: 'provenance', label: 'C2PA', at: 50 },
  { key: 'detection', label: 'تحلیل', at: 88 },
];

export function Dropzone({ onFile, busy, progress }: { onFile: (file: File) => void; busy?: boolean; progress?: AnalysisProgress | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const pick = (file?: File) => { if (file && !busy) onFile(file); };
  const percent = Math.max(0, Math.min(100, progress?.percent ?? 0));

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => { if (!busy) inputRef.current?.click(); }}
      onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); pick(event.dataTransfer.files?.[0]); }}
      className={`app-panel group relative w-full overflow-hidden rounded-[30px] p-[1px] text-center transition-all duration-300 disabled:cursor-default ${dragging ? 'scale-[1.01] shadow-[0_26px_80px_rgba(99,102,241,.16)]' : busy ? 'shadow-[0_24px_70px_rgba(99,102,241,.09)]' : 'hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]'}`}
    >
      <input ref={inputRef} className="hidden" type="file" accept={ACCEPT} onChange={(event) => pick(event.target.files?.[0])} />
      <div className={`relative overflow-hidden rounded-[29px] border border-dashed px-5 py-10 transition-colors sm:px-10 sm:py-14 ${busy ? 'border-indigo-400/35 bg-indigo-500/[.025]' : dragging ? 'border-indigo-400/70 bg-indigo-500/[.055]' : 'border-zinc-300/80 bg-white/45 dark:border-white/10 dark:bg-white/[.015]'}`}>
        <div className="pointer-events-none absolute inset-x-[15%] top-0 h-28 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,.12),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        {busy && <div className="pointer-events-none absolute inset-x-8 top-0 h-24 bg-gradient-to-b from-transparent via-indigo-400/10 to-transparent [animation:scan-line_1.8s_ease-in-out_infinite]" />}

        <div className="relative mx-auto flex max-w-xl flex-col items-center">
          <div className={`relative mb-5 flex h-[66px] w-[66px] items-center justify-center rounded-[22px] border shadow-[0_12px_30px_rgba(15,23,42,.08)] transition-all duration-300 dark:shadow-black/20 ${busy ? 'border-indigo-300/70 bg-indigo-600 text-white dark:border-indigo-500' : dragging ? 'border-indigo-300 bg-indigo-600 text-white dark:border-indigo-500' : 'app-hairline bg-white text-zinc-900 group-hover:-translate-y-1 dark:bg-zinc-900 dark:text-white'}`}>
            {busy ? <FileImage className="h-6 w-6 animate-pulse" /> : <UploadCloud className="h-6 w-6" strokeWidth={1.9} />}
            {!busy && <span className="absolute -bottom-1 -left-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-zinc-950 text-white dark:border-zinc-900 dark:bg-white dark:text-zinc-950"><Images className="h-3 w-3" /></span>}
          </div>

          <h2 className="text-[17px] font-[720] tracking-[-0.02em] sm:text-[19px]">{busy ? progress?.label ?? 'در حال تحلیل تصویر…' : dragging ? 'فایل را رها کن' : 'تصویر را برای بررسی انتخاب کن'}</h2>
          <p className="app-muted mt-2 max-w-md text-[12px] leading-6 sm:text-[13px]">{busy ? progress?.detail ?? 'فایل در حال بررسی است.' : 'فایل را اینجا بکش یا برای انتخاب از دستگاه کلیک کن'}</p>

          {busy ? (
            <div className="mt-6 w-full max-w-lg" aria-live="polite" aria-label={`${percent} درصد پیشرفت تحلیل`}>
              <div className="mb-2.5 flex items-center justify-between gap-3 text-[11px] font-semibold">
                <span className="app-muted">پیشرفت تحلیل</span>
                <span className="tabular-nums text-zinc-800 dark:text-zinc-100">{percent.toLocaleString('fa-IR')}٪</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-white/[.08]">
                <div className="relative h-full rounded-full bg-gradient-to-l from-indigo-500 via-violet-500 to-fuchsia-500 transition-[width] duration-300 ease-out" style={{ width: `${Math.max(2, percent)}%` }}>
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/45 to-transparent [animation:progress-sheen_1.5s_ease-in-out_infinite]" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {STAGES.map((stage) => {
                  const done = percent > stage.at + 8 || progress?.stage === 'complete';
                  const active = progress?.stage === stage.key;
                  return <div key={stage.key} className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[9px] font-semibold transition-colors ${active ? 'border-indigo-400/35 bg-indigo-500/[.07] text-indigo-700 dark:text-indigo-300' : done ? 'app-hairline bg-white/50 text-emerald-700 dark:bg-white/[.02] dark:text-emerald-300' : 'app-hairline app-muted bg-white/30 dark:bg-white/[.015]'}`}>
                    {done ? <Check className="h-3 w-3" /> : <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-indigo-500 animate-pulse' : 'bg-zinc-300 dark:bg-zinc-700'}`} />}
                    <span>{stage.label}</span>
                  </div>;
                })}
              </div>
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
              {['JPG', 'PNG', 'WebP', 'TIFF', 'AVIF'].map((format) => <span key={format} className="app-muted rounded-lg border app-hairline bg-white/50 px-2 py-1 text-[9px] font-bold tracking-wide dark:bg-white/[.025]">{format}</span>)}
            </div>
          )}

          <div className="app-muted mt-5 flex items-center gap-1.5 text-[10px] font-medium"><LockKeyhole className="h-3 w-3" />فایل از مرورگر شما خارج نمی‌شود</div>
        </div>
      </div>
    </button>
  );
}
