import { useState } from 'react';
import { ChevronDown, Cpu, Sparkles } from 'lucide-react';
import type { ImageAnalysis } from '../types';

const LABELS: Array<[keyof NonNullable<ImageAnalysis['generation']>, string]> = [
  ['model', 'مدل'], ['steps', 'تعداد مراحل'], ['sampler', 'Sampler'], ['cfgScale', 'CFG'], ['seed', 'Seed'],
  ['size', 'اندازه ساخت'], ['denoisingStrength', 'Denoising'], ['aspectRatio', 'نسبت تصویر'], ['generatorVersion', 'نسخه ابزار'], ['style', 'سبک'], ['jobId', 'شناسه Job'],
];

export function GenerationInspector({ analysis }: { analysis: ImageAnalysis }) {
  const data = analysis.generation;
  const [open, setOpen] = useState(true);
  const [workflowOpen, setWorkflowOpen] = useState(false);
  if (!data) return null;
  const params = LABELS.map(([key, label]) => [label, data[key]] as const).filter(([, value]) => typeof value === 'string' && value);

  return (
    <section className="app-panel overflow-hidden rounded-[22px]">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between px-4 py-3.5 text-right">
        <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-violet-500/10 text-violet-600 dark:text-violet-300"><Sparkles className="h-3.5 w-3.5" /></span><div><h3 className="text-[12px] font-bold">اطلاعات ساخت تصویر</h3><p className="app-muted mt-0.5 text-[9px]">Prompt، مدل و تنظیمات ثبت‌شده داخل فایل</p></div></div>
        <ChevronDown className={`app-muted h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && <div className="space-y-4 border-t app-hairline p-4">
        {data.positivePrompt && <div><p className="app-muted mb-1.5 text-[9px] font-bold">پرامپت</p><p dir="auto" className="rounded-[15px] border app-hairline bg-zinc-500/[.025] p-3 text-[11px] leading-6">{data.positivePrompt}</p></div>}
        {data.negativePrompt && <div><p className="app-muted mb-1.5 text-[9px] font-bold">پرامپت منفی</p><p dir="auto" className="rounded-[15px] border app-hairline bg-zinc-500/[.025] p-3 text-[11px] leading-6">{data.negativePrompt}</p></div>}

        {params.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{params.map(([label, value]) => <div key={label} className="rounded-[14px] border app-hairline bg-white/30 px-3 py-2.5 dark:bg-white/[.015]"><p className="app-muted text-[9px] font-semibold">{label}</p><p dir="auto" className="mt-1 break-words text-[11px] font-bold">{String(value)}</p></div>)}</div>}

        {data.workflowNodeCount != null && <div className="flex items-center gap-3 rounded-[15px] bg-violet-500/[.055] px-3 py-2.5"><span className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-violet-500/10 text-violet-600 dark:text-violet-300"><Cpu className="h-3.5 w-3.5" /></span><div><p className="text-[10px] font-bold">Workflow پیدا شد</p><p className="app-muted mt-0.5 text-[9px]">{data.workflowNodeCount.toLocaleString('fa-IR')} نود در روند ساخت</p></div></div>}

        {data.workflow != null && <div><button type="button" onClick={() => setWorkflowOpen((value) => !value)} className="app-muted text-[9px] font-bold underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900 dark:hover:text-white">{workflowOpen ? 'بستن جزئیات Workflow' : 'دیدن جزئیات Workflow'}</button>{workflowOpen && <pre dir="ltr" className="mt-3 max-h-[320px] overflow-auto rounded-[15px] bg-[#0d1016] p-4 text-left font-mono text-[10px] leading-5 text-zinc-300">{JSON.stringify(data.workflow, null, 2)}</pre>}</div>}
      </div>}
    </section>
  );
}
