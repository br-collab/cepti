import fs from 'fs'
import path from 'path'

interface ProductCatalogEntry {
  slug: string
  name: string
  images: string[]
}

let catalogCache: ProductCatalogEntry[] = []
let cacheLoaded = false

export async function loadProductsCatalog(): Promise<ProductCatalogEntry[]> {
  if (cacheLoaded) return catalogCache

  try {
    const catalogPath = path.join(process.cwd(), 'data/products.json')
    const data = fs.readFileSync(catalogPath, 'utf-8')
    catalogCache = JSON.parse(data)
    cacheLoaded = true
    return catalogCache
  } catch (error) {
    console.error('Failed to load products catalog:', error)
    return []
  }
}

export async function matchProductsInTopic(topic: string): Promise<string[]> {
  const catalog = await loadProductsCatalog()

  const topicLower = topic.toLowerCase()
  const matchedProducts: string[] = []
  const seen = new Set<string>()

  for (const product of catalog) {
    const nameMatch = product.name.toLowerCase().includes(topicLower)
    const slugMatch = product.slug.toLowerCase().includes(topicLower)
    const topicMatch = topicLower.includes(product.slug.toLowerCase()) || topicLower.includes(product.name.toLowerCase())

    if (nameMatch || slugMatch || topicMatch) {
      for (const image of product.images) {
        if (!seen.has(image)) {
          matchedProducts.push(image)
          seen.add(image)
        }
      }
    }
  }

  return matchedProducts
}

export async function getProductImages(slug: string): Promise<string[]> {
  const catalog = await loadProductsCatalog()
  const product = catalog.find((p) => p.slug.toLowerCase() === slug.toLowerCase())
  return product?.images || []
}
