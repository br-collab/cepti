import fs from 'fs'
import path from 'path'

interface ProductEntry {
  slug: string
  name: { es: string; en: string }
  image_folder: string
}

interface ProductsCatalog {
  products: ProductEntry[]
}

let catalogCache: ProductEntry[] = []
let cacheLoaded = false

export async function loadProductsCatalog(): Promise<ProductEntry[]> {
  if (cacheLoaded && Array.isArray(catalogCache)) {
    return catalogCache
  }

  try {
    const catalogPath = path.join(process.cwd(), 'data/products.json')
    if (!fs.existsSync(catalogPath)) {
      console.warn('Products catalog not found at', catalogPath)
      catalogCache = []
      cacheLoaded = true
      return []
    }

    const data = fs.readFileSync(catalogPath, 'utf-8')
    const parsed = JSON.parse(data) as ProductsCatalog

    if (!Array.isArray(parsed.products)) {
      console.error('Products catalog invalid: products is not an array', typeof parsed.products)
      catalogCache = []
      cacheLoaded = true
      return []
    }

    catalogCache = parsed.products
    cacheLoaded = true
    return catalogCache
  } catch (error) {
    console.error('Failed to load products catalog:', error)
    catalogCache = []
    cacheLoaded = true
    return []
  }
}

export async function matchProductsInTopic(topic: string): Promise<string[]> {
  const catalog = await loadProductsCatalog()

  if (!Array.isArray(catalog)) {
    console.error('Catalog is not iterable:', typeof catalog)
    return []
  }

  const topicLower = topic.toLowerCase()
  const matchedImages: string[] = []
  const seen = new Set<string>()

  for (const product of catalog) {
    const nameEn = (product.name.en || '').toLowerCase()
    const nameEs = (product.name.es || '').toLowerCase()
    const slugMatch = product.slug.toLowerCase()

    const isMatch = topicLower.includes(nameEn) || topicLower.includes(nameEs) || topicLower.includes(slugMatch) || nameEn.includes(topicLower) || nameEs.includes(topicLower)

    if (isMatch && product.image_folder) {
      try {
        const folderPath = path.join(process.cwd(), 'public', product.image_folder)
        if (fs.existsSync(folderPath)) {
          const files = fs.readdirSync(folderPath).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))

          for (const file of files) {
            const imagePath = `${product.image_folder}${file}`
            if (!seen.has(imagePath)) {
              matchedImages.push(imagePath)
              seen.add(imagePath)
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to read images for ${product.slug}:`, error)
      }
    }
  }

  return matchedImages
}

export async function getProductImages(slug: string): Promise<string[]> {
  const catalog = await loadProductsCatalog()
  const product = catalog.find((p) => p.slug.toLowerCase() === slug.toLowerCase())

  if (!product?.image_folder) return []

  try {
    const folderPath = path.join(process.cwd(), 'public', product.image_folder)
    if (fs.existsSync(folderPath)) {
      const files = fs.readdirSync(folderPath).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
      return files.map((f) => `${product.image_folder}${f}`)
    }
  } catch (error) {
    console.warn(`Failed to read images for ${slug}:`, error)
  }

  return []
}
