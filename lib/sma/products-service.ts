/**
 * lib/sma/products-service.ts
 *
 * Service for fetching and matching CEPTI products to topics.
 * Used by agents to select relevant product images for posts.
 */

import fs from 'fs'
import path from 'path'

interface ProductDef {
  slug: string
  name: { es: string; en: string }
  image_folder: string
  [key: string]: unknown
}

let productsCatalog: ProductDef[] | null = null

function loadProductsCatalog(): ProductDef[] {
  if (productsCatalog) return productsCatalog

  const catalogPath = path.join(process.cwd(), 'data/products.json')
  const catalogJson = fs.readFileSync(catalogPath, 'utf-8')
  const catalog = JSON.parse(catalogJson)
  productsCatalog = catalog.products as ProductDef[]
  return productsCatalog
}

/**
 * Match products in a topic string to actual product catalog entries.
 * Returns matching products with their image metadata.
 */
export function matchProductsInTopic(topic: string): Array<{ slug: string; name: string; images: string[] }> {
  const products = loadProductsCatalog()
  const topicLower = topic.toLowerCase()
  const matches: Array<{ slug: string; name: string; images: string[] }> = []
  const seenSlugs = new Set<string>()

  for (const product of products) {
    const nameEs = product.name.es.toLowerCase()
    const nameEn = product.name.en.toLowerCase()

    // Exact slug match or partial name match
    if (topicLower.includes(product.slug) || topicLower.includes(nameEs) || topicLower.includes(nameEn)) {
      if (seenSlugs.has(product.slug)) continue
      seenSlugs.add(product.slug)

      // Load images for this product
      const imageFolder = product.image_folder
      const imageDirPath = path.join(process.cwd(), 'public', imageFolder)

      const images: string[] = []
      if (fs.existsSync(imageDirPath)) {
        const files = fs.readdirSync(imageDirPath)
        const imageFiles = files
          .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
          .sort()
          .slice(0, 5) // Use first 5 images max

        for (const file of imageFiles) {
          images.push(`${imageFolder}${file}`)
        }
      }

      if (images.length > 0) {
        matches.push({
          slug: product.slug,
          name: product.name.en,
          images,
        })
      }
    }
  }

  return matches
}

/**
 * Get all available images for a specific product slug.
 */
export function getProductImages(slug: string): string[] {
  const products = loadProductsCatalog()
  const product = products.find((p) => p.slug === slug)
  if (!product) return []

  const imageFolder = product.image_folder
  const imageDirPath = path.join(process.cwd(), 'public', imageFolder)

  if (!fs.existsSync(imageDirPath)) return []

  const files = fs.readdirSync(imageDirPath)
  return files
    .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .map((f) => `${imageFolder}${f}`)
}
