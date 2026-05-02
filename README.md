# CEPTI

Marketing + product catalog website for CEPTI (decorative finishes, Dominican Republic). Bilingual (ES/EN), localized via Next.js App Router, deployed on Vercel.

This README captures the conventions that grew up around this project so the next person (or a sister project) can replicate it without rediscovering the gotchas.

---

## Stack

- **Next.js 16** (App Router, Turbopack, React 19)
- **Tailwind CSS v4** (no separate config — theme is inlined in `app/globals.css` via `@theme inline`)
- **TypeScript 5**
- **lucide-react** for icons, **jspdf** for the analyzer PDF export
- **No CMS** — content lives in `data/products.json` + the JSON dictionaries

## Local dev

```bash
npm install
npm run dev   # next dev -p 4000
npm run build # full prod build, runs typecheck + SSG
npm run lint
```

The dev server uses port 4000, not 3000.

---

## Project layout (one level)

```
app/[lang]/        Localized App Router pages (es, en)
  layout.tsx       Loads dict, renders Navbar + Footer + global ChatbotCEPTI
  page.tsx         Homepage (Hero + Products grid + WhyUs)
  productos/       Product list + dynamic [slug] detail page
  galeria/         Master "Ver detalles" gallery (sectioned by product)
  calculadora/     Materials calculator
  contacto/        Contact card
  sobre-nosotros/  About page (with Galería teaser)
  analyzer/        Surface analyzer (upload photo, before/after preview, PDF)
  dictionaries.ts  + dictionaries/{es,en}.json
components/        UI components (sections, layout, products, gallery, calculator, analyzer)
data/products.json Brand info + all 8 products + project metadata
lib/products.ts    Server-only helpers (file lookups, lang picker)
lib/calculator.ts  Calculator math + WhatsApp message builder
public/images/     Brand assets, product photos, visualizer SVGs
public/videos/     Product videos
proxy.ts           Middleware that prefixes paths with /es when no locale present
next.config.ts     Excludes public/ from function tracing (see "Vercel gotchas")
```

---

## Content model

### `data/products.json`

Single source of truth for products and brand info. Each product:

```jsonc
{
  "slug": "papelex",
  "order": 5,
  "show_on_homepage": true,
  "name":        { "es": "...", "en": "..." },
  "tagline":     { "es": "...", "en": "..." },
  "description": { "es": "...\n\n...", "en": "..." },   // \n\n for paragraph breaks
  "properties":  { "es": [...], "en": [...] },
  "use_cases":   { "es": [...], "en": [...] },
  "catalog_codes": ["01", "02", ...],                    // 2-digit zero-padded
  "image_folder": "/images/products/papelex/",
  "coverage_m2_per_unit": 1,
  "unit_label":  { "es": "placa", "en": "plate" },
  "whatsapp_template": { "es": "...", "en": "..." }
}
```

`pickLang(field, lang)` in `lib/products.ts` extracts the right language.

### Dictionaries

UI strings live in `app/[lang]/dictionaries/{es,en}.json`. Loaded server-side per request via `getDictionary(lang)`. Product copy stays in `products.json`; only chrome (nav labels, CTA buttons, section titles) lives in dictionaries.

---

## Asset conventions

This is where most of the project-specific structure lives. Stick to these names and the existing helpers Just Work.

### Brand assets — `public/images/brand/`

| File | Used by |
|---|---|
| `LOGO_WHITE.png` | Footer (separated logo) |
| `LogoBlack_WhiteBackground_Nerrow_bobers.png` | Navbar |
| `Background_plain.jpg` | Plain brown bg fallback |
| `Building.png` | Homepage hero (transparent building) |
| `Chat_Icon.png` | Floating "Asesor CEPTI" bubble + product CTAs |
| `Calculadora_Cover.png` / `SobreNosotros_Cover.png` / `Productos_Cover.png` | Top-strip backgrounds for those pages |
| `SobreNosotros_Body.jpg` | In-body image on /sobre-nosotros |

Hero overlay uses `bg-stone-900/50` over the cover image so white text stays readable.

### Product photos — `public/images/products/<slug>/`

```
<slug>/
  card.<ext>           Used on homepage card + /productos listing
  hero.<ext>           Top hero strip on the product detail page
  texture-NN.<ext>     Catálogo de colores y texturas (one per catalog_code)
  project-NN.<ext>     Galería (installation photos)
```

Lookup is handled by `getProductImages(product)` in `lib/products.ts`, which:

- Tries `.jpg`, `.jpeg`, `.png`, `.webp` for each base name
- Falls back: if `card` is missing, uses `hero`
- Reads project images by scanning the folder for `project-*.{jpg,jpeg,png,webp}`

### Videos — `public/videos/products/<slug>/`

```
<slug>/
  video-NN.mp4
```

`getProductVideos(product)` scans the folder; the Videos section auto-renders if any are present.

### Visualizer SVGs — `public/images/visualizer/`

The "Vista previa en pared" wall preview uses **layered SVGs** so the texture overlay sits between the wall background and foreground objects (window, table). Convention:

- `<scene>.svg` — original/single-layer fallback
- `<scene>-bg.svg` — wall + floor + lighting (covered by texture)
- `<scene>-fg.svg` — windows, furniture (sits ABOVE texture so it isn't smothered)

`TextureVisualizer` derives `-bg`/`-fg` paths from the reference src automatically.

### Catalog code naming

2-digit zero-padded strings: `"01"`, `"02"`, … `"46"`. Used both as the visible code label on a swatch and to build the texture filename (`texture-01.jpg`).

---

## i18n + middleware

`proxy.ts` (Next 16's renamed `middleware.ts`) redirects unprefixed URLs to `/es`. **Critical**: its matcher must exclude every static asset path, otherwise the proxy 307-redirects asset requests into a `/es/...` void. Current excludes:

```ts
matcher: ['/((?!_next|api|favicon.ico|images|videos|fonts).*)']
```

If you add a new top-level static folder (e.g. `/audio/`), add it here.

The `[lang]` segment in `app/[lang]/` only renders for `es` or `en` (`hasLocale` check). `generateStaticParams` returns both at build time so all routes are SSG'd.

---

## Adding a new product

1. Append to `data/products.json` `products` array (next `order`, unique `slug`, both languages).
2. Drop assets into `public/images/products/<slug>/` following the naming convention above.
3. (Optional) Drop videos into `public/videos/products/<slug>/`.
4. (Optional) Add to `MASTER_GALLERY_SLUGS` in `app/[lang]/productos/[slug]/page.tsx` if it should appear on `/galeria` and get a "Ver detalles" link from its inline gallery.
5. (Optional) Add to `VISUALIZER_MAP` in the same file to enable the wall preview.
6. Run `npm run build` to confirm it picks up.

`generateStaticParams` automatically picks up the new slug from `getAllProducts()`.

## Adding a new page

Mirror the existing pattern: `app/[lang]/<route>/page.tsx`, async default export with `generateStaticParams` + `generateMetadata` + `notFound()` if `!hasLocale`.

For the brown hero strip + content split, copy the structure from `sobre-nosotros/page.tsx` (`max-w-3xl` container, `Background_plain.jpg` or a cover bg with a `bg-stone-900/50` overlay).

---

## Importing assets in bulk

Example Python script for renaming a Drive-style folder dump (`Catalogo/1.jpg, 2.jpg…`) into the project's naming convention:

```python
import os, shutil, re
SRC = "/path/to/source/Photos+/Papelex/Catalogo"
DST = "/path/to/repo/public/images/products/papelex"

def num_key(name):
    nums = re.findall(r"\d+", os.path.splitext(name)[0])
    return int(nums[0]) if nums else 0

files = sorted(
    [f for f in os.listdir(SRC) if f.lower().endswith(('.jpg','.jpeg','.png','.webp'))],
    key=num_key,
)
for i, f in enumerate(files, 1):
    ext = os.path.splitext(f)[1].lower().replace(".jpeg", ".jpg")
    shutil.copy(f"{SRC}/{f}", f"{DST}/texture-{i:02d}{ext}")
```

After importing, update `catalog_codes` in `products.json` to match the count.

## Encoding videos for the web

Source phone videos can be 100+ MB at 4K — way too big to ship. Re-encode to ~720p H.264 with faststart for streaming. The scale filter handles both portrait and landscape, forcing even dimensions:

```bash
ffmpeg -y -i input.mp4 \
  -c:v libx264 -crf 28 -preset medium \
  -vf "scale='if(gt(iw,ih),-2,trunc(720*iw/ih/2)*2)':'if(gt(iw,ih),720,720)'" \
  -c:a aac -b:a 96k -ac 2 \
  -movflags +faststart \
  output.mp4
```

Typical reduction: 100 MB 4K HEVC → 3 MB 720p H.264.

---

## Deployment

Auto-deploys on push to `main` via Vercel (project: `cepti`).

### Vercel gotchas hit during this build

1. **Function size limit (300 MB).** `lib/products.ts` does `fs.readdirSync(publicPath(...))` to discover project images. Next's tracer sees that and bundles the entire `public/` tree into the `[lang]` serverless function. Fix in `next.config.ts`:

   ```ts
   outputFileTracingExcludes: { '*': ['./public/**'] }
   ```

   `public/` is served separately as static assets on the CDN; the function never needs the files at runtime since pages are SSG'd.

2. **Proxy redirecting static assets.** The `/videos` path was missing from the proxy matcher's exclusion list, so video URLs were 307-redirected to `/es/videos/...` and broke. Always add new top-level static folders to `proxy.ts`.

3. **`overflow-x: hidden` on `<html>` breaks sticky.** Use `overflow-x: clip` on `<body>` instead — preserves sticky positioning of the navbar.

4. **Hero text on cover photos.** Avoid `opacity-50` on the image; use a `bg-stone-900/50` overlay div on top of a full-strength image for readability without washing out the photo.

---

## Where to find specific things

| Thing | File |
|---|---|
| Floating chat bubble | `components/ChatbotCEPTI.tsx` (mounted in `app/[lang]/layout.tsx`) |
| Top nav + active state (incl. hash-link logic for `#porque-cepti`) | `components/layout/Navbar.tsx` + `NavLinks.tsx` |
| Footer (separated logo + plain bg + responsive slogan) | `components/layout/Footer.tsx` |
| Homepage hero (stacked on mobile, side-by-side at `lg+`) | `components/sections/Hero.tsx` |
| Product grid card | `components/sections/Products.tsx` |
| Product detail page (hero, description, properties, use cases, catalog, visualizer, gallery, video, calculator, CTA) | `components/products/ProductDetail.tsx` |
| Wall preview (layered SVG bg → texture → fg) | `components/products/TextureVisualizer.tsx` |
| Lightbox with prev/next/keyboard nav (used by both Galería + Catálogo) | `components/products/Lightbox.tsx` |
| Master gallery sections (one Lightbox per section) | `components/gallery/GallerySection.tsx` |
| Calculator | `components/calculator/Calculadora.tsx` + `CalculatorMini.tsx` |
| Surface analyzer (canvas-based before/after, per-product texture overlay with `multiply` blend) | `components/analyzer/Analyzer.tsx` |
| Brand colors + global CSS | `app/globals.css` |
