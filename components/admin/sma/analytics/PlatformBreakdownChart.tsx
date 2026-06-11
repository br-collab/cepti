'use client'

import { useState } from 'react'

interface PlatformData {
  platform: string
  count: number
}

interface ChartProps {
  data: PlatformData[]
}

const COLORS: Record<string, string> = {
  facebook: '#1877f2',
  instagram: '#e4405f',
  threads: '#000000',
}

const LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  threads: 'Threads',
}

export default function PlatformBreakdownChart({ data }: ChartProps) {
  const [hoveredPlatform, setHoveredPlatform] = useState<string | null>(null)

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-zinc-500">
        No platform data available
      </div>
    )
  }

  const total = data.reduce((sum, d) => sum + d.count, 0)

  // Sort by count descending
  const sortedData = [...data].sort((a, b) => b.count - a.count)

  // Calculate angles for pie chart
  let currentAngle = -90
  const slices = sortedData.map((d) => {
    const percentage = (d.count / total) * 100
    const sliceAngle = (percentage / 100) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + sliceAngle
    currentAngle = endAngle

    return {
      platform: d.platform,
      count: d.count,
      percentage,
      startAngle,
      endAngle,
    }
  })

  const centerX = 150
  const centerY = 150
  const radius = 120

  // Create SVG paths for pie slices
  const createArc = (startAngle: number, endAngle: number) => {
    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180

    const x1 = centerX + radius * Math.cos(startRad)
    const y1 = centerY + radius * Math.sin(startRad)
    const x2 = centerX + radius * Math.cos(endRad)
    const y2 = centerY + radius * Math.sin(endRad)

    const largeArc = endAngle - startAngle > 180 ? 1 : 0

    return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`
  }

  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row gap-8 items-center justify-center">
        {/* Pie Chart */}
        <svg width="300" height="300" viewBox="0 0 300 300" className="flex-shrink-0">
          {slices.map((slice) => (
            <g
              key={slice.platform}
              onMouseEnter={() => setHoveredPlatform(slice.platform)}
              onMouseLeave={() => setHoveredPlatform(null)}
              className={hoveredPlatform === slice.platform ? 'opacity-100' : 'opacity-75'}
              style={{ transition: 'opacity 200ms' }}
            >
              <path
                d={createArc(slice.startAngle, slice.endAngle)}
                fill={COLORS[slice.platform] || '#d1d5db'}
                stroke="white"
                strokeWidth="2"
                className="hover:opacity-100 cursor-pointer"
                style={{ transition: 'opacity 200ms' }}
              />

              {/* Percentage label (only show if > 8%) */}
              {slice.percentage > 8 && (
                <text
                  x={centerX + (radius * 0.65) * Math.cos(((slice.startAngle + slice.endAngle) / 2 * Math.PI) / 180)}
                  y={centerY + (radius * 0.65) * Math.sin(((slice.startAngle + slice.endAngle) / 2 * Math.PI) / 180)}
                  textAnchor="middle"
                  dy="0.3em"
                  className="text-sm font-bold fill-white pointer-events-none"
                >
                  {slice.percentage.toFixed(0)}%
                </text>
              )}
            </g>
          ))}
        </svg>

        {/* Legend */}
        <div className="space-y-2">
          {sortedData.map((d) => {
            const percentage = (d.count / total) * 100
            return (
              <div
                key={d.platform}
                onMouseEnter={() => setHoveredPlatform(d.platform)}
                onMouseLeave={() => setHoveredPlatform(null)}
                className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-zinc-100"
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: COLORS[d.platform] || '#d1d5db' }}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-900">
                    {LABELS[d.platform] || d.platform}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {d.count} posts ({percentage.toFixed(1)}%)
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
