import type { DetectionKind } from '../types';

export interface UsageStats {
  analyses: number;
  aiGenerated: number;
  aiEdited: number;
  camera: number;
  unknown: number;
  today: number;
  last7Days: number;
  last30Days: number;
}

export const USAGE_STATS_EVENT = 'ai-detector:usage-stats';

const configuredBase = (import.meta.env.VITE_STATS_API_BASE_URL as string | undefined)?.trim() ?? '';
const API_BASE = configuredBase.replace(/\/$/, '');

function endpoint(path: string) {
  return `${API_BASE}${path}`;
}

async function parseStats(response: Response): Promise<UsageStats | undefined> {
  if (!response.ok) return undefined;
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) return undefined;
  const data = await response.json() as Partial<UsageStats>;
  if (!Number.isFinite(Number(data.analyses))) return undefined;
  return {
    analyses: Number(data.analyses ?? 0),
    aiGenerated: Number(data.aiGenerated ?? 0),
    aiEdited: Number(data.aiEdited ?? 0),
    camera: Number(data.camera ?? 0),
    unknown: Number(data.unknown ?? 0),
    today: Number(data.today ?? 0),
    last7Days: Number(data.last7Days ?? 0),
    last30Days: Number(data.last30Days ?? 0),
  };
}

export async function fetchUsageStats(signal?: AbortSignal) {
  try {
    const response = await fetch(endpoint('/api/stats'), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
    return await parseStats(response);
  } catch {
    return undefined;
  }
}

export async function trackAnalysis(result: DetectionKind) {
  try {
    const response = await fetch(endpoint('/api/stats/analyze'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ result }),
      keepalive: true,
    });
    const stats = await parseStats(response);
    if (stats && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent<UsageStats>(USAGE_STATS_EVENT, { detail: stats }));
    }
    return stats;
  } catch {
    return undefined;
  }
}
