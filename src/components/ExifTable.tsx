import { BadgeCheck, Camera, ExternalLink, FileText, Layers3, MapPin, MonitorCog } from 'lucide-react';
import type { ImageAnalysis } from '../types';

function SectionIcon({ title }: { title: string }) {
  const Icon = title.includes('دوربین') ? Camera : title.includes('موقعیت') ? MapPin : title.includes('C2PA') ? BadgeCheck : title.includes('ساختار') ? Layers3 : title.includes('نرم‌افزار') ? MonitorCog : FileText;
  return <Icon className="h-3.5 w-3.5" />;
}

export function ExifTable({ analysis }: { analysis: ImageAnalysis }) {
  return (
    <div className="space-y-4">
      {analysis.sections.map((section) => (
        <section key={section.title} className="app-panel overflow-hidden rounded-[22px]">
          <div className="flex items-center justify-between border-b app-hairline px-4 py-3.5">
            <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-zinc-500/[.08] text-zinc-500"><SectionIcon title={section.title} /></span><h3 className="text-[12px] font-bold tracking-[-0.01em]">{section.title}</h3></div>
            <span className="app-muted text-[9px] font-semibold">{section.entries.length.toLocaleString('fa-IR')} مورد</span>
          </div>
          <dl className="divide-y divide-zinc-900/[.055] dark:divide-white/[.055]">
            {section.entries.map((entry) => (
              <div key={`${section.title}-${entry.label}`} className="grid gap-1 px-4 py-3 sm:grid-cols-[132px_1fr] sm:gap-4">
                <dt className="app-muted text-[10px] font-semibold">{entry.label}</dt>
                <dd dir="auto" className="break-words text-[11px] font-medium leading-5 text-zinc-800 dark:text-zinc-200">{entry.value}</dd>
              </div>
            ))}
          </dl>
          {section.title === 'موقعیت مکانی' && analysis.gps && (
            <a href={`https://www.google.com/maps?q=${analysis.gps.latitude},${analysis.gps.longitude}`} target="_blank" rel="noreferrer" className="app-muted flex items-center justify-center gap-1.5 border-t app-hairline px-4 py-3 text-[10px] font-bold transition hover:bg-zinc-500/[.035] hover:text-zinc-900 dark:hover:text-white">دیدن روی Google Maps <ExternalLink className="h-3 w-3" /></a>
          )}
        </section>
      ))}
    </div>
  );
}
