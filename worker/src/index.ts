interface Env {
  DB: D1Database;
  ANALYSIS_RATE_LIMITER: RateLimit;
  TURNSTILE_SECRET_KEY: string;
}

type AnalysisResult = 'ai' | 'edited' | 'camera' | 'unknown';

interface StatsRow {
  analyses: number | string | null;
  ai_generated: number | string | null;
  ai_edited: number | string | null;
  camera: number | string | null;
  unknown: number | string | null;
  today: number | string | null;
  last_7_days: number | string | null;
  last_30_days: number | string | null;
}

const PRODUCTION_ORIGIN = 'https://ai-detector.imoein.com';
const PRODUCTION_HOSTNAME = 'ai-detector.imoein.com';
const TURNSTILE_ACTION = 'analysis_counter';
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const ALLOWED_ORIGINS = new Set([
  PRODUCTION_ORIGIN,
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://localhost:5173',
  'http://localhost:5174',
]);

const UPSERT = `
  INSERT INTO daily_stats (day, result, count)
  VALUES (?, ?, 1)
  ON CONFLICT(day, result) DO UPDATE SET count = count + 1
`;

function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return utcDay(date);
}

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function corsHeaders(request: Request) {
  const origin = request.headers.get('Origin');
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  });
  if (origin && ALLOWED_ORIGINS.has(origin)) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

function json(request: Request, body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  for (const [key, value] of corsHeaders(request)) headers.set(key, value);
  return new Response(JSON.stringify(body), { ...init, headers });
}

function validOrigin(request: Request) {
  const origin = request.headers.get('Origin');
  return !origin || ALLOWED_ORIGINS.has(origin);
}

async function readStats(env: Env) {
  const today = utcDay();
  const last7 = daysAgo(6);
  const last30 = daysAgo(29);
  const row = await env.DB.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN result = 'all' THEN count ELSE 0 END), 0) AS analyses,
      COALESCE(SUM(CASE WHEN result = 'ai' THEN count ELSE 0 END), 0) AS ai_generated,
      COALESCE(SUM(CASE WHEN result = 'edited' THEN count ELSE 0 END), 0) AS ai_edited,
      COALESCE(SUM(CASE WHEN result = 'camera' THEN count ELSE 0 END), 0) AS camera,
      COALESCE(SUM(CASE WHEN result = 'unknown' THEN count ELSE 0 END), 0) AS unknown,
      COALESCE(SUM(CASE WHEN result = 'all' AND day = ? THEN count ELSE 0 END), 0) AS today,
      COALESCE(SUM(CASE WHEN result = 'all' AND day >= ? THEN count ELSE 0 END), 0) AS last_7_days,
      COALESCE(SUM(CASE WHEN result = 'all' AND day >= ? THEN count ELSE 0 END), 0) AS last_30_days
    FROM daily_stats
  `).bind(today, last7, last30).first<StatsRow>();

  return {
    analyses: numberValue(row?.analyses),
    aiGenerated: numberValue(row?.ai_generated),
    aiEdited: numberValue(row?.ai_edited),
    camera: numberValue(row?.camera),
    unknown: numberValue(row?.unknown),
    today: numberValue(row?.today),
    last7Days: numberValue(row?.last_7_days),
    last30Days: numberValue(row?.last_30_days),
  };
}

interface TurnstileVerification {
  success: boolean;
  hostname?: string;
  action?: string;
  'error-codes'?: string[];
}

async function verifyTurnstile(request: Request, env: Env, token: string) {
  const form = new FormData();
  form.set('secret', env.TURNSTILE_SECRET_KEY);
  form.set('response', token);
  const remoteIp = request.headers.get('CF-Connecting-IP');
  if (remoteIp) form.set('remoteip', remoteIp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const verification = await response.json<TurnstileVerification>();
    return verification.success
      && verification.hostname === PRODUCTION_HOSTNAME
      && verification.action === TURNSTILE_ACTION;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function handleAnalyze(request: Request, env: Env) {
  const origin = request.headers.get('Origin');
  if (origin !== PRODUCTION_ORIGIN) {
    return json(request, { error: 'Origin not allowed' }, { status: 403 });
  }

  const requestHostname = new URL(request.url).hostname;
  if (requestHostname !== PRODUCTION_HOSTNAME) {
    return json(request, { error: 'Host not allowed' }, { status: 403 });
  }

  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if (fetchSite && fetchSite !== 'same-origin') {
    return json(request, { error: 'Cross-site request rejected' }, { status: 403 });
  }

  const contentType = request.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return json(request, { error: 'Unsupported content type' }, { status: 415 });
  }

  const contentLength = Number(request.headers.get('Content-Length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return json(request, { error: 'Request too large' }, { status: 413 });
  }

  const rateLimitKey = request.headers.get('CF-Connecting-IP') ?? origin;
  const rateLimit = await env.ANALYSIS_RATE_LIMITER.limit({ key: rateLimitKey });
  if (!rateLimit.success) {
    return json(request, { error: 'Too many analysis events' }, {
      status: 429,
      headers: { 'Retry-After': '60' },
    });
  }

  let payload: { result?: unknown; turnstileToken?: unknown };
  try {
    payload = await request.json() as { result?: unknown; turnstileToken?: unknown };
  } catch {
    return json(request, { error: 'Invalid JSON body' }, { status: 400 });
  }

  const result = payload.result;
  if (result !== 'ai' && result !== 'edited' && result !== 'camera' && result !== 'unknown') {
    return json(request, { error: 'Invalid analysis result' }, { status: 400 });
  }

  const turnstileToken = payload.turnstileToken;
  if (typeof turnstileToken !== 'string' || turnstileToken.length < 20 || turnstileToken.length > 2048) {
    return json(request, { error: 'Human verification required' }, { status: 403 });
  }

  if (!await verifyTurnstile(request, env, turnstileToken)) {
    return json(request, { error: 'Human verification failed' }, { status: 403 });
  }

  const day = utcDay();
  await env.DB.batch([
    env.DB.prepare(UPSERT).bind(day, 'all'),
    env.DB.prepare(UPSERT).bind(day, result satisfies AnalysisResult),
  ]);

  const stats = await readStats(env);
  return json(request, { ok: true, ...stats }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
      if (!validOrigin(request)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json(request, { ok: true, service: 'ai-detector-stats' }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/stats') {
      const stats = await readStats(env);
      return json(request, stats, {
        headers: { 'Cache-Control': 'public, max-age=20, stale-while-revalidate=40' },
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/stats/analyze') {
      return handleAnalyze(request, env);
    }

    return json(request, { error: 'Not found' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
