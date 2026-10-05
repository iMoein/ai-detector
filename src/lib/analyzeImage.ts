import ExifReader from 'exifreader';
import { unzlibSync } from 'fflate';
import { hasAiC2paSource, hasAiEditedC2paSource, hasGeneratedC2paSource, readC2pa } from './c2pa';
import type {
  AnalysisProgress,
  C2paSummary,
  DetectedTool,
  DetectionMatch,
  DetectionResult,
  EditHistoryEvent,
  GenerationDetails,
  ImageAnalysis,
  MetadataSection,
} from '../types';

type AiMode = 'generation' | 'edit' | 'upscale';

interface AiMarkerDefinition {
  re: RegExp;
  source: string;
  marker: string;
  weight: number;
  mode: AiMode;
}

const AI_MARKERS: AiMarkerDefinition[] = [
  { re: /stable[\s_-]?diffusion/i, source: 'Stable Diffusion', marker: 'نام Stable Diffusion', weight: 44, mode: 'generation' },
  { re: /automatic1111|a1111/i, source: 'Automatic1111', marker: 'نام Automatic1111', weight: 50, mode: 'generation' },
  { re: /comfyui|PNG_KEY:workflow|PNG_KEY:prompt/i, source: 'ComfyUI', marker: 'اطلاعات workflow یا prompt', weight: 52, mode: 'generation' },
  { re: /PNG_KEY:parameters[\s\S]*?\bSteps\s*:/i, source: 'Stable Diffusion WebUI', marker: 'پارامترهای ساخت تصویر', weight: 52, mode: 'generation' },
  { re: /\bfooocus\b/i, source: 'Fooocus', marker: 'نام Fooocus', weight: 48, mode: 'generation' },
  { re: /\bforge\b[^\n]{0,40}(?:stable|webui)|stable diffusion webui forge/i, source: 'Forge', marker: 'نام Forge', weight: 48, mode: 'generation' },
  { re: /\bswarmui\b/i, source: 'SwarmUI', marker: 'نام SwarmUI', weight: 48, mode: 'generation' },
  { re: /midjourney|--v\s*[4567](?:\.|\b)|--stylize|--ar\s+\d+[:x]\d+/i, source: 'Midjourney', marker: 'پرامپت یا تنظیمات Midjourney', weight: 48, mode: 'generation' },
  { re: /dall[\s-]?e\s*3|software["':\s]+dall[\s-]?e/i, source: 'DALL-E 3', marker: 'نام DALL-E', weight: 52, mode: 'generation' },
  { re: /openai image|gpt-image|chatgpt image/i, source: 'OpenAI', marker: 'نام ابزار ساخت تصویر OpenAI', weight: 52, mode: 'generation' },
  { re: /adobe\s*firefly/i, source: 'Adobe Firefly', marker: 'نام Adobe Firefly', weight: 46, mode: 'generation' },
  { re: /generative\s*fill|generative\s*expand/i, source: 'Adobe Firefly / Photoshop', marker: 'Generative Fill یا Generative Expand', weight: 58, mode: 'edit' },
  { re: /magic\s*(?:eraser|editor)|google photos[^\n]{0,40}magic/i, source: 'Google Photos', marker: 'Magic Eraser / Magic Editor', weight: 56, mode: 'edit' },
  { re: /canva[^\n]{0,60}(?:magic edit|magic media|ai)|(?:magic edit|magic media)[^\n]{0,60}canva/i, source: 'Canva AI', marker: 'ابزار هوش مصنوعی Canva', weight: 54, mode: 'edit' },
  { re: /\bremini\b/i, source: 'Remini', marker: 'نام Remini', weight: 52, mode: 'edit' },
  { re: /topaz[^\n]{0,50}(?:gigapixel|photo ai)|gigapixel ai/i, source: 'Topaz', marker: 'Topaz Photo AI / Gigapixel', weight: 52, mode: 'upscale' },
  { re: /luminar\s*neo|generase|genexpand|genswap/i, source: 'Luminar Neo', marker: 'ابزار هوش مصنوعی Luminar', weight: 54, mode: 'edit' },
  { re: /\bflux(?:\.|\s|_|-)?(?:1|dev|schnell|pro)?\b/i, source: 'FLUX', marker: 'مدل FLUX', weight: 44, mode: 'generation' },
  { re: /bing image creator|designer\.microsoft|microsoft designer/i, source: 'Microsoft Designer / Bing', marker: 'نام ابزار ساخت تصویر مایکروسافت', weight: 48, mode: 'generation' },
  { re: /novelai|nai[_\s-]?diffusion/i, source: 'NovelAI', marker: 'نام NovelAI', weight: 50, mode: 'generation' },
  { re: /invokeai|dreamstudio|leonardo\.ai|ideogram/i, source: 'ابزار ساخت تصویر با AI', marker: 'نام ابزار سازنده', weight: 44, mode: 'generation' },
];

const CAMERA_MAKERS = /canon|nikon|sony|fujifilm|olympus|om digital|panasonic|leica|pentax|ricoh|hasselblad|phase one|apple|google|samsung|xiaomi|huawei|oneplus|oppo|vivo/i;

interface PngTextEntry { keyword: string; text: string }
interface ContainerInspection {
  searchText: string[];
  provenanceMatches: DetectionMatch[];
  rows: Array<[string, string]>;
  textEntries: PngTextEntry[];
  hasC2paContainer: boolean;
}

function humanSize(bytes: number) {
  if (!Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(unit === 0 ? 0 : value >= 10 ? 1 : 2)} ${units[unit]}`;
}

function cleanValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(cleanValue);
  if (typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    if ('description' in candidate && candidate.description != null) return String(candidate.description);
    if ('value' in candidate && candidate.value != null) return cleanValue(candidate.value);
    const output: Record<string, unknown> = {};
    Object.entries(candidate).forEach(([key, val]) => {
      if (!['id', 'group', 'expanded'].includes(key)) output[key] = cleanValue(val);
    });
    return output;
  }
  return String(value);
}

function tagText(tags: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const tag = tags[name] as Record<string, unknown> | undefined;
    if (!tag) continue;
    const value = tag.description ?? tag.value;
    if (Array.isArray(value)) return value.join(', ');
    if (value != null) return String(value);
  }
  return undefined;
}

function numberFromTag(tags: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const tag = tags[name] as Record<string, unknown> | undefined;
    if (!tag) continue;
    const raw = tag.value ?? tag.description;
    const n = Number(Array.isArray(raw) ? raw[0] : raw);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function section(title: string, rows: Array<[string, string | undefined]>): MetadataSection | null {
  const entries = rows.filter((row): row is [string, string] => Boolean(row[1])).map(([label, value]) => ({ label, value }));
  return entries.length ? { title, entries } : null;
}

function printableAscii(bytes: Uint8Array) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i];
    out += b >= 32 && b <= 126 ? String.fromCharCode(b) : ' ';
  }
  return out;
}

async function inflate(bytes: Uint8Array) {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(unzlibSync(bytes));
  } catch { return ''; }
}

function findNull(bytes: Uint8Array, from: number, to: number) {
  for (let i = from; i < to; i += 1) if (bytes[i] === 0) return i;
  return -1;
}

async function inspectPng(buffer: ArrayBuffer): Promise<ContainerInspection | null> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;

  const utf8 = new TextDecoder('utf-8', { fatal: false });
  const latin = new TextDecoder('windows-1252', { fatal: false });
  const counts = new Map<string, number>();
  const textEntries: PngTextEntry[] = [];
  const provenanceMatches: DetectionMatch[] = [];
  let exifChunks = 0;
  let c2paChunks = 0;
  let offset = 8;

  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > bytes.length) break;
    counts.set(type, (counts.get(type) ?? 0) + 1);

    if (type === 'tEXt') {
      const zero = findNull(bytes, start, end);
      if (zero > start) textEntries.push({ keyword: latin.decode(bytes.subarray(start, zero)), text: latin.decode(bytes.subarray(zero + 1, end)) });
    } else if (type === 'zTXt') {
      const zero = findNull(bytes, start, end);
      if (zero > start && zero + 2 <= end) {
        const keyword = latin.decode(bytes.subarray(start, zero));
        const value = await inflate(bytes.subarray(zero + 2, end));
        textEntries.push({ keyword, text: value });
      }
    } else if (type === 'iTXt') {
      const keywordEnd = findNull(bytes, start, end);
      if (keywordEnd > start && keywordEnd + 3 < end) {
        const keyword = latin.decode(bytes.subarray(start, keywordEnd));
        const compressed = bytes[keywordEnd + 1] === 1;
        let cursor = keywordEnd + 3;
        const languageEnd = findNull(bytes, cursor, end);
        if (languageEnd >= 0) cursor = languageEnd + 1;
        const translatedEnd = findNull(bytes, cursor, end);
        if (translatedEnd >= 0) cursor = translatedEnd + 1;
        const payload = bytes.subarray(cursor, end);
        const value = compressed ? await inflate(payload) : utf8.decode(payload);
        textEntries.push({ keyword, text: value });
      }
    } else if (type === 'eXIf') {
      exifChunks += 1;
    } else if (type === 'caBX') {
      c2paChunks += 1;
    }

    offset = end + 4;
    if (type === 'IEND') break;
  }

  if (c2paChunks > 0) provenanceMatches.push({ source: 'C2PA', marker: 'اطلاعات Content Credentials داخل PNG', weight: 0, detail: `${c2paChunks} بخش caBX` });
  const chunkSummary = Array.from(counts.entries()).map(([name, count]) => `${name} ×${count}`).join(', ');
  const ancillary = Array.from(counts.keys()).filter((name) => !['IHDR', 'IDAT', 'IEND'].includes(name));
  return {
    searchText: textEntries.map((entry) => `PNG_KEY:${entry.keyword}\n${entry.text}`),
    provenanceMatches,
    textEntries,
    hasC2paContainer: c2paChunks > 0,
    rows: [
      ['فرمت فایل', 'PNG'],
      ['بخش‌های داخلی PNG', chunkSummary || '—'],
      ['متن‌های متادیتا', textEntries.length ? String(textEntries.length) : 'ندارد'],
      ['اطلاعات EXIF', exifChunks ? String(exifChunks) : 'ندارد'],
      ['Content Credentials (C2PA)', c2paChunks ? 'دارد' : 'ندارد'],
      ['اطلاعات جانبی', ancillary.length ? ancillary.join(', ') : 'ندارد'],
    ],
  };
}

function inspectJpeg(buffer: ArrayBuffer): ContainerInspection | null {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const searchText: string[] = [];
  const provenanceMatches: DetectionMatch[] = [];
  let app1 = 0;
  let app11 = 0;
  let hasC2pa = false;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x00 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2 || offset + 2 + length > bytes.length) break;
    const payload = bytes.subarray(offset + 4, offset + 2 + length);
    if (marker === 0xe1) {
      app1 += 1;
      searchText.push(printableAscii(payload));
    } else if (marker === 0xeb) {
      app11 += 1;
      const value = printableAscii(payload);
      if (/jumbf|c2pa/i.test(value)) hasC2pa = true;
    }
    offset += 2 + length;
  }
  if (hasC2pa) provenanceMatches.push({ source: 'C2PA', marker: 'اطلاعات Content Credentials داخل JPEG', weight: 0, detail: 'APP11 / JUMBF' });
  return {
    searchText,
    provenanceMatches,
    textEntries: [],
    hasC2paContainer: hasC2pa,
    rows: [
      ['فرمت فایل', 'JPEG'],
      ['بخش‌های متادیتا (APP1)', app1 ? String(app1) : 'ندارد'],
      ['بخش‌های Content Credentials (APP11)', app11 ? String(app11) : 'ندارد'],
      ['بررسی داده خام تصویر', 'انجام نمی‌شود تا تشخیص اشتباه ایجاد نشود'],
    ],
  };
}

async function inspectContainer(buffer: ArrayBuffer): Promise<ContainerInspection> {
  return await inspectPng(buffer) ?? inspectJpeg(buffer) ?? {
    searchText: [], provenanceMatches: [], textEntries: [], hasC2paContainer: false,
    rows: [['بررسی ساختار فایل', 'برای این فرمت از اطلاعات EXIF، XMP و C2PA استفاده می‌شود']],
  };
}

function extractGps(tags: Record<string, unknown>) {
  const lat = numberFromTag(tags, ['GPSLatitude']);
  const lon = numberFromTag(tags, ['GPSLongitude']);
  if (lat == null || lon == null) return undefined;
  const latRef = tagText(tags, ['GPSLatitudeRef']);
  const lonRef = tagText(tags, ['GPSLongitudeRef']);
  return { latitude: /s/i.test(latRef ?? '') ? -Math.abs(lat) : lat, longitude: /w/i.test(lonRef ?? '') ? -Math.abs(lon) : lon };
}

function parseJson(value?: string): unknown {
  if (!value) return undefined;
  try { return JSON.parse(value); } catch { return undefined; }
}

function recursiveFind(value: unknown, keys: RegExp): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) { const found = recursiveFind(item, keys); if (found) return found; }
    return undefined;
  }
  if (!value || typeof value !== 'object') return undefined;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (keys.test(key) && (typeof child === 'string' || typeof child === 'number')) return String(child);
    if (typeof child === 'object') { const found = recursiveFind(child, keys); if (found) return found; }
  }
  return undefined;
}

function comfyPrompts(value: unknown) {
  const output: Array<{ text: string; negative: boolean }> = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return output;
  for (const node of Object.values(value as Record<string, unknown>)) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
    const rec = node as Record<string, unknown>;
    if (!/cliptextencode/i.test(String(rec.class_type ?? ''))) continue;
    const inputs = rec.inputs && typeof rec.inputs === 'object' ? rec.inputs as Record<string, unknown> : undefined;
    const prompt = typeof inputs?.text === 'string' ? inputs.text.trim() : '';
    const meta = rec._meta && typeof rec._meta === 'object' ? rec._meta as Record<string, unknown> : undefined;
    if (prompt) output.push({ text: prompt, negative: /negative/i.test(String(meta?.title ?? '')) });
  }
  return output;
}

function extractGenerationDetails(entries: PngTextEntry[], tags: Record<string, unknown>, corpus: string): GenerationDetails | undefined {
  const details: GenerationDetails = {};
  const parameters = entries.find((entry) => /^(parameters|comment)$/i.test(entry.keyword) && /\bSteps\s*:/i.test(entry.text))?.text;
  const workflowEntry = entries.find((entry) => /^workflow$/i.test(entry.keyword));
  const promptEntry = entries.find((entry) => /^prompt$/i.test(entry.keyword));
  const workflow = parseJson(workflowEntry?.text);
  const promptGraph = parseJson(promptEntry?.text);

  if (parameters) {
    const negativeIndex = parameters.search(/\nNegative prompt\s*:/i);
    const settingsMatch = parameters.match(/\nSteps\s*:/i);
    const promptEnd = negativeIndex >= 0 ? negativeIndex : settingsMatch?.index ?? parameters.length;
    const positive = parameters.slice(0, promptEnd).trim();
    if (positive) details.positivePrompt = positive;
    if (negativeIndex >= 0) {
      const after = parameters.slice(negativeIndex).replace(/^\n?Negative prompt\s*:\s*/i, '');
      const end = after.search(/\nSteps\s*:/i);
      details.negativePrompt = (end >= 0 ? after.slice(0, end) : after).trim() || undefined;
    }
    const last = parameters.slice(settingsMatch?.index ?? 0);
    const take = (name: string) => last.match(new RegExp(`${name}\\s*:\\s*([^,\\n]+)`, 'i'))?.[1]?.trim();
    details.steps = take('Steps');
    details.sampler = take('Sampler');
    details.cfgScale = take('CFG scale');
    details.seed = take('Seed');
    details.size = take('Size');
    details.model = take('Model');
    details.denoisingStrength = take('Denoising strength');
  }

  if (workflow) {
    details.workflow = workflow;
    if (Array.isArray((workflow as Record<string, unknown>).nodes)) details.workflowNodeCount = ((workflow as Record<string, unknown>).nodes as unknown[]).length;
    details.model ??= recursiveFind(workflow, /^(?:ckpt_name|model_name|unet_name)$/i);
  }
  if (promptGraph) {
    if (!details.workflowNodeCount && promptGraph && typeof promptGraph === 'object' && !Array.isArray(promptGraph)) details.workflowNodeCount = Object.keys(promptGraph as Record<string, unknown>).length;
    details.model ??= recursiveFind(promptGraph, /^(?:ckpt_name|model_name|unet_name)$/i);
    const prompts = comfyPrompts(promptGraph);
    details.negativePrompt ??= prompts.find((item) => item.negative)?.text;
    details.positivePrompt ??= prompts.find((item) => !item.negative)?.text;
  }

  const comment = tagText(tags, ['UserComment', 'ImageDescription', 'Description', 'XPComment']);
  if (!details.positivePrompt && comment && /midjourney|--ar\s|--v\s|prompt/i.test(`${comment} ${corpus}`)) details.positivePrompt = comment;
  details.model ??= corpus.match(/\b(?:Model|Checkpoint)\s*[:=]\s*([^,\n"}]+)/i)?.[1]?.trim();
  details.aspectRatio ??= corpus.match(/--ar\s+([0-9]+(?::|x)[0-9]+)/i)?.[1];
  details.generatorVersion ??= corpus.match(/--v\s+([0-9]+(?:\.[0-9]+)?)/i)?.[1];
  details.style ??= corpus.match(/--style\s+([^\s,]+)/i)?.[1];
  if (/midjourney/i.test(corpus)) details.jobId ??= corpus.match(/(?:job(?:[ _-]?(?:id|uuid))?)\s*[:=]\s*([0-9a-f]{8}-[0-9a-f-]{27,})/i)?.[1];

  return Object.values(details).some((value) => value != null && value !== '') ? details : undefined;
}

function detectTool(corpus: string, generation?: GenerationDetails, c2pa?: C2paSummary): DetectedTool | undefined {
  const text = `${corpus}\n${c2pa?.claimGenerator ?? ''}\n${c2pa?.actions.map((action) => `${action.software ?? ''} ${action.description ?? ''}`).join('\n') ?? ''}`;
  const model = generation?.model;
  if (/generative\s*fill/i.test(text)) return { name: 'Adobe Firefly', version: 'Generative Fill', mode: 'edit' };
  if (/generative\s*expand/i.test(text)) return { name: 'Adobe Firefly', version: 'Generative Expand', mode: 'edit' };
  if (/magic\s*(?:eraser|editor)/i.test(text)) return { name: 'Google Photos', version: text.match(/Magic\s+(?:Eraser|Editor)/i)?.[0], mode: 'edit' };
  if (/\bremini\b/i.test(text)) return { name: 'Remini', mode: 'edit' };
  if (/topaz/i.test(text) && /gigapixel|photo ai/i.test(text)) return { name: 'Topaz', version: /gigapixel/i.test(text) ? 'Gigapixel' : 'Photo AI', mode: 'upscale' };
  if (/luminar\s*neo|generase|genexpand|genswap/i.test(text)) return { name: 'Luminar Neo', mode: 'edit' };
  if (/canva/i.test(text) && /magic edit|magic media|ai/i.test(text)) return { name: 'Canva AI', mode: 'edit' };
  if (/comfyui|PNG_KEY:workflow|PNG_KEY:prompt/i.test(text)) return { name: 'ComfyUI', version: model, mode: 'generation' };
  if (/fooocus/i.test(text)) return { name: 'Fooocus', version: model, mode: 'generation' };
  if (/automatic1111|a1111|PNG_KEY:parameters[\s\S]*Steps\s*:/i.test(text)) return { name: 'Stable Diffusion WebUI', version: model, mode: 'generation' };
  if (/midjourney/i.test(text) || /--v\s*[4567](?:\.|\b)/i.test(text)) return { name: 'Midjourney', version: text.match(/--v\s*([4567](?:\.\d+)?)/i)?.[1] ? `v${text.match(/--v\s*([4567](?:\.\d+)?)/i)?.[1]}` : undefined, mode: 'generation' };
  if (/dall[\s-]?e\s*3/i.test(text)) return { name: 'DALL-E 3', mode: 'generation' };
  if (/gpt-image|openai image|chatgpt image/i.test(text)) return { name: 'OpenAI Image', version: model, mode: 'generation' };
  if (/adobe\s*firefly/i.test(text)) return { name: 'Adobe Firefly', mode: 'generation' };
  if (/\bflux(?:\.|\s|_|-)?1/i.test(`${text} ${model ?? ''}`)) return { name: 'FLUX.1', version: model, mode: 'generation' };
  if (/novelai/i.test(text)) return { name: 'NovelAI', version: model, mode: 'generation' };
  if (/microsoft designer|bing image creator/i.test(text)) return { name: 'Microsoft Designer / Bing', mode: 'generation' };
  return undefined;
}

function collectAiMatches(corpus: string) {
  const matches: DetectionMatch[] = [];
  const modes = new Set<AiMode>();
  const seen = new Set<string>();
  for (const marker of AI_MARKERS) {
    const found = corpus.match(marker.re);
    if (!found) continue;
    const key = `${marker.source}:${marker.marker}`;
    if (seen.has(key)) continue;
    seen.add(key);
    modes.add(marker.mode);
    matches.push({ source: marker.source, marker: marker.marker, weight: marker.weight, detail: found[0].slice(0, 120) });
  }
  return { matches, modes };
}

function cameraStrength(tags: Record<string, unknown>) {
  const make = tagText(tags, ['Make', 'CameraMake']);
  const model = tagText(tags, ['Model', 'CameraModelName']);
  const captureFields = [tagText(tags, ['ExposureTime']), tagText(tags, ['FNumber']), tagText(tags, ['ISOSpeedRatings', 'PhotographicSensitivity']), tagText(tags, ['LensModel']), tagText(tags, ['FocalLength'])].filter(Boolean).length;
  const hardware = Boolean((make && CAMERA_MAKERS.test(make)) || model);
  return { make, model, captureFields, hasCamera: hardware && captureFields >= 2 };
}

function verdict(tags: Record<string, unknown>, corpus: string, provenanceMatches: DetectionMatch[], c2pa?: C2paSummary, generation?: GenerationDetails): DetectionResult {
  const ai = collectAiMatches(corpus);
  const camera = cameraStrength(tags);
  const c2paAi = hasAiC2paSource(c2pa);
  const c2paCapture = Boolean(c2pa?.digitalSourceTypes.some((value) => /digitalCapture|computationalCapture/i.test(value)));
  const c2paEdited = hasAiEditedC2paSource(c2pa);
  const c2paGenerated = hasGeneratedC2paSource(c2pa);
  const tool = detectTool(corpus, generation, c2pa);
  const matches = [...provenanceMatches, ...ai.matches];

  if (c2pa?.present && c2paAi) matches.unshift({ source: 'C2PA / Content Credentials', marker: c2paEdited ? 'سابقه ویرایش با AI' : 'منبع هوش مصنوعی در مانیفست', weight: 60, detail: c2pa.validationState });

  const hasEditMarker = ai.modes.has('edit') || ai.modes.has('upscale') || c2paEdited;
  const hasGenerationMarker = ai.modes.has('generation') || c2paGenerated;
  const aiScore = Math.min(99, ai.matches.reduce((sum, item) => sum + item.weight, 0) + (c2paAi ? 60 : 0));

  if (hasEditMarker || (camera.hasCamera && hasGenerationMarker)) {
    return {
      kind: 'edited', confidence: Math.max(c2paEdited ? 96 : 72, Math.min(97, aiScore || 78)), tool,
      title: 'این تصویر با هوش مصنوعی ویرایش شده',
      description: camera.hasCamera ? 'اطلاعات دوربین و همین‌طور نشانه‌های ویرایش با هوش مصنوعی داخل فایل پیدا شد.' : 'داخل فایل نشانه‌هایی از ویرایش، روتوش، حذف یا اضافه‌کردن محتوا با ابزارهای هوش مصنوعی پیدا شد.',
      matches,
    };
  }
  if (hasGenerationMarker && (aiScore >= 35 || c2paGenerated)) {
    return {
      kind: 'ai', confidence: Math.max(c2paGenerated ? 97 : 70, Math.min(99, aiScore)), tool,
      title: 'این تصویر با هوش مصنوعی ساخته شده',
      description: 'داخل فایل اطلاعاتی پیدا شد که به ابزار یا فرایند ساخت تصویر با هوش مصنوعی مربوط است.',
      matches,
    };
  }
  if (camera.hasCamera || c2paCapture) {
    const label = [camera.make, camera.model].filter(Boolean).join(' ');
    const confidence = c2paCapture ? 96 : Math.min(94, 76 + camera.captureFields * 4);
    return {
      kind: 'camera', confidence, title: 'این تصویر با دوربین ثبت شده',
      description: `اطلاعات دوربین داخل فایل پیدا شد${label ? ` (${label})` : ''} و نشانه‌ای از ویرایش با هوش مصنوعی دیده نشد. این نتیجه تضمین نمی‌کند که فایل هیچ‌وقت ویرایش نشده باشد.`,
      matches: label ? [{ source: 'اطلاعات دوربین', marker: label, weight: 0 }, ...provenanceMatches] : provenanceMatches,
    };
  }
  return {
    kind: 'unknown', confidence: 0, title: 'ردپای قابل اتکایی از هوش مصنوعی پیدا نشد',
    description: 'در این فایل نشانه قابل اتکایی از ساخت یا ویرایش با هوش مصنوعی پیدا نشد. ممکن است تصویر از ابتدا چنین اطلاعاتی نداشته باشد، متادیتا هنگام دانلود، ارسال یا ذخیره دوباره حذف شده باشد، یا ردپا با ابزار پاک‌سازی همین برنامه حذف شده باشد. این نتیجه به‌تنهایی اصالت تصویر را ثابت نمی‌کند.',
    matches: provenanceMatches,
  };
}

function softwareEditHistory(tags: Record<string, unknown>, corpus: string, existing: EditHistoryEvent[]) {
  const output = [...existing];
  const software = tagText(tags, ['Software', 'ProcessingSoftware', 'CreatorTool']);
  if (software && /remini|topaz|luminar|firefly|generative|magic eraser|magic editor|canva/i.test(`${software} ${corpus}`) && !output.some((item) => item.software === software)) {
    output.push({ action: 'metadata.software', title: 'ویرایش با نرم‌افزار', software, aiRelated: true, description: 'نام این نرم‌افزار در متادیتای فایل دیده شد.' });
  }
  return output;
}

function c2paSection(c2pa?: C2paSummary): MetadataSection | null {
  if (!c2pa?.present) return null;
  const state = c2pa.validationState === 'Trusted' ? 'معتبر و مورد اعتماد' : c2pa.validationState === 'Valid' ? 'از نظر ساختار و امضا معتبر' : c2pa.validationState === 'Invalid' ? 'نامعتبر' : c2pa.validationState;
  return section('Content Credentials (C2PA)', [
    ['وضعیت', state],
    ['ثبت‌کننده اطلاعات', c2pa.claimGenerator],
    ['امضاکننده', c2pa.signatureIssuer],
    ['زمان امضا', c2pa.signedAt],
    ['تعداد رویدادها', c2pa.actions.length ? String(c2pa.actions.length) : undefined],
    ['خطای خواندن', c2pa.error],
  ]);
}

function readFileWithProgress(file: File, onProgress?: (progress: AnalysisProgress) => void) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const ratio = event.total > 0 ? event.loaded / event.total : 0;
      const percent = Math.max(2, Math.min(30, Math.round(ratio * 30)));
      onProgress?.({
        percent,
        stage: 'reading',
        label: 'در حال خواندن فایل',
        detail: `${Math.round(ratio * 100).toLocaleString('fa-IR')}٪ از فایل خوانده شد`,
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error('خواندن فایل انجام نشد.'));
    reader.onload = () => {
      const result = reader.result;
      if (!(result instanceof ArrayBuffer)) return reject(new Error('خواندن فایل انجام نشد.'));
      onProgress?.({ percent: 30, stage: 'reading', label: 'فایل خوانده شد', detail: 'آماده بررسی متادیتا' });
      resolve(result);
    };
    reader.readAsArrayBuffer(file);
  });
}

export async function analyzeImage(file: File, onProgress?: (progress: AnalysisProgress) => void): Promise<ImageAnalysis> {
  onProgress?.({ percent: 1, stage: 'reading', label: 'آماده‌سازی فایل', detail: 'بررسی فایل روی همین دستگاه انجام می‌شود' });
  const buffer = await readFileWithProgress(file, onProgress);
  onProgress?.({ percent: 36, stage: 'metadata', label: 'خواندن متادیتا', detail: 'EXIF، XMP و اطلاعات فنی فایل' });
  let tags: Record<string, unknown> = {};
  try { tags = (await ExifReader.load(buffer, { expanded: false })) as unknown as Record<string, unknown>; } catch { tags = {}; }
  onProgress?.({ percent: 45, stage: 'metadata', label: 'متادیتا خوانده شد', detail: 'در حال بررسی ساختار و اصالت فایل' });

  const cleanRaw = Object.fromEntries(Object.entries(tags).map(([key, value]) => [key, cleanValue(value)]));
  onProgress?.({ percent: 50, stage: 'provenance', label: 'بررسی Content Credentials', detail: 'ساختار فایل و C2PA در حال بررسی است' });
  let provenancePercent = 50;
  const heartbeat = window.setInterval(() => {
    provenancePercent = Math.min(76, provenancePercent + (provenancePercent < 64 ? 3 : 1));
    onProgress?.({ percent: provenancePercent, stage: 'provenance', label: 'بررسی اصالت و C2PA', detail: 'در اولین اجرا ممکن است چند لحظه زمان ببرد' });
  }, 320);
  let container: ContainerInspection;
  let c2pa: C2paSummary | undefined;
  try {
    [container, c2pa] = await Promise.all([inspectContainer(buffer), readC2pa(file)]);
  } finally {
    window.clearInterval(heartbeat);
  }
  onProgress?.({ percent: 80, stage: 'provenance', label: 'بررسی اصالت تمام شد', detail: 'در حال جمع‌بندی نشانه‌ها' });
  const metadataJson = JSON.stringify(cleanRaw);
  const c2paSearch = c2pa ? JSON.stringify({ claimGenerator: c2pa.claimGenerator, actions: c2pa.actions, digitalSourceTypes: c2pa.digitalSourceTypes }) : '';
  const searchCorpus = [metadataJson, ...container.searchText, c2paSearch].join('\n');
  onProgress?.({ percent: 88, stage: 'detection', label: 'تشخیص ردپای هوش مصنوعی', detail: 'نشانه‌ها و تاریخچه فایل در حال جمع‌بندی است' });
  const generation = extractGenerationDetails(container.textEntries, tags, searchCorpus);
  const detection = verdict(tags, searchCorpus, container.provenanceMatches, c2pa, generation);
  const editHistory = softwareEditHistory(tags, searchCorpus, c2pa?.actions ?? []);

  const previewUrl = URL.createObjectURL(file);
  const width = numberFromTag(tags, ['Image Width', 'PixelXDimension', 'ExifImageWidth']);
  const height = numberFromTag(tags, ['Image Height', 'PixelYDimension', 'ExifImageHeight']);
  const gps = extractGps(tags);

  const camera = section('اطلاعات دوربین', [
    ['سازنده دوربین', tagText(tags, ['Make'])], ['مدل دوربین', tagText(tags, ['Model', 'CameraModelName'])],
    ['لنز', tagText(tags, ['LensModel', 'Lens'])], ['نوردهی', tagText(tags, ['ExposureTime'])],
    ['دیافراگم', tagText(tags, ['FNumber', 'ApertureValue'])], ['ISO', tagText(tags, ['ISOSpeedRatings', 'PhotographicSensitivity'])],
    ['فاصله کانونی', tagText(tags, ['FocalLength'])], ['سرعت شاتر', tagText(tags, ['ShutterSpeedValue'])],
  ]);
  const software = section('نرم‌افزار و زمان ساخت', [
    ['نرم‌افزار', tagText(tags, ['Software', 'ProcessingSoftware'])], ['ابزار سازنده', tagText(tags, ['CreatorTool'])],
    ['زمان ثبت اصلی', tagText(tags, ['DateTimeOriginal'])], ['زمان ساخت فایل', tagText(tags, ['DateTimeDigitized', 'CreateDate'])],
    ['آخرین ویرایش', tagText(tags, ['ModifyDate', 'DateTime'])], ['سازنده / عکاس', tagText(tags, ['Artist', 'Creator'])], ['حق نشر', tagText(tags, ['Copyright'])],
  ]);
  const specs = section('مشخصات فایل', [
    ['نام فایل', file.name], ['نوع فایل', file.type || file.name.split('.').pop()?.toUpperCase()], ['حجم فایل', humanSize(file.size)],
    ['ابعاد', width && height ? `${width} × ${height}` : undefined], ['فضای رنگ', tagText(tags, ['ColorSpace', 'ProfileDescription'])],
    ['عمق بیت', tagText(tags, ['BitsPerSample', 'BitDepth'])], ['جهت تصویر', tagText(tags, ['Orientation'])],
  ]);
  const location = gps ? section('موقعیت مکانی', [['عرض جغرافیایی', gps.latitude.toFixed(6)], ['طول جغرافیایی', gps.longitude.toFixed(6)]]) : null;
  const containerSection = section('ساختار داخلی فایل', container.rows);
  const credentials = c2paSection(c2pa);
  const raw = c2pa?.raw ? { ...cleanRaw, C2PA: c2pa.raw } : cleanRaw;

  onProgress?.({ percent: 96, stage: 'detection', label: 'ساخت گزارش', detail: 'نتیجه نهایی تقریباً آماده است' });
  const result: ImageAnalysis = {
    fileName: file.name, fileType: file.type || 'unknown', fileSize: file.size, width, height, previewUrl,
    detection, sections: [camera, software, specs, credentials, location, containerSection].filter((item): item is MetadataSection => Boolean(item)),
    raw, gps, generation, editHistory, c2pa,
    binaryMarkers: detection.matches.map((match) => match.marker),
  };
  onProgress?.({ percent: 100, stage: 'complete', label: 'تحلیل کامل شد', detail: 'نمایش گزارش نهایی' });
  return result;
}

export function createDemoAnalysis(kind: 'ai' | 'edited' | 'camera'): ImageAnalysis {
  const ai = kind === 'ai';
  const edited = kind === 'edited';
  const bg1 = ai ? '#171717' : edited ? '#7c2d12' : '#e7e5e4';
  const bg2 = ai ? '#52525b' : edited ? '#f59e0b' : '#a8a29e';
  const label = ai ? 'نمونه تصویر هوش مصنوعی' : edited ? 'نمونه ویرایش با هوش مصنوعی' : 'نمونه عکس دوربین';
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient></defs>
      <rect width="1200" height="900" fill="url(#g)"/><circle cx="600" cy="410" r="180" fill="#fafafa" opacity=".45"/><text x="600" y="700" text-anchor="middle" font-family="system-ui" font-size="54" fill="${ai || edited ? '#fafafa' : '#1c1917'}">${label}</text>
    </svg>`);

  if (edited) {
    return {
      fileName: 'demo-generative-fill.jpg', fileType: 'image/jpeg', fileSize: 4_120_000, width: 1200, height: 900,
      previewUrl: `data:image/svg+xml;charset=utf-8,${svg}`,
      detection: {
        kind: 'edited', confidence: 97, title: 'این تصویر با هوش مصنوعی ویرایش شده',
        description: 'اطلاعات دوربین وجود دارد و Content Credentials هم ویرایش با Generative Fill را ثبت کرده است.',
        tool: { name: 'Adobe Firefly', version: 'Generative Fill', mode: 'edit' },
        matches: [{ source: 'C2PA / Content Credentials', marker: 'سابقه ویرایش با AI', weight: 60 }, { source: 'Adobe Firefly / Photoshop', marker: 'Generative Fill', weight: 58 }],
      },
      sections: [
        { title: 'اطلاعات دوربین', entries: [{ label: 'سازنده دوربین', value: 'Canon' }, { label: 'مدل دوربین', value: 'EOS R6' }, { label: 'ISO', value: '100' }] },
        { title: 'Content Credentials (C2PA)', entries: [{ label: 'وضعیت', value: 'از نظر ساختار و امضا معتبر' }, { label: 'ثبت‌کننده اطلاعات', value: 'Adobe Photoshop' }] },
        { title: 'مشخصات فایل', entries: [{ label: 'نام فایل', value: 'demo-generative-fill.jpg' }, { label: 'ابعاد', value: '1200 × 900' }] },
      ],
      raw: { Make: 'Canon', Model: 'EOS R6', Software: 'Adobe Photoshop Generative Fill', C2PA: { validation_state: 'Valid' } },
      editHistory: [
        { action: 'c2pa.opened', title: 'باز کردن فایل اصلی', software: 'Adobe Photoshop', aiRelated: false },
        { action: 'c2pa.edited', title: 'ویرایش تصویر', software: 'Adobe Firefly', description: 'Generative Fill · ترکیب‌شده با محتوای هوش مصنوعی', digitalSourceType: 'http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia', aiRelated: true },
      ],
      c2pa: { present: true, validationState: 'Valid', claimGenerator: 'Adobe Photoshop', digitalSourceTypes: ['http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia'], actions: [] },
      binaryMarkers: ['سابقه ویرایش با AI', 'Generative Fill'], isDemo: true,
    };
  }

  return {
    fileName: ai ? 'demo-comfyui.png' : 'demo-camera.jpg', fileType: ai ? 'image/png' : 'image/jpeg', fileSize: ai ? 2_845_912 : 5_428_110,
    width: 1200, height: 900, previewUrl: `data:image/svg+xml;charset=utf-8,${svg}`,
    detection: ai ? {
      kind: 'ai', confidence: 96, title: 'این تصویر با هوش مصنوعی ساخته شده', description: 'داخل فایل workflow و تنظیمات ساخت تصویر پیدا شد.',
      tool: { name: 'ComfyUI', version: 'FLUX.1-dev', mode: 'generation' },
      matches: [{ source: 'ComfyUI', marker: 'اطلاعات workflow یا prompt', weight: 52 }, { source: 'FLUX', marker: 'مدل FLUX', weight: 44 }],
    } : {
      kind: 'camera', confidence: 92, title: 'این تصویر با دوربین ثبت شده', description: 'اطلاعات دوربین و تنظیمات ثبت عکس داخل فایل وجود دارد و نشانه‌ای از AI پیدا نشد.',
      matches: [{ source: 'اطلاعات دوربین', marker: 'Sony ILCE-7M4', weight: 0 }],
    },
    sections: ai ? [
      { title: 'نرم‌افزار و زمان ساخت', entries: [{ label: 'نرم‌افزار', value: 'ComfyUI' }] },
      { title: 'مشخصات فایل', entries: [{ label: 'نام فایل', value: 'demo-comfyui.png' }, { label: 'ابعاد', value: '1200 × 900' }] },
    ] : [
      { title: 'اطلاعات دوربین', entries: [{ label: 'سازنده دوربین', value: 'Sony' }, { label: 'مدل دوربین', value: 'ILCE-7M4' }, { label: 'لنز', value: 'FE 35mm F1.4 GM' }, { label: 'نوردهی', value: '1/250' }, { label: 'دیافراگم', value: 'f/2.0' }, { label: 'ISO', value: '100' }] },
      { title: 'مشخصات فایل', entries: [{ label: 'نام فایل', value: 'demo-camera.jpg' }, { label: 'ابعاد', value: '1200 × 900' }] },
    ],
    raw: ai ? { Software: 'ComfyUI', workflow: { nodes: 18 }, parameters: 'Steps: 30, Sampler: euler, CFG scale: 3.5, Seed: 1234, Model: flux1-dev.safetensors' } : { Make: 'SONY', Model: 'ILCE-7M4', ExposureTime: '1/250', FNumber: '2', ISOSpeedRatings: 100 },
    generation: ai ? { positivePrompt: 'portrait by the sea, natural light', negativePrompt: 'artifacts, blur', steps: '30', sampler: 'euler', cfgScale: '3.5', seed: '1234', model: 'flux1-dev.safetensors', workflowNodeCount: 18 } : undefined,
    editHistory: [], c2pa: undefined, binaryMarkers: ai ? ['اطلاعات workflow یا prompt', 'مدل FLUX'] : [], isDemo: true,
  };
}
