# AI Detector

AI Detector is a privacy-first image provenance inspector and metadata sanitizer. It examines the evidence embedded in an image and classifies it as AI-generated, AI-edited, camera-captured, or unknown.

The interface is in Persian, supports light and dark themes, and uses a locally hosted Vazirmatn font.

## What it inspects

- EXIF camera, lens, exposure, date, software, and GPS fields
- XMP metadata and embedded editing history
- PNG text chunks, generation parameters, prompts, negative prompts, seeds, samplers, models, and ComfyUI workflows
- Markers associated with Stable Diffusion, ComfyUI, FLUX, Midjourney, DALL-E, Adobe Firefly, and other generators or editors
- C2PA / Content Credentials manifests, signatures, source types, and recorded actions
- File-container evidence that can distinguish AI generation, AI-assisted editing, camera capture, or an unknown source

## Metadata sanitizer

The built-in sanitizer can create a clean copy with metadata removed. PNG, JPEG, and WebP support lossless metadata removal when the original format is retained; supported browser image formats can also be exported to PNG, JPEG, or WebP.

## Privacy

Image analysis and sanitization happen entirely in the browser. Selected files are not uploaded to an application server.

## Supported formats

The analyzer accepts PNG, JPEG, WebP, GIF, TIFF, HEIC, and HEIF images. Metadata availability varies by format, browser support, and the information retained by the software that produced the file.

## Tech stack

- React 19 and TypeScript
- Vite
- Tailwind CSS
- ExifReader
- `@contentauth/c2pa-web` for C2PA / Content Credentials
- Lucide React icons

## Local development

Requires Node.js 22 or later.

```bash
npm ci
npm run dev
```

## Production build

Run the same checks used for deployment:

```bash
npm run lint
npm run build
```

The production output is written to `dist/`.

## GitHub Pages deployment

The workflow in `.github/workflows/deploy-pages.yml` runs on every push to `main`. It installs the locked dependencies with `npm ci`, builds the Vite app, uploads `dist/` as the Pages artifact, and deploys it with the official GitHub Pages Actions.

The site uses relative Vite asset paths so the same build works at both the repository Pages URL and the custom domain:

- `https://imoein.github.io/ai-detector/`
- `https://ai-detector.imoein.com`

The custom domain is declared in `public/CNAME`. Its DNS record must be a CNAME from `ai-detector` to `imoein.github.io`.

## Limitations and disclaimer

The result is based on metadata and provenance evidence found in the file. Metadata can be removed, altered, forged, or lost during export, download, messaging, or recompression. A result—including the absence of AI markers—is not absolute forensic proof that an image is authentic, synthetic, or unedited.
