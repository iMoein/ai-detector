import { useEffect, useState } from 'react';
import { Images } from 'lucide-react';
import { fetchUsageStats, USAGE_STATS_EVENT, type UsageStats } from '../lib/stats';

export function UsageCounter() {
  const [analyses, setAnalyses] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchUsageStats(controller.signal).then((stats) => {
      if (stats) setAnalyses(stats.analyses);
    });

    const handleUpdate = (event: Event) => {
      const stats = (event as CustomEvent<UsageStats>).detail;
      if (stats) setAnalyses(stats.analyses);
    };
    window.addEventListener(USAGE_STATS_EVENT, handleUpdate);

    return () => {
      controller.abort();
      window.removeEventListener(USAGE_STATS_EVENT, handleUpdate);
    };
  }, []);

  if (analyses == null) return null;

  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-zinc-600 dark:text-zinc-400" title="تعداد کل تحلیل‌های موفق ثبت‌شده">
      <Images className="h-3 w-3" aria-hidden="true" />
      <span>{analyses.toLocaleString('fa-IR')} تصویر بررسی شده</span>
    </span>
  );
}
