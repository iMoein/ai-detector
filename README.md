# AI Detector

A privacy-first, client-side image provenance inspector and metadata sanitizer.

The app analyzes image files locally in the browser to surface camera EXIF data, AI-generation and AI-editing markers, PNG generation parameters, C2PA / Content Credentials, prompts, workflow metadata, and edit history. It can also create sanitized copies with metadata removed while preserving image data losslessly for supported formats.

## Features

- AI-generated vs AI-edited vs camera-captured vs unknown classification
- C2PA / Content Credentials parsing and validation
- ComfyUI, Stable Diffusion WebUI, FLUX, Midjourney, DALL-E, Firefly and editor marker detection
- Prompt, negative prompt, seed, sampler, model and workflow extraction when embedded
- EXIF, XMP and file-structure inspection
- Lossless metadata stripping for PNG, JPEG and WebP when keeping the original format
- Fully client-side processing; images are not uploaded to an application server
- Persian RTL interface with locally hosted Vazirmatn font

## Local development

```bash
npm ci
npm run dev
```

Production checks:

```bash
npm run lint
npm run build
```

## Deployment

The repository includes a GitHub Pages workflow. Pushes to `main` automatically build and deploy the Vite application.

Custom domain:

```text
ai-detector.imoein.com
```

The DNS record should be a `CNAME` from `ai-detector` to `imoein.github.io`.

## Privacy note

Analysis and sanitization run in the browser. Detection is evidence-based: missing metadata does not prove that an image is authentic or synthetic.
