import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import productsData from '@/data/products.json'
import type { Locale } from '@/app/[lang]/dictionaries'

export type Bilingual = { es: string; en: string }
export type BilingualArray = { es: string[]; en: string[] }

export type Product = {
  slug: string
  order: number
  show_on_homepage?: boolean
  name: Bilingual
  tagline: Bilingual
  description: Bilingual
  properties: BilingualArray
  use_cases: BilingualArray
  catalog_codes: string[]
  image_folder: string
  video_folder?: string
  coverage_m2_per_unit: number
  unit_label: Bilingual
  whatsapp_template: Bilingual
}

export type Brand = {
  tagline: Bilingual
  positioning: Bilingual
  whatsapp_number: string
  workshop_offer: Bilingual
}

export type ProjectEntry = {
  name: string
  location: string
  products: string[]
}

export const brand: Brand = productsData.brand as Brand
export const projects: ProjectEntry[] = productsData.projects as ProjectEntry[]

const allProducts: Product[] = [...(productsData.products as Product[])].sort(
  (a, b) => a.order - b.order
)

export function getAllProducts(): Product[] {
  return allProducts
}

export function getHomepageProducts(): Product[] {
  return allProducts.filter((p) => p.show_on_homepage !== false)
}

export function getProduct(slug: string): Product | undefined {
  return allProducts.find((p) => p.slug === slug)
}

export function pickLang<T>(value: { es: T; en: T }, lang: Locale): T {
  return value[lang]
}

function publicPath(relative: string): string {
  return path.join(process.cwd(), 'public', relative.replace(/^\//, ''))
}

export function fileExistsInPublic(relativePath: string): boolean {
  try {
    return fs.existsSync(publicPath(relativePath))
  } catch {
    return false
  }
}

export type ProductImages = {
  hero: string | null
  card: string | null
  textures: { code: string; src: string }[]
  projectImages: string[]
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp'] as const

function findFileWithExt(basePath: string): string | null {
  for (const ext of IMAGE_EXTS) {
    const candidate = `${basePath}.${ext}`
    if (fileExistsInPublic(candidate)) return candidate
  }
  return null
}

export function getProductImages(product: Product): ProductImages {
  const folder = product.image_folder.replace(/\/$/, '')
  const hero = findFileWithExt(`${folder}/hero`)
  const card = findFileWithExt(`${folder}/card`) ?? hero

  // catalog_codes is the *display order* (sorted lightest->darkest by color family);
  // each entry locates the source file. The code shown to customers is the swatch's
  // position in that order, so the palette always reads 01, 02, 03... with no gaps.
  const textures = product.catalog_codes
    .map((code) => {
      const src = findFileWithExt(`${folder}/texture-${code}`)
      return src ? { src } : null
    })
    .filter((t): t is { src: string } => t !== null)
    .map((t, i) => ({ code: String(i + 1).padStart(2, '0'), src: t.src }))

  let projectImages: string[] = []
  try {
    const absDir = publicPath(folder)
    if (fs.existsSync(absDir)) {
      projectImages = fs
        .readdirSync(absDir)
        .filter((name) => /^project-.*\.(jpe?g|png|webp)$/i.test(name))
        .sort()
        .map((name) => `${folder}/${name}`)
    }
  } catch {
    projectImages = []
  }

  return { hero, card, textures, projectImages }
}

export function getProductVideos(product: Product): string[] {
  const dir = (product.video_folder ?? `/videos/products/${product.slug}`).replace(/\/+$/, '')
  try {
    const absDir = publicPath(dir)
    if (!fs.existsSync(absDir)) return []
    return fs
      .readdirSync(absDir)
      // Homepage showcase clips live beside the product videos, but are a
      // separate editorial surface. Only the canonical numbered files belong
      // in the product-page video gallery.
      .filter((name) => /^video-\d+\.(mp4|webm)$/i.test(name))
      .sort()
      .map((name) => `${dir}/${name}`)
  } catch {
    return []
  }
}

export function buildWhatsAppHref(params: {
  template: string
  code: string | null
  m2: string
  whatsappNumber: string
}): string {
  const text = params.template
    .replace('{code}', params.code ?? 'N/A')
    .replace('{m2}', params.m2 ?? '')
  const number = params.whatsappNumber.replace(/[^\d]/g, '')
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

/**
 * Landing-page showcase rail.
 *
 * One vertical (9:16) clip per flagship finish, shot 2026-08-23. Paths are
 * declared explicitly rather than discovered with `fs` because
 * `next.config.ts` excludes `public/**` from the serverless bundle — a
 * runtime `readdirSync` here would return nothing on Vercel and silently
 * drop the whole section.
 *
 * Assets: public/videos/products/<slug>/showcase.mp4
 *         public/images/products/<slug>/showcase-poster.jpg
 */
export const SHOWCASE_RAIL_SLUGS = [
  'pintura-de-piedra',
  'pintura-efecto-granito',
  'pintura-aterciopelada',
  'ladriflex',
  'papelex',
] as const

export type ShowcaseVideo = {
  slug: string
  name: string
  src: string
  poster: string
}

export function getShowcaseVideos(lang: Locale): ShowcaseVideo[] {
  return SHOWCASE_RAIL_SLUGS.map((slug): ShowcaseVideo | null => {
    const product = getProduct(slug)
    if (!product) return null
    return {
      slug,
      name: pickLang(product.name, lang),
      src: `/videos/products/${slug}/showcase.mp4`,
      poster: `/images/products/${slug}/showcase-poster.jpg`,
    }
  }).filter((v): v is ShowcaseVideo => v !== null)
}
