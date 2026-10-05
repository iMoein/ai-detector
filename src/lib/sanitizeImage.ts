import type { ImageAnalysis, SanitizerOptions, SanitizerResult } from '../types';

const AI_TEXT = /comfyui|automatic1111|a1111|stable[\s_-]?diffusion|midjourney|dall[\s-]?e|openai image|gpt-image|adobe\s*firefly|generative\s*(?:fill|expand)|magic\s*(?:eraser|editor)|canva|remini|topaz|luminar|\bflux(?:\.|\s|_|-)?1?\b|novelai|swarmui|fooocus|forge|invokeai|dreamstudio|leonardo\.ai|ideogram|negative[_\s]?prompt|\bworkflow\b|\bparameters\b|\bprompt\b/i;

const SAFE_PNG_ANCILLARY = new Set([
  'PLTE', 'tRNS', 'sRGB', 'gAMA', 'cHRM', 'iCCP', 'cICP',
  'acTL', 'fcTL', 'fdAT',
]);

const encoder = new TextEncoder();
const ascii = (bytes: Uint8Array) => Array.from(bytes, (b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : ' ')).join('');

function concatBytes(parts: Uint8Array[]) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

function humanItem(type: string) {
  const labels: Record<string, string> = {
    tEXt: 'متادیتای متنی PNG', zTXt: 'متادیتای فشرده PNG', iTXt: 'متادیتای متنی Unicode',
    eXIf: 'اطلاعات EXIF', caBX: 'Content Credentials / C2PA', tIME: 'زمان ذخیره فایل',
    APP1: 'EXIF / XMP', APP11: 'Content Credentials / C2PA', APP13: 'IPTC / Photoshop', COM: 'توضیحات JPEG',
    EXIF: 'EXIF', XMP: 'XMP', C2PA: 'Content Credentials / C2PA',
  };
  return labels[type] ?? type;
}

function addRemoved(list: string[], item: string) {
  if (!list.includes(item)) list.push(item);
}

function isPng(bytes: Uint8Array) {
  return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
}

function isJpeg(bytes: Uint8Array) {
  return bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function isWebp(bytes: Uint8Array) {
  return bytes.length >= 12 && ascii(bytes.subarray(0, 4)) === 'RIFF' && ascii(bytes.subarray(8, 12)) === 'WEBP';
}

function shouldRemovePngChunk(type: string, payload: Uint8Array, mode: SanitizerOptions['mode'], analysis: ImageAnalysis) {
  if (['IHDR', 'IDAT', 'IEND'].includes(type) || SAFE_PNG_ANCILLARY.has(type)) return false;
  const metadataTypes = ['tEXt', 'zTXt', 'iTXt', 'eXIf', 'caBX', 'tIME'];
  if (!metadataTypes.includes(type)) return mode === 'full' && type[0] === type[0]?.toLowerCase();
  if (mode === 'full') return true;
  if (type === 'caBX') return analysis.detection.kind === 'ai' || analysis.detection.kind === 'edited';
  return AI_TEXT.test(ascii(payload));
}

function stripPng(bytes: Uint8Array, mode: SanitizerOptions['mode'], analysis: ImageAnalysis) {
  if (!isPng(bytes)) return null;
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  const removed: string[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) break;
    const type = ascii(bytes.subarray(offset + 4, offset + 8));
    const payload = bytes.subarray(offset + 8, offset + 8 + length);
    if (shouldRemovePngChunk(type, payload, mode, analysis)) addRemoved(removed, humanItem(type));
    else parts.push(bytes.subarray(offset, end));
    offset = end;
    if (type === 'IEND') break;
  }
  return { bytes: concatBytes(parts), removed };
}

function jpegSegmentLabel(marker: number) {
  if (marker === 0xe1) return 'APP1';
  if (marker === 0xeb) return 'APP11';
  if (marker === 0xed) return 'APP13';
  if (marker === 0xfe) return 'COM';
  return `0x${marker.toString(16)}`;
}

function shouldRemoveJpegSegment(marker: number, payload: Uint8Array, mode: SanitizerOptions['mode'], analysis: ImageAnalysis) {
  const fullRemovable = marker === 0xe1 || marker === 0xeb || marker === 0xed || marker === 0xfe;
  if (!fullRemovable) return false;
  if (mode === 'full') return true;
  if (marker === 0xeb) return analysis.detection.kind === 'ai' || analysis.detection.kind === 'edited';
  return AI_TEXT.test(ascii(payload));
}

function stripJpeg(bytes: Uint8Array, mode: SanitizerOptions['mode'], analysis: ImageAnalysis) {
  if (!isJpeg(bytes)) return null;
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  const removed: string[] = [];
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) { parts.push(bytes.subarray(offset)); break; }
    let markerOffset = offset;
    while (markerOffset < bytes.length && bytes[markerOffset] === 0xff) markerOffset += 1;
    if (markerOffset >= bytes.length) break;
    const marker = bytes[markerOffset];
    if (marker === 0xda) { parts.push(bytes.subarray(offset)); break; }
    if (marker === 0xd9) { parts.push(bytes.subarray(offset, offset + 2)); break; }
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      parts.push(bytes.subarray(offset, markerOffset + 1));
      offset = markerOffset + 1;
      continue;
    }
    if (markerOffset + 2 >= bytes.length) { parts.push(bytes.subarray(offset)); break; }
    const length = (bytes[markerOffset + 1] << 8) | bytes[markerOffset + 2];
    const end = markerOffset + 1 + length;
    if (length < 2 || end > bytes.length) { parts.push(bytes.subarray(offset)); break; }
    const payload = bytes.subarray(markerOffset + 3, end);
    if (shouldRemoveJpegSegment(marker, payload, mode, analysis)) addRemoved(removed, humanItem(jpegSegmentLabel(marker)));
    else parts.push(bytes.subarray(offset, end));
    offset = end;
  }
  return { bytes: concatBytes(parts), removed };
}

function webpChunkNeedsRemoval(type: string, payload: Uint8Array, mode: SanitizerOptions['mode'], analysis: ImageAnalysis) {
  if (!['EXIF', 'XMP ', 'C2PA'].includes(type)) return false;
  if (mode === 'full') return true;
  if (type === 'C2PA') return analysis.detection.kind === 'ai' || analysis.detection.kind === 'edited';
  return AI_TEXT.test(ascii(payload));
}

function stripWebp(bytes: Uint8Array, mode: SanitizerOptions['mode'], analysis: ImageAnalysis) {
  if (!isWebp(bytes)) return null;
  const records: Array<{ type: string; start: number; end: number; payload: Uint8Array; remove: boolean }> = [];
  const removed: string[] = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes.subarray(offset, offset + 4));
    const size = bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24);
    const padded = size + (size % 2);
    const end = offset + 8 + padded;
    if (end > bytes.length) break;
    const payload = bytes.subarray(offset + 8, offset + 8 + size);
    const remove = webpChunkNeedsRemoval(type, payload, mode, analysis);
    if (remove) addRemoved(removed, humanItem(type.trim()));
    records.push({ type, start: offset, end, payload, remove });
    offset = end;
  }

  const removedExif = records.some((item) => item.remove && item.type === 'EXIF');
  const removedXmp = records.some((item) => item.remove && item.type === 'XMP ');
  const chunks: Uint8Array[] = [];
  for (const record of records) {
    if (record.remove) continue;
    const chunk = bytes.slice(record.start, record.end);
    if (record.type === 'VP8X' && chunk.length >= 9) {
      if (removedExif) chunk[8] &= ~0x08;
      if (removedXmp) chunk[8] &= ~0x04;
    }
    chunks.push(chunk);
  }

  const body = concatBytes(chunks);
  const out = new Uint8Array(12 + body.length);
  out.set(encoder.encode('RIFF'), 0);
  const riffSize = body.length + 4;
  out[4] = riffSize & 0xff; out[5] = (riffSize >>> 8) & 0xff; out[6] = (riffSize >>> 16) & 0xff; out[7] = (riffSize >>> 24) & 0xff;
  out.set(encoder.encode('WEBP'), 8);
  out.set(body, 12);
  return { bytes: out, removed };
}

function extensionForMime(mime: string) {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  return 'png';
}

export function sanitizeFileName(name: string, mime: string) {
  const dot = name.lastIndexOf('.');
  const stem = (dot > 0 ? name.slice(0, dot) : name)
    .replace(/comfyui|automatic1111|a1111|stable[_\s-]?diffusion|midjourney|dall[_\s-]?e|openai|gpt[_\s-]?image|firefly|generative[_\s-]?(?:fill|expand)|flux(?:[_\s.-]?1)?|novelai|fooocus|swarmui|forge|invokeai|dreamstudio|leonardo|ideogram|remini|topaz|gigapixel|luminar|canva|magic[_\s-]?(?:eraser|editor)|prompt|workflow|seed|\bai\b|v[4567](?:\.\d+)?/gi, ' ')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const meaningful = stem.replace(/\d+/g, '').trim().length >= 3;
  const cleanStem = meaningful ? stem.replace(/\s+/g, '_') : 'image';
  return `clean_${cleanStem}.${extensionForMime(mime)}`;
}

async function canvasReencode(file: File, format: Exclude<SanitizerOptions['format'], 'original'>, quality: number) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { alpha: format !== 'jpeg' });
  if (!ctx) { bitmap.close(); throw new Error('مرورگر نتوانست تصویر را برای خروجی آماده کند.'); }
  if (format === 'jpeg') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('ساخت فایل خروجی ناموفق بود.')), mime, format === 'png' ? undefined : quality / 100);
  });
  return { blob, width: canvas.width, height: canvas.height, mime };
}

function orientationNeedsBake(analysis: ImageAnalysis) {
  const raw = analysis.raw.Orientation;
  if (raw == null) return false;
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
  return !/(?:^|\D)1(?:\D|$)|horizontal|normal|top[- ]?left|upper[- ]?left/i.test(text);
}

export function downloadSanitized(result: SanitizerResult) {
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function sanitizeImage(file: File, analysis: ImageAnalysis, options: SanitizerOptions): Promise<SanitizerResult> {
  const sourceBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(sourceBuffer);
  const wantsOriginal = options.format === 'original';
  const nativeSupported = isPng(bytes) || isJpeg(bytes) || isWebp(bytes);
  const mustBakeOrientation = wantsOriginal && isJpeg(bytes) && orientationNeedsBake(analysis);

  if (wantsOriginal && nativeSupported && !mustBakeOrientation) {
    const stripped = stripPng(bytes, options.mode, analysis) ?? stripJpeg(bytes, options.mode, analysis) ?? stripWebp(bytes, options.mode, analysis);
    if (!stripped) throw new Error('پاک‌سازی مستقیم این فایل ممکن نشد.');
    const mime = isPng(bytes) ? 'image/png' : isJpeg(bytes) ? 'image/jpeg' : 'image/webp';
    const blob = new Blob([stripped.bytes], { type: mime });
    return {
      blob,
      fileName: sanitizeFileName(file.name, mime),
      mimeType: mime,
      originalSize: file.size,
      cleanedSize: blob.size,
      removedItems: stripped.removed,
      lossless: true,
      pixelDataPreserved: true,
      outputWidth: analysis.width,
      outputHeight: analysis.height,
      note: stripped.removed.length ? 'داده تصویری دوباره فشرده نشده و کیفیت تصویر دست‌نخورده است.' : 'موردی برای حذف پیدا نشد؛ داده تصویری بدون تغییر باقی ماند.',
    };
  }

  const targetFormat: Exclude<SanitizerOptions['format'], 'original'> = options.format === 'original' ? 'png' : options.format;
  const converted = await canvasReencode(file, targetFormat, options.quality);
  const removed = ['EXIF', 'XMP / IPTC', 'Prompt / Workflow', 'Content Credentials / C2PA', 'توضیحات و متادیتای جانبی'];
  const isLosslessOutput = targetFormat === 'png';
  return {
    blob: converted.blob,
    fileName: sanitizeFileName(file.name, converted.mime),
    mimeType: converted.mime,
    originalSize: file.size,
    cleanedSize: converted.blob.size,
    removedItems: removed,
    lossless: isLosslessOutput,
    pixelDataPreserved: false,
    outputWidth: converted.width,
    outputHeight: converted.height,
    note: mustBakeOrientation
      ? 'برای حفظ جهت درست تصویر، پیکسل‌ها با همان ابعاد نمایشی به PNG منتقل شدند و متادیتا حذف شد.'
      : isLosslessOutput
        ? 'خروجی PNG است و فشرده‌سازی مخرب ندارد، اما فایل دوباره از روی پیکسل‌ها ساخته شده است.'
        : `فایل با کیفیت ${options.quality.toLocaleString('fa-IR')}٪ دوباره کدگذاری شده است؛ JPEG و WebP ذاتاً می‌توانند کمی افت داشته باشند.`,
  };
}
