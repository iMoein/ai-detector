import { CheckCircle2, Download, ShieldCheck, X } from 'lucide-react';
import { downloadSanitized } from '../lib/sanitizeImage';
import type { ImageAnalysis, SanitizerResult } from '../types';

function size(bytes: number) {
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toLocaleString('fa-IR', { maximumFractionDigits: 2 })} مگابایت` : `${(bytes / 1024).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} کیلوبایت`;
}

export function ScrubbedDownloadModal({ result, verification, onClose }: { result: SanitizerResult; verification?: ImageAnalysis | null; onClose: () => void }) {
  const delta = result.cleanedSize - result.originalSize;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#05070a]/65 p-4 backdrop-blur-xl" role="dialog" aria-modal="true">
      <div className="app-panel max-h-[90vh] w-full max-w-[560px] overflow-auto rounded-[30px]">
        <div className="flex items-start justify-between border-b app-hairline p-5">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"><ShieldCheck className="h-5 w-5" /></span><div><h3 className="text-[15px] font-[760] tracking-[-0.02em]">فایل پاک‌سازی شد</h3><p dir="auto" className="app-muted mt-1 max-w-[360px] truncate text-[10px]">{result.fileName}</p></div></div>
          <button type="button" onClick={onClose} className="app-icon-button h-9 w-9" aria-label="بستن"><X className="h-3.5 w-3.5" /></button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-2.5"><div className="rounded-[16px] border app-hairline bg-zinc-500/[.025] p-3"><p className="app-muted text-[9px] font-bold">قبل</p><p className="mt-1 text-[13px] font-bold">{size(result.originalSize)}</p></div><div className="rounded-[16px] border app-hairline bg-zinc-500/[.025] p-3"><p className="app-muted text-[9px] font-bold">بعد</p><p className="mt-1 text-[13px] font-bold">{size(result.cleanedSize)}</p><p className="app-muted mt-1 text-[8px]">{delta === 0 ? 'بدون تغییر حجم' : `${delta > 0 ? '+' : '−'}${size(Math.abs(delta))}`}</p></div></div>

          <div><p className="app-muted mb-2 text-[9px] font-bold">موارد حذف‌شده</p><div className="space-y-1.5">{result.removedItems.length ? result.removedItems.map((item) => <div key={item} className="flex items-center gap-2 rounded-[13px] border app-hairline bg-white/30 px-3 py-2 dark:bg-white/[.015]"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /><span className="text-[10px] font-medium">{item}</span></div>) : <p className="app-muted rounded-[13px] border app-hairline p-3 text-[10px]">موردی برای حذف پیدا نشد.</p>}</div></div>

          <div className={`rounded-[16px] px-3.5 py-3 ${result.pixelDataPreserved ? 'bg-emerald-500/[.07] text-emerald-800 dark:text-emerald-200' : 'bg-amber-500/[.08] text-amber-800 dark:text-amber-200'}`}><p className="text-[11px] font-bold">{result.pixelDataPreserved ? 'کیفیت تصویر دست‌نخورده است' : result.lossless ? 'خروجی بدون فشرده‌سازی مخرب است' : 'فایل دوباره فشرده شده است'}</p><p className="mt-1 text-[9px] leading-5 opacity-80">{result.note}</p></div>

          {verification && <div className="rounded-[16px] border border-sky-500/15 bg-sky-500/[.055] p-3.5"><p className="text-[9px] font-bold text-sky-700 dark:text-sky-300">نتیجه بررسی دوباره</p><p className="mt-1.5 text-[12px] font-bold">{verification.detection.title}</p><p className="app-muted mt-1 text-[9px] leading-5">{verification.detection.description}</p></div>}

          <button type="button" onClick={() => downloadSanitized(result)} className="app-primary h-12 w-full px-4 text-[11px]"><Download className="h-3.5 w-3.5" />دانلود فایل پاک‌شده</button>
        </div>
      </div>
    </div>
  );
}
