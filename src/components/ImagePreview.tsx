import { FileImage, ImageIcon, Maximize2 } from 'lucide-react';
import type { ImageAnalysis } from '../types';

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('fa-IR')} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('fa-IR', { maximumFractionDigits: 2 })} MB`;
}

export function ImagePreview({ analysis }: { analysis: ImageAnalysis }) {
  return (
    <section className="app-panel overflow-hidden rounded-[26px]">
      <div className="flex items-center justify-between border-b app-hairline px-4 py-3.5">
        <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"><ImageIcon className="h-3.5 w-3.5" /></span><div><p className="text-[12px] font-bold">پیش‌نمایش فایل</p><p className="app-muted mt-0.5 text-[9px]">تصویر اصلی تحلیل‌شده</p></div></div>
        <Maximize2 className="app-muted h-3.5 w-3.5" />
      </div>

      <div className="relative flex min-h-[350px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_38%,rgba(148,163,184,.12),transparent_55%),linear-gradient(145deg,rgba(148,163,184,.04),transparent)] p-5 sm:min-h-[470px]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(45deg,rgba(148,163,184,.03)_25%,transparent_25%,transparent_75%,rgba(148,163,184,.03)_75%),linear-gradient(45deg,rgba(148,163,184,.03)_25%,transparent_25%,transparent_75%,rgba(148,163,184,.03)_75%)] bg-[length:24px_24px] bg-[position:0_0,12px_12px]" />
        <img src={analysis.previewUrl} alt={analysis.fileName} className="relative max-h-[620px] w-full rounded-[18px] object-contain shadow-[0_20px_50px_rgba(15,23,42,.14)] dark:shadow-[0_24px_60px_rgba(0,0,0,.38)]" />
        {analysis.isDemo && <span className="absolute right-4 top-4 rounded-full border border-white/15 bg-black/65 px-2.5 py-1 text-[9px] font-bold text-white shadow-lg backdrop-blur-xl">نمونه آزمایشی</span>}
      </div>

      <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-t app-hairline px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-500/[.08] text-zinc-500"><FileImage className="h-4 w-4" /></span>
          <div className="min-w-0"><p className="truncate text-[11px] font-bold" dir="auto">{analysis.fileName}</p><p className="app-muted mt-0.5 text-[9px]">{analysis.fileType || 'نوع فایل نامشخص'}</p></div>
        </div>
        <div className="text-left"><p className="text-[10px] font-bold">{analysis.width && analysis.height ? `${analysis.width.toLocaleString('fa-IR')} × ${analysis.height.toLocaleString('fa-IR')}` : '—'}</p><p className="app-muted mt-0.5 text-[9px]">{fileSize(analysis.fileSize)}</p></div>
      </div>
    </section>
  );
}
