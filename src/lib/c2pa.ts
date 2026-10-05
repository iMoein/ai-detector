import { createC2pa, Reader } from '@contentauth/c2pa-web';
import wasmSrc from '@contentauth/c2pa-web/resources/c2pa.wasm?url';
import type { C2paSummary, EditHistoryEvent } from '../types';

let c2paPromise: ReturnType<typeof createC2pa> | null = null;

function getC2pa() {
  c2paPromise ??= createC2pa({ wasmSrc });
  return c2paPromise;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function softwareName(value: unknown): string | undefined {
  const direct = text(value);
  if (direct) return direct;
  const obj = asRecord(value);
  if (!obj) return undefined;
  const name = text(obj.name);
  const version = text(obj.version);
  return [name, version].filter(Boolean).join(' ') || undefined;
}

function sourceTypeLabel(uri?: string) {
  if (!uri) return undefined;
  const name = uri.split('/').pop() ?? uri;
  const labels: Record<string, string> = {
    digitalCapture: 'ثبت با دوربین دیجیتال',
    computationalCapture: 'ثبت محاسباتی با دوربین',
    trainedAlgorithmicMedia: 'ساخته‌شده با هوش مصنوعی',
    compositeWithTrainedAlgorithmicMedia: 'ترکیب‌شده با محتوای هوش مصنوعی',
    algorithmicallyEnhanced: 'بهبود داده‌شده با الگوریتم یا هوش مصنوعی',
    algorithmicMedia: 'محتوای ساخته‌شده با الگوریتم',
    compositeSynthetic: 'ترکیب مصنوعی',
    humanEdits: 'ویرایش انسانی',
    minorHumanEdits: 'ویرایش جزئی انسانی',
    softwareImage: 'ساخته‌شده با نرم‌افزار',
    digitalArt: 'اثر دیجیتال',
    digitalCreation: 'ساخت دیجیتال',
    screenCapture: 'تصویر صفحه‌نمایش',
  };
  return labels[name] ?? name;
}

function actionTitle(action: string) {
  const key = action.toLowerCase();
  if (key.includes('created')) return 'ساخت تصویر';
  if (key.includes('edited')) return 'ویرایش تصویر';
  if (key.includes('opened')) return 'باز کردن فایل اصلی';
  if (key.includes('placed')) return 'اضافه کردن محتوا';
  if (key.includes('removed')) return 'حذف بخشی از تصویر';
  if (key.includes('cropped')) return 'برش تصویر';
  if (key.includes('resized')) return 'تغییر اندازه';
  if (key.includes('filtered')) return 'اعمال فیلتر';
  if (key.includes('color_adjustments')) return 'تنظیم رنگ و نور';
  if (key.includes('orientation')) return 'تغییر جهت تصویر';
  if (key.includes('converted')) return 'تبدیل فرمت فایل';
  if (key.includes('drawing')) return 'ویرایش روی تصویر';
  if (key.includes('published')) return 'انتشار فایل';
  return action.replace(/^c2pa\./, '');
}

function isAiSourceType(value?: string) {
  return Boolean(value && /trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia|algorithmicallyEnhanced|algorithmicMedia|compositeSynthetic|trainedAlgorithmicData/i.test(value));
}

function parseActions(manifest: Record<string, unknown>): EditHistoryEvent[] {
  const assertions = Array.isArray(manifest.assertions) ? manifest.assertions : [];
  const result: EditHistoryEvent[] = [];
  for (const assertionValue of assertions) {
    const assertion = asRecord(assertionValue);
    if (!assertion || !/^c2pa\.actions(?:\.v\d+)?$/i.test(text(assertion.label) ?? '')) continue;
    const data = asRecord(assertion.data);
    const actions = Array.isArray(data?.actions) ? data.actions : [];
    const agents = Array.isArray(data?.softwareAgents) ? data.softwareAgents : [];
    for (const value of actions) {
      const action = asRecord(value);
      if (!action) continue;
      const name = text(action.action) ?? 'c2pa.action';
      const sourceType = text(action.digitalSourceType);
      const agentIndex = typeof action.softwareAgentIndex === 'number' ? action.softwareAgentIndex : undefined;
      const agent = softwareName(action.softwareAgent) ?? (agentIndex != null ? softwareName(agents[agentIndex]) : undefined);
      const description = text(action.description);
      result.push({
        action: name,
        title: actionTitle(name),
        description: [description, sourceTypeLabel(sourceType)].filter(Boolean).join(' · ') || undefined,
        when: text(action.when),
        software: agent,
        digitalSourceType: sourceType,
        aiRelated: isAiSourceType(sourceType) || /firefly|generative|openai|dall.?e|midjourney|stable diffusion|comfyui|flux|magic eraser/i.test(`${agent ?? ''} ${description ?? ''}`),
      });
    }
  }
  return result;
}

function manifestChain(store: Record<string, unknown>, activeManifest: Record<string, unknown>) {
  const manifests = asRecord(store.manifests) ?? {};
  const activeLabel = text(store.active_manifest) ?? text(activeManifest.label);
  const visited = new Set<string>();
  const chain: Record<string, unknown>[] = [];

  const walk = (manifest: Record<string, unknown>, label?: string) => {
    if (label && visited.has(label)) return;
    if (label) visited.add(label);
    const ingredients = Array.isArray(manifest.ingredients) ? manifest.ingredients : [];
    for (const ingredientValue of ingredients) {
      const ingredient = asRecord(ingredientValue);
      if (!ingredient || text(ingredient.relationship) !== 'parentOf') continue;
      const parentLabel = text(ingredient.active_manifest);
      const parent = parentLabel ? asRecord(manifests[parentLabel]) : undefined;
      if (parent) walk(parent, parentLabel);
    }
    chain.push(manifest);
  };

  walk(activeManifest, activeLabel);
  return chain;
}

function collectDigitalSourceTypes(value: unknown, output = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((item) => collectDigitalSourceTypes(item, output));
    return output;
  }
  const obj = asRecord(value);
  if (!obj) return output;
  for (const [key, child] of Object.entries(obj)) {
    if (/digitalSourceType|digital_source_type/i.test(key)) {
      const source = text(child);
      if (source) output.add(source);
    }
    if (typeof child === 'object' && child !== null) collectDigitalSourceTypes(child, output);
  }
  return output;
}

export async function readC2pa(file: File): Promise<C2paSummary | undefined> {
  let reader: Awaited<ReturnType<typeof Reader.fromBlob>> | null = null;
  try {
    const c2pa = await getC2pa();
    reader = await Reader.fromBlob(c2pa, file.type || undefined, file);
    if (!reader) return undefined;

    const store = await reader.manifestStore();
    const active = await reader.activeManifest();
    const manifest = active as unknown as Record<string, unknown>;
    const storeRecord = store as unknown as Record<string, unknown>;
    const claimInfo = Array.isArray(manifest.claim_generator_info) ? manifest.claim_generator_info : [];
    const claimGenerator = softwareName(claimInfo[0]) ?? text(manifest.claim_generator);
    const signature = asRecord(manifest.signature_info);
    const chain = manifestChain(storeRecord, manifest);
    const actions = chain.flatMap(parseActions);
    const sourceSet = new Set<string>();
    chain.forEach((item) => collectDigitalSourceTypes(item, sourceSet));
    const digitalSourceTypes = Array.from(sourceSet);

    return {
      present: true,
      activeManifest: text(storeRecord.active_manifest) ?? text(manifest.label),
      claimGenerator,
      validationState: text(storeRecord.validation_state),
      signatureIssuer: text(signature?.issuer) ?? text(signature?.common_name),
      signedAt: text(signature?.time),
      digitalSourceTypes,
      actions,
      raw: storeRecord,
    };
  } catch (error) {
    return {
      present: false,
      digitalSourceTypes: [],
      actions: [],
      error: error instanceof Error ? error.message : 'خطا در خواندن اطلاعات C2PA',
    };
  } finally {
    if (reader) await reader.free().catch(() => undefined);
  }
}

export function hasAiC2paSource(c2pa?: C2paSummary) {
  return Boolean(c2pa?.digitalSourceTypes.some(isAiSourceType) || c2pa?.actions.some((action) => action.aiRelated));
}

export function hasGeneratedC2paSource(c2pa?: C2paSummary) {
  return Boolean(c2pa?.digitalSourceTypes.some((value) => /trainedAlgorithmicMedia|algorithmicMedia|compositeSynthetic/i.test(value)) && !c2pa?.digitalSourceTypes.some((value) => /compositeWithTrainedAlgorithmicMedia|algorithmicallyEnhanced/i.test(value)));
}

export function hasAiEditedC2paSource(c2pa?: C2paSummary) {
  return Boolean(c2pa?.digitalSourceTypes.some((value) => /compositeWithTrainedAlgorithmicMedia|algorithmicallyEnhanced/i.test(value)) || c2pa?.actions.some((action) => action.aiRelated && /edited|placed|removed|cropped|resized|filtered|drawing/i.test(action.action)));
}
