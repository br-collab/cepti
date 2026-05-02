# CEPTI

The CEPTI website — a marketing + product catalog site for CEPTI, a decorative-finishes company in the Dominican Republic. The site shows the products, lets visitors estimate how much material they need, lets them upload a photo of their own surface to preview a finish, and routes them to WhatsApp to start a conversation.

This README is meant to be picked up by anyone — an analyst with no coding background, a project manager, or a developer dropping in for the first time. It walks through what got built, why decisions were made, how to do the most common updates yourself, and (at the end) a technical reference for anyone editing code.

> **Quick reader's guide:**
> If you don't write code, read sections **1 → 5** and stop. Section **6** is the technical reference and you can safely skip it.

---

## 1. What this site is, in plain English

The site is a multi-page marketing website for CEPTI. It has:

- A **homepage** that introduces the brand and shows the eight products in a grid.
- A **product detail page** for each of the eight products, with description, properties, applications, a color/texture catalog, a wall preview, an installation gallery, sometimes videos, and a built-in calculator that figures out how much product is needed.
- A **calculator page** with the same calculator at full size for any product.
- A **gallery page** that shows every installation photo grouped by product.
- An **about page** with a teaser gallery at the bottom.
- A **contact page** with the company's address, email, social links, etc.
- A **surface analyzer** where someone uploads a photo of their wall and previews what a CEPTI finish would look like on it, then downloads a PDF or pings WhatsApp.
- A **floating chat advisor** ("Asesor CEPTI") that appears in the bottom-right corner of every page.
- Two languages, **Spanish** and **English**, with a switcher in the top nav and footer.

The site is hosted on Vercel and deploys automatically every time code is pushed to the `main` branch on GitHub.

**Glossary** for words used below:

- **Vercel** — the company that hosts the website. When we "push" code, Vercel takes that code, builds the site, and puts it live within about a minute.
- **Repo / repository** — the folder of code that defines the website. Lives on GitHub at `br-collab/cepti`.
- **Commit** — a saved snapshot of code changes with a description.
- **Push** — sending those snapshots from a local machine up to GitHub.
- **Build** — Vercel taking the code and turning it into the actual live website.
- **Deploy** — making a particular build live to the public.
- **Slug** — the short, URL-friendly name of a product (e.g. `papelex`, `ladriflex`). Shows up in the page address.

---

## 2. The journey — what got built and why

The work happened in eight phases. Each one was scoped, built, deployed, reviewed, and adjusted before moving on. Knowing the order helps when you read commit history or revisit decisions.

### Phase 1 — Quick wins (text, copy, small fixes)
Replaced the chat-bubble emoji with a real icon. Made the chat bubble appear on every page (it used to only show on the homepage). Removed "Arte con Arena y Piedra" from the materials calculator (no formula exists for it). Hid the calculator on the Arte con Arena product page. Updated the long-form Spanish descriptions for three products. Rebuilt the contact page so the heading is just "Contacto" with reordered fields and the company's brand colors. Fixed a small bug where the "¿Por qué CEPTI?" nav button didn't show as "active" when clicked.

### Phase 2 — Layout pass
A few visual issues were happening at every screen size: a thin white strip on the right edge of every page, the footer slogan getting cut off instead of wrapping, the bottom strip's logo being baked into the background image. Fixed all three with a global CSS rule, by separating the logo into its own image, and by aligning the brown header strips on the Calculadora and Contacto pages with the content below them (matching the existing "Sobre nosotros" page convention).

### Phase 3 — Homepage hero
The top of the homepage had a building illustration baked into the background image. On phones it got cut off. We split the building out into its own transparent image, set up the layout to stack the building on top and text below at small screen sizes, and put them side-by-side on larger screens.

### Phase 4 — Responsive nav
On medium-sized screens the "Productos" menu button crowded the logo, and the logo would visibly squish. We changed the breakpoint where the menu collapses into a hamburger so it kicks in earlier (before the logo can get crowded), and locked the logo to a fixed maximum width so it can't squish.

### Phase 5 — Color/texture catalog and wall preview rolled out to every product
Originally only the "Pintura con Efecto Piedra" page had the color catalog and wall preview features. We extended both to four more products (Aterciopelada, Granito Líquido + Pintura con Efecto Granito combined, Papelex, Ladriflex) by importing the right photos and wiring them up. The Arte con Arena page got a custom "Ejemplos" section instead.

### Phase 6 — Galería section + master gallery page
Each product page got a small "Galería" preview (six photos) with a "Ver detalles" button that links to the master gallery page. The master gallery page is one long scrollable page divided into sections by product, in a specific order. The "Sobre nosotros" page got a Galería teaser at the bottom too. Primer and Pegamento have galleries on their own pages but don't appear in the master gallery (per spec).

### Phase 7 — Cover photos
Every empty brown placeholder in the layout got a real photo. The eight homepage cards each got a cover image (10.png, 20.jpg, etc.). The seven main product subpages each got a different cover for their hero strip (21.png, 31.png, etc.). The Calculadora, Sobre Nosotros, and Productos pages each got their own named cover image.

### Phase 8 — Videos
Some products have video files showing the material being applied or installed. The big phone-shot videos (over 100 MB each at 4K) were too large to put on the web — we re-encoded them down to about 3 MB each at 720p without losing perceptible quality, and added a "Vídeos" section to the product pages that have videos (Ladriflex, Papelex, Granito Líquido / Pintura con Efecto Granito).

### Polishing fixes
After Phase 8 we tightened a few things based on review:
- **Wall preview**: the texture overlay was covering the window and table in the preview image. Fixed by splitting the reference picture into a "behind" layer and a "front" layer so the texture sits between them.
- **Surface analyzer**: the "after" side of the before/after comparison was just a flat color tint. Replaced it with the actual product texture, blended over the photo so the original lighting and shadows come through.
- **Galería + Catálogo**: clicking a thumbnail just opened the picture with no way to navigate. Added a lightbox with left/right arrow buttons, keyboard arrow support, escape-to-close, and a counter at the bottom. In the catalog, navigating left/right also updates the wall preview behind the lightbox so colors swap on the wall as you flip through.

---

## 3. Decisions that came up along the way

These are the calls that were made during the build and the reasoning behind them — useful context if you ever wonder "why did they do it that way?"

### Where to put assets

CEPTI provided two folders of source material: `Cover_Photos/` (with cover/hero images for various pages) and `Photos+/` (with hundreds of installation photos, color catalog photos, and product videos). The user confirmed the mapping before we started:

- **Cover_Photos** numbered files (`10.png` through `80.jpg`) → the 8 homepage product cards. Same files reused on the `/productos` listing page in a different layout.
- **Cover_Photos** secondary numbered files (`21.png` through `88.jpg`) → top hero strips on individual product pages. Arte con Arena y Piedra was the exception and reuses its homepage card image.
- **Cover_Photos** named files (`Calculadora_Cover.png`, etc.) → top strips of the corresponding pages.
- **Photos+** subfolders contain `Catalogo/` and `Interior+Exterior/` for each product. `Catalogo` photos became color/texture swatches in the catalog section; `Interior+Exterior` photos became installation photos in the Galería section.
- **Pintura con Efecto Granito** and **Granito Líquido** are listed as separate products in the Photos+ folder but render on the same product page on the website — so their photos got combined.
- **Primer** and **Pegamento** photos appear only on their own product page, not in the master gallery.
- **Videos** appear on the product page they belong to, in a "Vídeos" section. Ladriflex and Papelex videos came from WhatsApp at small sizes (4–10 MB) and shipped as-is. The Granito videos came from a Pixel phone at 100+ MB each and were re-encoded to ~3 MB each.

### Single-page galleries vs the master gallery
We considered two options for the gallery: show every photo on every product page, or show a small preview with a "see more" link to a dedicated gallery page. Picked the second option because some products had 50+ installation photos and dumping them all inline would have made the product page extremely long.

### Spanish descriptions
The user provided new long-form Spanish descriptions for three products. We updated those in the data file. The English versions stayed at the existing shorter copy because the user didn't provide updated English text. If/when English translations are provided, only the data file needs to be updated.

### Cropping vs not cropping
The texture overlay in the wall preview was originally clipped using a single rectangle that covered the wall area. That rectangle covered the window too. We could have used a complex clipping mask but instead split the reference image into two layered images — the wall + floor in the back, the window + furniture in the front, with the texture sandwiched in the middle. Simpler and easier to maintain.

### Video compression
Phone videos came out of the camera at 4K with HEVC (H.265) encoding, around 70–115 MB each. We re-encoded them to 720p with H.264 (more universally supported) at a moderate quality setting, plus an "AAC" audio track and a "faststart" flag so videos start playing before the whole file downloads. The total dropped from 308 MB to 40 MB — a ~96% reduction with no perceptible quality loss for web playback.

---

## 4. How to do the most common updates yourself

This section is written for someone with no coding experience but access to the GitHub repo. You can do all of these from the GitHub website by editing files in the browser.

### Update a product description
- Open the file `data/products.json` on GitHub.
- Find the product by its `slug` (e.g. `"papelex"`).
- Edit the `description.es` (Spanish) or `description.en` (English) text.
- Use `\n\n` between paragraphs (two backslash-n characters in a row) for paragraph breaks.
- Commit the change with a short message like "Update Papelex description".
- Vercel will redeploy automatically within a minute.

### Replace a product photo
- Each product has its own folder at `public/images/products/<slug>/`.
- The card thumbnail (used on homepage + listing) is `card.jpg` (or `.png`).
- The hero strip image (top of the product page) is `hero.jpg`.
- Color catalog photos are `texture-01.jpg` through `texture-NN.jpg`.
- Installation photos are `project-01.jpg` through `project-NN.jpg`.
- Upload a replacement file with the same name to overwrite. Vercel will redeploy.

### Add a new color to a product's catalog
- Add a new image file to that product's folder named `texture-NN.jpg` (the next number in sequence — e.g. if there are 9 textures, add `texture-10.jpg`).
- In `data/products.json`, find that product's `catalog_codes` list and add the new code as a string (e.g. `"10"`).
- Commit. Vercel will redeploy and the new color will appear in the catalog grid.

### Update contact info
- The contact page address, email, Instagram, and website are hardcoded in `components/sections/Contact.tsx`.
- Phone, Facebook, Threads, and WhatsApp are placeholders pending real data — update them in the same file.

### Change a navigation label or section title
- Open `app/[lang]/dictionaries/es.json` (Spanish) or `en.json` (English).
- Find the label and edit. The same labels are used across all pages.

### Update the materials calculator coverage rate
- In `data/products.json`, find the product and update the `coverage_m2_per_unit` number. This is how many square meters one unit of the product covers.

### Add a new video to a product
- Drop the video file (`.mp4`) into `public/videos/products/<slug>/`. Name it `video-01.mp4` (or the next number if there are already videos there).
- The "Vídeos" section will automatically appear on that product's page after Vercel redeploys.
- **Important**: web videos should be small (under 10 MB). If your video is bigger, ask a developer to compress it first.

### Adjust the master gallery order
- The master gallery page is at the URL `/galeria`. The order of sections is set in `app/[lang]/productos/[slug]/page.tsx` in a list called `MASTER_GALLERY_SLUGS`.
- Change the order by reordering the slugs in that list.

---

## 5. The Corrections folder

The original spec for this work lived in a Microsoft Word document at `Corrections/Corrections+/Website_corrections+.docx`, plus a second document `Corrections/Cover_Photos/Photos_insertion_guide.docx` that came in later for the cover-photo work. The asset folders (`Corrections/Cover_Photos/`, `Corrections/Photos+/`, `Corrections/Videos/`) sit alongside.

If you're picking up this project in the future and you need to understand what was asked for and why, those documents are the source of truth for the original ask. The decisions log in section 3 of this README captures everything that was clarified verbally on top of those docs.

---

## 6. Technical reference

> Skip this section unless you're editing the code yourself.

### Stack

- Next.js 16 (App Router, Turbopack, React 19, TypeScript 5)
- Tailwind CSS v4 (no separate config — theme inlined in `app/globals.css` via `@theme inline`)
- lucide-react for icons, jspdf for the Analyzer's PDF export
- No CMS — content lives in `data/products.json` and `app/[lang]/dictionaries/*.json`

### Local dev

```bash
npm install
npm run dev   # next dev -p 4000
npm run build # full prod build, runs typecheck + SSG
npm run lint
```

The dev server uses port 4000.

### Project layout

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
data/products.json Brand info + 8 products + project metadata
lib/products.ts    Server-only helpers (file lookups, lang picker)
lib/calculator.ts  Calculator math + WhatsApp message builder
public/images/     Brand assets, product photos, visualizer SVGs
public/videos/     Product videos
proxy.ts           Middleware that prefixes paths with /es when no locale present
next.config.ts     Excludes public/ from function tracing (see "Vercel gotchas")
```

### Content model

Each product in `data/products.json`:

```jsonc
{
  "slug": "papelex",
  "order": 5,
  "show_on_homepage": true,
  "name":        { "es": "...", "en": "..." },
  "tagline":     { "es": "...", "en": "..." },
  "description": { "es": "...\n\n...", "en": "..." },
  "properties":  { "es": [...], "en": [...] },
  "use_cases":   { "es": [...], "en": [...] },
  "catalog_codes": ["01", "02", ...],
  "image_folder": "/images/products/papelex/",
  "coverage_m2_per_unit": 1,
  "unit_label":  { "es": "placa", "en": "plate" },
  "whatsapp_template": { "es": "...", "en": "..." }
}
```

`pickLang(field, lang)` in `lib/products.ts` extracts the right language. UI chrome strings (nav labels, CTA buttons, section titles) live in dictionaries; product copy lives in `products.json`.

### Asset conventions

**Brand assets** (`public/images/brand/`):

| File | Used by |
|---|---|
| `LOGO_WHITE.png` | Footer (separated logo) |
| `LogoBlack_WhiteBackground_Nerrow_bobers.png` | Navbar |
| `Background_plain.jpg` | Plain brown background fallback |
| `Building.png` | Homepage hero (transparent) |
| `Chat_Icon.png` | Floating chat bubble + product CTA bands |
| `Calculadora_Cover.png` / `SobreNosotros_Cover.png` / `Productos_Cover.png` | Top-strip backgrounds |
| `SobreNosotros_Body.jpg` | In-body image on /sobre-nosotros |

Hero strips overlay `bg-stone-900/50` on top of the cover image so white text stays readable.

**Product photos** (`public/images/products/<slug>/`):

```
<slug>/
  card.<ext>        Used on homepage card + /productos listing
  hero.<ext>        Top hero strip on the product detail page
  texture-NN.<ext>  Catálogo de colores y texturas (one per catalog_code)
  project-NN.<ext>  Galería (installation photos)
```

`getProductImages(product)` in `lib/products.ts`:
- tries `.jpg`, `.jpeg`, `.png`, `.webp` for each base name
- falls back: if `card` is missing, uses `hero`
- scans the folder for `project-*.{jpg,jpeg,png,webp}`

**Videos** (`public/videos/products/<slug>/`):

```
<slug>/
  video-NN.mp4
```

`getProductVideos(product)` scans the folder; the Videos section auto-renders if any are present.

**Visualizer SVGs** (`public/images/visualizer/`): the wall preview uses layered SVGs so the texture overlay sits between background and foreground. Convention:

- `<scene>.svg` — original/single-layer fallback
- `<scene>-bg.svg` — wall + floor + lighting (covered by texture)
- `<scene>-fg.svg` — windows, furniture (sits ABOVE texture)

`TextureVisualizer` derives `-bg`/`-fg` paths from the reference src automatically.

**Catalog code naming**: 2-digit zero-padded strings (`"01"` … `"46"`). Used both as the visible label on a swatch and to build the texture filename.

### i18n + middleware

`proxy.ts` (Next 16's renamed `middleware.ts`) redirects unprefixed URLs to `/es`. **Critical**: its matcher must exclude every static asset path, otherwise the proxy 307-redirects asset requests into a `/es/...` void. Current excludes:

```ts
matcher: ['/((?!_next|api|favicon.ico|images|videos|fonts).*)']
```

If you add a new top-level static folder (e.g. `/audio/`), add it here. The `/videos` exclusion was added retroactively after the Phase 8 deploy showed broken video players.

The `[lang]` segment only renders for `es` or `en` (`hasLocale` check). `generateStaticParams` returns both at build time so all routes are SSG'd.

### Adding a new product (developer steps)

1. Append to `data/products.json` `products` array (next `order`, unique `slug`, both languages).
2. Drop assets into `public/images/products/<slug>/` following the naming convention.
3. (Optional) Drop videos into `public/videos/products/<slug>/`.
4. (Optional) Add to `MASTER_GALLERY_SLUGS` in `app/[lang]/productos/[slug]/page.tsx` to appear on `/galeria`.
5. (Optional) Add to `VISUALIZER_MAP` in the same file to enable the wall preview.
6. Run `npm run build` to confirm.

### Bulk asset import script

Example for renaming a Drive-style folder dump (`Catalogo/1.jpg, 2.jpg…`) into the project's naming convention:

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

### Encoding videos for the web

Source phone videos (4K HEVC) are way too big to ship. Re-encode to ~720p H.264 with faststart. The scale filter handles both portrait and landscape, forcing even dimensions:

```bash
ffmpeg -y -i input.mp4 \
  -c:v libx264 -crf 28 -preset medium \
  -vf "scale='if(gt(iw,ih),-2,trunc(720*iw/ih/2)*2)':'if(gt(iw,ih),720,720)'" \
  -c:a aac -b:a 96k -ac 2 \
  -movflags +faststart \
  output.mp4
```

Typical reduction: 100 MB 4K HEVC → 3 MB 720p H.264.

### Vercel gotchas hit during this build

1. **Function size limit (300 MB).** `lib/products.ts` does `fs.readdirSync(publicPath(...))` to discover project images. Next's tracer sees that and bundles the entire `public/` tree into the `[lang]` serverless function. Fix in `next.config.ts`:

   ```ts
   outputFileTracingExcludes: { '*': ['./public/**'] }
   ```

   `public/` is served separately as static assets on the CDN; the function doesn't need the files at runtime since pages are SSG'd.

2. **Proxy redirecting static assets.** `/videos` was missing from the proxy matcher's exclusion list, so video URLs were 307-redirected to `/es/videos/...` and broke. Always add new top-level static folders to `proxy.ts`.

3. **`overflow-x: hidden` on `<html>` breaks sticky.** Use `overflow-x: clip` on `<body>` instead — preserves sticky positioning of the navbar.

4. **Hero text on cover photos.** Avoid `opacity-50` on the image; use a `bg-stone-900/50` overlay div on top of a full-strength image for readability without washing out the photo.

### Where to find specific things

| Thing | File |
|---|---|
| Floating chat bubble | `components/ChatbotCEPTI.tsx` (mounted in `app/[lang]/layout.tsx`) |
| Top nav + active state (incl. hash-link logic for `#porque-cepti`) | `components/layout/Navbar.tsx` + `NavLinks.tsx` |
| Footer (separated logo + plain bg + responsive slogan) | `components/layout/Footer.tsx` |
| Homepage hero (stacked on mobile, side-by-side at `lg+`) | `components/sections/Hero.tsx` |
| Product grid card | `components/sections/Products.tsx` |
| Product detail page (hero, description, properties, use cases, catalog, visualizer, gallery, video, calculator, CTA) | `components/products/ProductDetail.tsx` |
| Wall preview (layered SVG bg → texture → fg) | `components/products/TextureVisualizer.tsx` |
| Lightbox with prev/next/keyboard nav (used by Galería + Catálogo) | `components/products/Lightbox.tsx` |
| Master gallery sections (one Lightbox per section) | `components/gallery/GallerySection.tsx` |
| Calculator | `components/calculator/Calculadora.tsx` + `CalculatorMini.tsx` |
| Surface analyzer (canvas-based before/after, per-product texture overlay with `multiply` blend) | `components/analyzer/Analyzer.tsx` |
| Brand colors + global CSS | `app/globals.css` |
