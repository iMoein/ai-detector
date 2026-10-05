import { AlertTriangle, Camera, CheckCircle2, Fingerprint, PencilLine, Sparkles, WandSparkles } from 'lucide-react';
import type { DetectionResult } from '../types';

export function AiDetectorCard({ detection }: { detection: DetectionResult }) {
  const ai = detection.kind === 'ai';
  const edited = detection.kind === 'edited';
  const camera = detection.kind === 'camera';
  const Icon = ai ? Sparkles : edited ? PencilLine : camera ? Camera : AlertTriangle;
  const accent = ai ? 'violet' : edited ? 'amber' : camera ? 'emerald' : 'zinc';
  const accentMap = {
    violet: {
      icon: 'bg-violet-500/10 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300',
      badge: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
      dot: 'bg-violet-500', bar: 'bg-violet-500', glow: 'from-violet-500/[.09]',
    },
    amber: {
      icon: 'bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300',
      badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
      dot: 'bg-amber-500', bar: 'bg-amber-500', glow: 'from-amber-500/[.08]',
    },
    emerald: {
      icon: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300',
      badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500', bar: 'bg-emerald-500', glow: 'from-emerald-500/[.08]',
    },
    zinc: {
      icon: 'bg-zinc-500/10 text-zinc-600 dark:bg-zinc-400/10 dark:text-zinc-300',
      badge: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
      dot: 'bg-zinc-500', bar: 'bg-zinc-500', glow: 'from-zinc-500/[.06]',
    },
  }[accent];

  return (
    <section className="app-panel relative overflow-hidden rounded-[28px] p-5 sm:p-6">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b ${accentMap.glow} to-transparent`} />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4 sm:gap-5">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] ${accentMap.icon}`}><Icon className="h-6 w-6" strokeWidth={1.9} /></div>
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${accentMap.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${accentMap.dot}`} />{ai ? 'AI GENERATED' : edited ? 'AI EDITED' : camera ? 'CAMERA CAPTURE' : 'UNKNOWN'}</span>
              {detection.tool && <span className="app-muted inline-flex items-center gap-1.5 rounded-full border app-hairline bg-white/50 px-2.5 py-1 text-[10px] font-semibold dark:bg-white/[.025]"><WandSparkles className="h-3 w-3" />{detection.tool.name}{detection.tool.version ? ` · ${detection.tool.version}` : ''}</span>}
            </div>
            <h2 className="text-[21px] font-[770] tracking-[-0.035em] sm:text-[25px]">{detection.title}</h2>
            <p className="app-muted mt-2 max-w-3xl text-[12px] leading-6 sm:text-[13px]">{detection.description}</p>
          </div>
        </div>

        {detection.kind !== 'unknown' && <div className="min-w-[190px] rounded-[18px] border app-hairline bg-white/45 p-3.5 dark:bg-white/[.025]">
          <div className="flex items-end justify-between"><span className="app-muted text-[10px] font-semibold">اطمینان تشخیص</span><span className="text-lg font-[780] tracking-[-0.04em]">{detection.confidence.toLocaleString('fa-IR')}٪</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200/70 dark:bg-white/[.08]"><div className={`h-full rounded-full ${accentMap.bar}`} style={{ width: `${Math.max(3, detection.confidence)}%` }} /></div>
        </div>}
      </div>

      {detection.matches.length > 0 && <div className="relative mt-5 border-t app-hairline pt-4">
        <div className="app-muted mb-2.5 text-[10px] font-bold">شواهد پیدا‌شده</div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {detection.matches.map((match, index) => <div key={`${match.source}-${index}`} className="flex items-start gap-2.5 rounded-[16px] border app-hairline bg-white/38 px-3 py-2.5 dark:bg-white/[.018]">
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${accentMap.icon}`}>{ai || edited ? <Fingerprint className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}</span>
            <div className="min-w-0"><p className="text-[11px] font-bold">{match.source}</p><p className="app-muted mt-0.5 break-words text-[10px] leading-4">{match.marker}{match.detail ? ` · ${match.detail}` : ''}</p></div>
          </div>)}
        </div>
      </div>}
    </section>
  );
}
