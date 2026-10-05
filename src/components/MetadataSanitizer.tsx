import { useEffect, useMemo, useState } from 'react';
import { Check, Download, Eraser, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { analyzeImage } from '../lib/analyzeImage';
import { downloadSanitized, sanitizeImage } from '../lib/sanitizeImage';
import { ScrubbedDownloadModal } from './ScrubbedDownloadModal';
import type { ImageAnalysis, SanitizerFormat, SanitizerMode, SanitizerResult } from '../types';

const FORMATS: Array<{ value: SanitizerFormat; label: string }> = [
  { value: 'original', label: 'همان فرمت · بدون افت' },
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
];

export function MetadataSanitizer({ file, analysis }: { file: File; analysis: ImageAnalysis }) {
  const sourceSupportsLossless = /image\/(?:png|jpeg|webp)/i.test(file.type) || /\.(?:png|jpe?g|webp)$/i.test(file.name);
  const [mode, setMode] = useState<SanitizerMode>('full');
  const [format, setFormat] = useState<SanitizerFormat>(() => sourceSupportsLossless ? 'original' : 'png');
  const [quality, setQuality] = useState(100);
  const [busy, setBusy] = useState<'download' | 'verify' | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SanitizerResult | null>(null);
  const [verification, setVerification] = useState<ImageAnalysis | null>(null);

  useEffect(() => () => { if (verification?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(verification.previewUrl); }, [verification]);

  const directLossless = format === 'original';
  const lossy = format === 'jpeg' || format === 'webp';
  const helper = useMemo(() => {
    if (directLossless) return 'فقط متادیتا حذف می‌شود؛ داده‌ی تصویری دوباره فشرده نمی‌شود.';
    if (format === 'png') return 'تصویر از روی پیکسل‌ها بازسازی می‌شود و فشرده‌سازی مخرب ندارد.';
    return 'با تغییر فرمت، تصویر دوباره کدگذاری می‌شود و ممکن است افت بسیار کمی داشته باشد.';
  }, [directLossless, format]);

  const run = async (action: 'download' | 'verify') => {
    setBusy(action); setError('');
    try {
      const cleaned = await sanitizeImage(file, analysis, { mode, format, quality });
      if (verification?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(verification.previewUrl);
      setVerification(null);
      setResult(cleaned);
      if (action === 'download') downloadSanitized(cleaned);
      else {
        const cleanedFile = new File([cleaned.blob], cleaned.fileName, { type: cleaned.mimeType });
        setVerification(await analyzeImage(cleanedFile));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'پاک‌سازی فایل انجام نشد.');
    } finally { setBusy(null); }
  };

  return (
    <>
      <section className="app-panel relative overflow-hidden rounded-[26px]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-emerald-500/[.07] to-transparent" />
        <div className="relative flex items-start justify-between gap-4 border-b app-hairline px-4 py-4">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"><Eraser className="h-4.5 w-4.5" /></span>
            <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-[13px] font-bold">نسخه‌ی پاک و بدون متادیتا</h3><span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">LOCAL ONLY</span></div><p className="app-muted mt-1 text-[10px] leading-5">ردپای AI، EXIF، Prompt، Workflow و C2PA را از نسخه خروجی حذف کن.</p></div>
          </div>
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
        </div>

        <div className="relative space-y-4 p-4">
          <div>
            <div className="app-muted mb-2 text-[9px] font-bold">نوع پاک‌سازی</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setMode('full')} className={`relative rounded-[16px] border p-3 text-right transition-all ${mode === 'full' ? 'border-emerald-500/35 bg-emerald-500/[.06] shadow-[inset_0_0_0_1px_rgba(16,185,129,.05)]' : 'app-hairline bg-white/35 hover:bg-zinc-500/[.025] dark:bg-white/[.015]'}`}>
                {mode === 'full' && <Check className="absolute left-3 top-3 h-3.5 w-3.5 text-emerald-600" />}
                <p className="text-[11px] font-bold">پاک‌سازی کامل</p><p className="app-muted mt-1 max-w-[90%] text-[9px] leading-4">تمام متادیتا و اطلاعات جانبی حذف شوند.</p>
              </button>
              <button type="button" disabled={format !== 'original'} onClick={() => setMode('ai-only')} className={`relative rounded-[16px] border p-3 text-right transition-all disabled:cursor-not-allowed disabled:opacity-40 ${mode === 'ai-only' ? 'border-emerald-500/35 bg-emerald-500/[.06]' : 'app-hairline bg-white/35 hover:bg-zinc-500/[.025] dark:bg-white/[.015]'}`}>
                {mode === 'ai-only' && <Check className="absolute left-3 top-3 h-3.5 w-3.5 text-emerald-600" />}
                <p className="flex items-center gap-1.5 text-[11px] font-bold"><Sparkles className="h-3 w-3" />فقط ردپای AI</p><p className="app-muted mt-1 max-w-[90%] text-[9px] leading-4">فقط بخش‌های مرتبط با هوش مصنوعی حذف شوند.</p>
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="app-muted mb-1.5 block text-[9px] font-bold">فرمت خروجی</span><select value={format} onChange={(event) => { const next = event.target.value as SanitizerFormat; setFormat(next); if (next !== 'original') setMode('full'); }} className="w-full rounded-[13px] border app-hairline bg-zinc-500/[.035] px-3 py-2.5 text-[11px] font-medium outline-none transition focus:border-indigo-400/40 dark:bg-white/[.025]">{FORMATS.map((item) => <option key={item.value} value={item.value} disabled={item.value === 'original' && !sourceSupportsLossless}>{item.label}{item.value === 'original' && !sourceSupportsLossless ? ' · در دسترس نیست' : ''}</option>)}</select></label>
            <div className="rounded-[13px] border app-hairline bg-zinc-500/[.025] px-3 py-2.5"><div className="app-muted text-[9px] font-bold">حفظ ابعاد</div><div className="mt-1 text-[11px] font-bold">{analysis.width && analysis.height ? `${analysis.width.toLocaleString('fa-IR')} × ${analysis.height.toLocaleString('fa-IR')}` : 'ابعاد اصلی فایل'}</div></div>
          </div>

          {lossy && <label className="block"><div className="mb-2 flex items-center justify-between"><span className="app-muted text-[9px] font-bold">کیفیت خروجی</span><span className="text-[10px] font-bold">{quality.toLocaleString('fa-IR')}٪</span></div><input type="range" min="80" max="100" step="1" value={quality} onChange={(event) => setQuality(Number(event.target.value))} className="w-full accent-zinc-950 dark:accent-white" /></label>}

          <div className={`rounded-[15px] px-3 py-2.5 text-[9px] leading-5 ${directLossless ? 'bg-emerald-500/[.07] text-emerald-800 dark:text-emerald-200' : 'bg-amber-500/[.08] text-amber-800 dark:text-amber-200'}`}><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /><p>{helper}{lossy && quality === 100 ? ' کیفیت ۱۰۰٪ در JPEG/WebP الزاماً به معنی فایل پیکسل‌به‌پیکسل یکسان نیست.' : ''}</p></div></div>

          {error && <p className="rounded-xl bg-red-500/[.08] px-3 py-2 text-[10px] text-red-700 dark:text-red-300">{error}</p>}

          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={busy !== null} onClick={() => run('download')} className="app-primary h-11 px-4 text-[11px]">{busy === 'download' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}پاک کن و دانلود کن</button>
            <button type="button" disabled={busy !== null} onClick={() => run('verify')} className="app-secondary h-11 px-4 text-[11px] disabled:opacity-50">{busy === 'verify' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}پاک کن و دوباره بررسی کن</button>
          </div>
        </div>
      </section>

      {result && <ScrubbedDownloadModal result={result} verification={verification} onClose={() => { setResult(null); if (verification?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(verification.previewUrl); setVerification(null); }} />}
    </>
  );
}
