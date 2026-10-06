import { useEffect, useState } from 'react';
import { BadgeCheck, Camera, Code2, LockKeyhole, Moon, PencilLine, ScanSearch, Sparkles, Sun, WandSparkles, X } from 'lucide-react';
import { Dropzone } from './components/Dropzone';
import { AiDetectorCard } from './components/AiDetectorCard';
import { ImagePreview } from './components/ImagePreview';
import { ExifTable } from './components/ExifTable';
import { RawJsonViewer } from './components/RawJsonViewer';
import { GenerationInspector } from './components/GenerationInspector';
import { EditHistory } from './components/EditHistory';
import { MetadataSanitizer } from './components/MetadataSanitizer';
import { UsageCounter } from './components/UsageCounter';
import { analyzeImage, createDemoAnalysis } from './lib/analyzeImage';
import { trackAnalysis } from './lib/stats';
import { prepareTurnstile } from './lib/turnstile';
import type { AnalysisProgress, ImageAnalysis } from './types';

function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') !== 'light');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => () => {
    if (analysis?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(analysis.previewUrl);
  }, [analysis]);

  const handleFile = async (file: File) => {
    void prepareTurnstile();
    setBusy(true);
    setProgress({ percent: 1, stage: 'reading', label: 'آماده‌سازی فایل', detail: 'شروع پردازش روی دستگاه شما' });
    setError('');
    try {
      if (analysis?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(analysis.previewUrl);
      setSourceFile(file);
      const nextAnalysis = await analyzeImage(file, setProgress);
      setAnalysis(nextAnalysis);
      void trackAnalysis(nextAnalysis.detection.kind);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'نتوانستم این تصویر را بررسی کنم.');
    } finally { setBusy(false); setProgress(null); }
  };

  const demo = (kind: 'ai' | 'edited' | 'camera') => {
    if (analysis?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(analysis.previewUrl);
    setSourceFile(null);
    setProgress(null);
    setError('');
    setAnalysis(createDemoAnalysis(kind));
  };

  const reset = () => {
    if (analysis?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(analysis.previewUrl);
    setAnalysis(null);
    setSourceFile(null);
    setProgress(null);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div dir="rtl" className="min-h-screen text-zinc-950 dark:text-zinc-50">
      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5">
        <div className="app-panel mx-auto flex max-w-[1240px] items-center justify-between rounded-[20px] px-3 py-2.5 sm:px-4">
          <button type="button" onClick={reset} className="group flex items-center gap-3 rounded-xl text-right">
            <span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-zinc-950 text-white shadow-[0_8px_24px_rgba(15,23,42,.18)] transition-transform group-hover:scale-[1.03] dark:bg-white dark:text-zinc-950">
              <ScanSearch className="h-[19px] w-[19px]" strokeWidth={2.2} />
            </span>
            <span>
              <span className="block text-[14px] font-bold tracking-[-0.01em]">بررسی تصویر</span>
              <span className="app-muted hidden text-[11px] sm:block">منبع، متادیتا و ردپای هوش مصنوعی</span>
            </span>
          </button>

          <div className="flex items-center gap-2">
            <div className="app-muted hidden items-center gap-2 rounded-full border app-hairline bg-white/40 px-3 py-2 text-[11px] font-medium dark:bg-white/[.03] md:flex">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-30" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
              پردازش خصوصی روی دستگاه شما
            </div>
            <a href="https://github.com/iMoein/ai-detector" target="_blank" rel="noreferrer" aria-label="گیت‌هاب" className="app-icon-button"><Code2 className="h-4 w-4" /></a>
            <button type="button" onClick={() => setDark((value) => !value)} aria-label="تغییر حالت روشن و تیره" className="app-icon-button">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        {!analysis ? (
          <div className="animate-fade-up">
            <section className="mx-auto max-w-[860px] text-center">
              <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border app-hairline bg-white/60 px-3 py-1.5 text-[11px] font-semibold text-zinc-600 backdrop-blur dark:bg-white/[.04] dark:text-zinc-300"><LockKeyhole className="h-3.5 w-3.5" />بدون آپلود فایل</span>
                <span className="inline-flex items-center gap-2 rounded-full border app-hairline bg-white/60 px-3 py-1.5 text-[11px] font-semibold text-zinc-600 backdrop-blur dark:bg-white/[.04] dark:text-zinc-300"><BadgeCheck className="h-3.5 w-3.5" />پشتیبانی C2PA</span>
                <span className="inline-flex items-center gap-2 rounded-full border app-hairline bg-white/60 px-3 py-1.5 text-[11px] font-semibold text-zinc-600 backdrop-blur dark:bg-white/[.04] dark:text-zinc-300"><WandSparkles className="h-3.5 w-3.5" />تشخیص AI و ویرایش AI</span>
              </div>
              <h1 className="text-balance text-[42px] font-[760] leading-[1.15] tracking-[-0.055em] text-zinc-950 sm:text-[58px] dark:text-white">
                تشخیص ردپای هوش مصنوعی در عکس، بدون آپلود فایل.
              </h1>
              <p className="app-muted mx-auto mt-5 max-w-2xl text-pretty text-[15px] leading-8 sm:text-[17px]">
                متادیتا، EXIF، اطلاعات دوربین، C2PA و Content Credentials را بررسی کن تا نشانه‌های ساخت یا ویرایش تصویر با هوش مصنوعی را ببینی؛ همه‌چیز داخل مرورگر انجام می‌شود.
              </p>
            </section>

            <div className="mx-auto mt-9 max-w-[920px]"><Dropzone onFile={handleFile} busy={busy} progress={progress} /></div>
            {error && <div className="mx-auto mt-4 max-w-[920px] rounded-2xl border border-red-200/70 bg-red-50/80 px-4 py-3 text-sm text-red-700 shadow-sm dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-300">{error}</div>}

            <section className="mx-auto mt-8 max-w-[920px]">
              <div className="mb-3 flex items-center justify-between px-1"><p className="app-muted text-xs font-medium">یا با یک نمونه آماده امتحان کن</p><p className="app-muted hidden text-[11px] sm:block">نتیجه‌ها شبیه‌سازی شده‌اند</p></div>
              <div className="grid gap-3 md:grid-cols-3">
                <button type="button" onClick={() => demo('ai')} className="app-panel group flex items-center gap-3 rounded-[20px] p-3.5 text-right transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-hover)]">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-violet-500/10 text-violet-600 dark:text-violet-300"><Sparkles className="h-[18px] w-[18px]" /></span>
                  <span><span className="block text-[13px] font-bold">ساخته‌شده با AI</span><span className="app-muted mt-1 block text-[11px]">ComfyUI + FLUX</span></span>
                </button>
                <button type="button" onClick={() => demo('edited')} className="app-panel group flex items-center gap-3 rounded-[20px] p-3.5 text-right transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-hover)]">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-amber-500/10 text-amber-600 dark:text-amber-300"><PencilLine className="h-[18px] w-[18px]" /></span>
                  <span><span className="block text-[13px] font-bold">ویرایش‌شده با AI</span><span className="app-muted mt-1 block text-[11px]">Generative Fill</span></span>
                </button>
                <button type="button" onClick={() => demo('camera')} className="app-panel group flex items-center gap-3 rounded-[20px] p-3.5 text-right transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-hover)]">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"><Camera className="h-[18px] w-[18px]" /></span>
                  <span><span className="block text-[13px] font-bold">ثبت‌شده با دوربین</span><span className="app-muted mt-1 block text-[11px]">EXIF کامل سونی</span></span>
                </button>
              </div>
            </section>

            <section aria-labelledby="how-it-works" className="mx-auto mt-16 max-w-[920px]">
              <div className="mx-auto max-w-2xl text-center">
                <h2 id="how-it-works" className="text-2xl font-[750] tracking-[-0.035em] sm:text-3xl">این ابزار دقیقاً چه چیزی را در عکس بررسی می‌کند؟</h2>
                <p className="app-muted mt-3 text-sm leading-7">به‌جای حدس از روی ظاهر تصویر، شواهدی را می‌خوانیم که داخل خود فایل ذخیره شده‌اند.</p>
              </div>
              <div className="mt-7 grid gap-3 md:grid-cols-3">
                <article className="app-panel rounded-[22px] p-5">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[13px] bg-violet-500/10 text-violet-600 dark:text-violet-300"><Sparkles className="h-[17px] w-[17px]" /></div>
                  <h3 className="text-sm font-bold">ردپای ساخت یا ویرایش با AI</h3>
                  <p className="app-muted mt-2 text-xs leading-6">پرامپت، workflow، نام مدل، نرم‌افزار سازنده و نشانه‌های ابزارهایی مثل ComfyUI، Stable Diffusion، Firefly و Midjourney بررسی می‌شوند.</p>
                </article>
                <article className="app-panel rounded-[22px] p-5">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[13px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"><Camera className="h-[17px] w-[17px]" /></div>
                  <h3 className="text-sm font-bold">EXIF و اطلاعات دوربین</h3>
                  <p className="app-muted mt-2 text-xs leading-6">مدل دوربین، لنز، ISO، سرعت شاتر، دیافراگم، تاریخ ثبت و سایر اطلاعات فنی موجود در فایل خوانده می‌شوند.</p>
                </article>
                <article className="app-panel rounded-[22px] p-5">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[13px] bg-sky-500/10 text-sky-600 dark:text-sky-300"><BadgeCheck className="h-[17px] w-[17px]" /></div>
                  <h3 className="text-sm font-bold">C2PA و Content Credentials</h3>
                  <p className="app-muted mt-2 text-xs leading-6">اگر تصویر سابقه اصالت دیجیتال داشته باشد، مانیفست، امضا و رویدادهای ساخت یا ویرایش ثبت‌شده در آن بررسی می‌شوند.</p>
                </article>
              </div>
            </section>

            <section aria-labelledby="ai-photo-faq" className="mx-auto mt-14 max-w-[920px]">
              <div className="app-panel overflow-hidden rounded-[24px]">
                <div className="border-b app-hairline px-5 py-5 sm:px-6">
                  <h2 id="ai-photo-faq" className="text-lg font-[730] tracking-[-0.02em]">درباره تشخیص عکس ساخته‌شده با هوش مصنوعی</h2>
                  <p className="app-muted mt-1.5 text-xs leading-6">چند نکته مهم درباره معنی نتیجه‌ای که برنامه نشان می‌دهد.</p>
                </div>
                <div className="divide-y divide-zinc-200/60 dark:divide-white/[.06]">
                  <details className="group px-5 py-4 sm:px-6">
                    <summary className="cursor-pointer list-none text-sm font-semibold">آیا می‌شود با قطعیت فهمید یک عکس با هوش مصنوعی ساخته شده؟</summary>
                    <p className="app-muted mt-2 text-xs leading-6">نه همیشه. این ابزار شواهد متادیتا و provenance را بررسی می‌کند. اگر این اطلاعات حذف شده باشند، نبودن ردپای AI به‌تنهایی اصالت عکس را ثابت نمی‌کند.</p>
                  </details>
                  <details className="group px-5 py-4 sm:px-6">
                    <summary className="cursor-pointer list-none text-sm font-semibold">آیا فایل تصویر برای تحلیل آپلود می‌شود؟</summary>
                    <p className="app-muted mt-2 text-xs leading-6">خیر. تصویر، نام فایل، Prompt و Metadata برای تحلیل به سرور ارسال نمی‌شوند. بعد از پایان موفق تحلیل فقط نوع نتیجه برای شمارش ناشناس ثبت می‌شود؛ D1 فقط شمارنده‌های تجمیعی روزانه را نگه می‌دارد و Cloudflare Turnstile نیز صرفاً برای جلوگیری از ثبت مصنوعی آمار، اعتبار درخواست را بررسی می‌کند.</p>
                  </details>
                  <details className="group px-5 py-4 sm:px-6">
                    <summary className="cursor-pointer list-none text-sm font-semibold">چه فرمت‌هایی پشتیبانی می‌شوند؟</summary>
                    <p className="app-muted mt-2 text-xs leading-6">JPG/JPEG، PNG، WebP، TIFF و AVIF قابل انتخاب هستند؛ مقدار اطلاعات قابل استخراج به ساختار و متادیتای موجود در خود فایل بستگی دارد.</p>
                  </details>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <section className="animate-fade-up">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="app-muted mb-1.5 text-[11px] font-semibold">گزارش تحلیل</div>
                <h1 className="max-w-3xl truncate text-2xl font-[760] tracking-[-0.035em] sm:text-3xl">{analysis.fileName}</h1>
                <p className="app-muted mt-1.5 text-xs">بررسی منبع، تاریخچه و اطلاعات فنی فایل</p>
              </div>
              <button type="button" onClick={reset} className="app-secondary h-10 self-start px-3.5 text-xs sm:self-auto"><X className="h-3.5 w-3.5" />تصویر جدید</button>
            </div>

            <AiDetectorCard detection={analysis.detection} />

            <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,.92fr)]">
              <div className="space-y-5 lg:sticky lg:top-[86px]">
                <ImagePreview analysis={analysis} />
                {sourceFile && <MetadataSanitizer file={sourceFile} analysis={analysis} />}
              </div>
              <div className="space-y-5">
                <GenerationInspector analysis={analysis} />
                <EditHistory analysis={analysis} />
                <ExifTable analysis={analysis} />
                <RawJsonViewer raw={analysis.raw} />
              </div>
            </div>

            <div className="app-panel mt-5 flex flex-col gap-3 rounded-[20px] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5"><LockKeyhole className="app-muted mt-0.5 h-4 w-4 shrink-0" /><p className="app-muted max-w-3xl text-[11px] leading-5">نبودن متادیتا به معنی واقعی یا ساختگی بودن تصویر نیست. اطلاعات فایل ممکن است هنگام دانلود، ارسال یا ذخیره دوباره حذف شده باشد.</p></div>
              <span className="app-muted shrink-0 text-[10px] font-semibold">فایل شما از دستگاه خارج نمی‌شود</span>
            </div>
          </section>
        )}
      </main>

      <div id="usage-turnstile" className="pointer-events-none fixed left-[-9999px] top-0 h-px w-px overflow-hidden opacity-0" aria-hidden="true" />

      <footer className="app-muted mx-auto flex max-w-[1240px] flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 pb-8 text-center text-[10px] tracking-wide sm:px-6">
        <UsageCounter />
        <span aria-hidden="true">·</span>
        <span>بررسی تصویر · پردازش محلی و خصوصی</span>
        <span aria-hidden="true">·</span>
        <a href="https://imoein.com/" className="font-semibold text-zinc-700 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-zinc-950 dark:text-zinc-300 dark:decoration-zinc-700 dark:hover:text-white">
          imoein.com
        </a>
      </footer>
    </div>
  );
}

export default App;
