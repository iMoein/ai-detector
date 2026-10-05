import { useMemo, useState } from 'react';
import { Braces, Check, ChevronDown, Clipboard, Search } from 'lucide-react';

export function RawJsonViewer({ raw }: { raw: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const filtered = useMemo(() => {
    if (!query.trim()) return raw;
    const q = query.toLowerCase();
    return Object.fromEntries(Object.entries(raw).filter(([key, value]) => `${key} ${JSON.stringify(value)}`.toLowerCase().includes(q)));
  }, [raw, query]);
  const json = JSON.stringify(filtered, null, 2);

  const copy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(raw, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <section className="app-panel overflow-hidden rounded-[22px]">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between px-4 py-3.5 text-right">
        <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-zinc-500/[.08] text-zinc-500"><Braces className="h-3.5 w-3.5" /></span><div><h3 className="text-[12px] font-bold">اطلاعات خام فایل</h3><p className="app-muted mt-0.5 text-[9px]">{Object.keys(raw).length.toLocaleString('fa-IR')} فیلد خوانده شده</p></div></div>
        <ChevronDown className={`app-muted h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t app-hairline p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1"><Search className="app-muted absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجو در اطلاعات…" className="w-full rounded-[13px] border app-hairline bg-zinc-500/[.035] py-2.5 pl-3 pr-9 text-[10px] outline-none transition focus:border-indigo-400/40 dark:bg-white/[.025]" /></label>
          <button type="button" onClick={copy} className="app-secondary h-10 px-3 text-[10px]">{copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}{copied ? 'کپی شد' : 'کپی اطلاعات'}</button>
        </div>
        <pre dir="ltr" className="max-h-[420px] overflow-auto rounded-[16px] bg-[#0d1016] p-4 text-left font-mono text-[10px] leading-5 text-zinc-300 shadow-inner">{json}</pre>
      </div>}
    </section>
  );
}
