'use client'

import { useState } from 'react'

interface ProductData {
  product: string
  posts_count: number
  total_engagement: number
  total_impressions: number
  avg_engagement: number
}

interface ChartProps {
  data: ProductData[]
}

export default function TopProductsChart({ data }: ChartProps) {
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null)

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-zinc-500">
        No product data available
      </div>
    )
  }

  const maxEngagement = Math.max(...data.map((d) => d.avg_engagement), 1)
  const barHeight = 40
  const labelWidth = 120
  const chartPadding = 20

  return (
    <div className="w-full">
      <div className="space-y-4">
        {data.map((product, index) => {
          const barWidth = (product.avg_engagement / maxEngagement) * 300
          const percentage = (product.avg_engagement / maxEngagement) * 100

          return (
            <div
              key={product.product}
              onMouseEnter={() => setHoveredProduct(product.product)}
              onMouseLeave={() => setHoveredProduct(null)}
              className="flex items-center gap-4"
            >
              {/* Label */}
              <div style={{ width: labelWidth }} className="truncate">
                <p className="text-sm font-medium text-zinc-900 truncate">
                  {product.product}
                </p>
              </div>

              {/* Bar */}
              <div className="flex-1 flex items-center gap-2">
                <div
                  className={`h-8 rounded transition-all ${
                    hoveredProduct === product.product ? 'bg-blue-600' : 'bg-blue-400'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {/* Value */}
              <div className="text-right w-24">
                <p className="text-sm font-semibold text-zinc-900">
                  {product.avg_engagement}
                </p>
                <p className="text-xs text-zinc-600">
                  avg engagement
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Detailed Stats Table */}
      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200">
            <tr>
              <th className="text-left py-3 px-3 font-semibold text-zinc-900">Product</th>
              <th className="text-right py-3 px-3 font-semibold text-zinc-900">Posts</th>
              <th className="text-right py-3 px-3 font-semibold text-zinc-900">Avg Engagement</th>
              <th className="text-right py-3 px-3 font-semibold text-zinc-900">Total Engagement</th>
              <th className="text-right py-3 px-3 font-semibold text-zinc-900">Total Impressions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((product) => (
              <tr
                key={product.product}
                className={`border-b border-zinc-100 ${
                  hoveredProduct === product.product ? 'bg-blue-50' : ''
                }`}
              >
                <td className="py-3 px-3 font-medium text-zinc-900">{product.product}</td>
                <td className="text-right py-3 px-3 text-zinc-600">{product.posts_count}</td>
                <td className="text-right py-3 px-3 font-semibold text-blue-600">
                  {product.avg_engagement}
                </td>
                <td className="text-right py-3 px-3 text-zinc-600">{product.total_engagement}</td>
                <td className="text-right py-3 px-3 text-zinc-600">{product.total_impressions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
