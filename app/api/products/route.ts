import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const catalogPath = path.join(process.cwd(), 'data/products.json')
    const data = fs.readFileSync(catalogPath, 'utf-8')
    const parsed = JSON.parse(data)

    // Return only product list with slug and name
    const products = (parsed.products || []).map((p: any) => ({
      slug: p.slug,
      name: p.name,
    }))

    return Response.json({ products })
  } catch (error) {
    console.error('Failed to load products:', error)
    return Response.json({ products: [], error: 'Failed to load products' }, { status: 500 })
  }
}
