/**
 * scripts/build-product-images.mjs
 *
 * Build-time generator for the SMA product-image manifest.
 *
 * Why this exists: `next.config.ts` excludes `public/**` from the deployed
 * serverless function (outputFileTracingExcludes). The SMA agents therefore
 * cannot `fs.readdirSync` the product image folders at runtime on Vercel —
 * the read returns nothing and no pictures get attached.
 *
 * This script runs at build time (via the `prebuild` npm hook), when `public/`
 * is present, and writes a static manifest of slug -> [image URL paths] to
 * `data/product-images.json`. That JSON is imported (and bundled) by
 * `lib/sma/products-service.ts`, so image discovery no longer touches the
 * filesystem at runtime. The image bytes are still served by the CDN at the
 * same URL paths.
 *
 * Run manually:  node scripts/build-product-images.mjs
 */

import fs from 'fs'
import path from 'path'

const root = process.cwd()
const catalogPath = path.join(root, 'data/products.json')
const outPath = path.join(root, 'data/product-images.json')

const IMAGE_RE = /\.(jpg|jpeg|png|webp)$/i

function main() {
  if (!fs.existsSync(catalogPath)) {
    console.error('[build-product-images] data/products.json not found at', catalogPath)
    process.exit(1)
  }

  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'))
  const products = Array.isArray(catalog.products) ? catalog.products : []

  /** @type {Record<string, string[]>} */
  const manifest = {}

  for (const product of products) {
    if (!product?.slug) continue
    manifest[product.slug] = []

    if (!product.image_folder) continue
    const folderPath = path.join(root, 'public', product.image_folder)

    try {
      if (fs.existsSync(folderPath)) {
        const files = fs
          .readdirSync(folderPath)
          .filter((f) => IMAGE_RE.test(f))
          .sort()
          .map((f) => `${product.image_folder}${f}`)
        manifest[product.slug] = files
      } else {
        console.warn('[build-product-images] folder missing for', product.slug, '->', folderPath)
      }
    } catch (err) {
      console.warn('[build-product-images] failed reading', product.slug, String(err).slice(0, 160))
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n')

  const totalImages = Object.values(manifest).reduce((a, b) => a + b.length, 0)
  console.log(
    `[build-product-images] wrote ${path.relative(root, outPath)} — ${Object.keys(manifest).length} products, ${totalImages} images`,
  )
}

main()
