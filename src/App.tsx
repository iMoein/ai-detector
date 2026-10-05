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
import { analyzeImage, createDemoAnalysis } from './lib/analyzeImage';
import type { ImageAnalysis } from './types';

function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') !== 'light');
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    setError('');
    try {
      if (analysis?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(analysis.previewUrl);
      setSourceFile(file);
      setAnalysis(await analyzeImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'نتوانستم این تصویر را بررسی کنم.');
    } finally { setBusy(false); }
  };

  const demo = (kind: 'ai' | 'edited' | 'camera') => {
    if (analysis?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(analysis.previewUrl);
    setSourceFile(null);
    setError('');
    setAnalysis(createDemoAnalysis(kind));
  };

  const reset = () => {
    if (analysis?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(analysis.previewUrl);
    setAnalysis(null);
    setSourceFile(null);
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
            <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="گیت‌هاب" className="app-icon-button"><Code2 className="h-4 w-4" /></a>
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
                حقیقتی که داخل خودِ تصویر ذخیره شده را ببین.
              </h1>
              <p className="app-muted mx-auto mt-5 max-w-2xl text-pretty text-[15px] leading-8 sm:text-[17px]">
                متادیتا، اطلاعات دوربین، Content Credentials و نشانه‌های ابزارهای هوش مصنوعی را بدون ارسال فایل به هیچ سروری بررسی کن.
              </p>
            </section>

            <div className="mx-auto mt-9 max-w-[920px]"><Dropzone onFile={handleFile} busy={busy} /></div>
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

      <footer className="app-muted mx-auto max-w-[1240px] px-4 pb-8 text-center text-[10px] tracking-wide sm:px-6">بررسی تصویر · پردازش محلی و خصوصی</footer>
    </div>
  );
}

export default App;
