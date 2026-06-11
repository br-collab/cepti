'use client'

import { useState } from 'react'

interface TrendData {
  date: string
  impressions: number
  reach: number
  engagement: number
  platformSplit?: Record<string, number>
}

interface ChartProps {
  data: TrendData[]
}

export default function EngagementTrendChart({ data }: ChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-zinc-500">
        No trend data available
      </div>
    )
  }

  // Find max values for scaling
  const maxImpressions = Math.max(...data.map((d) => d.impressions), 1)
  const maxReach = Math.max(...data.map((d) => d.reach), 1)
  const maxEngagement = Math.max(...data.map((d) => d.engagement), 1)

  const chartHeight = 256
  const chartPadding = 40
  const contentHeight = chartHeight - chartPadding * 2

  // SVG dimensions
  const width = Math.max(600, data.length * 40)
  const pointSpacing = (width - chartPadding * 2) / Math.max(data.length - 1, 1)

  const getY = (value: number, max: number) => {
    return chartHeight - chartPadding - (value / max) * contentHeight
  }

  const points = [
    {
      name: 'Impressions',
      color: '#3b82f6',
      data: data.map((d, i) => ({
        x: chartPadding + i * pointSpacing,
        y: getY(d.impressions, maxImpressions),
        value: d.impressions,
      })),
    },
    {
      name: 'Reach',
      color: '#10b981',
      data: data.map((d, i) => ({
        x: chartPadding + i * pointSpacing,
        y: getY(d.reach, maxReach),
        value: d.reach,
      })),
    },
    {
      name: 'Engagement',
      color: '#ef4444',
      data: data.map((d, i) => ({
        x: chartPadding + i * pointSpacing,
        y: getY(d.engagement, maxEngagement),
        value: d.engagement,
      })),
    },
  ]

  // Generate path string for line
  const generatePath = (points: Array<{ x: number; y: number }>) => {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  }

  return (
    <div className="w-full">
      <div className="flex gap-4 mb-4 flex-wrap">
        {points.map((series) => (
          <div key={series.name} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: series.color }}
            />
            <span className="text-sm text-zinc-700">{series.name}</span>
          </div>
        ))}
      </div>

      <div className="relative overflow-x-auto">
        <svg width={width} height={chartHeight} className="mx-auto">
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={`grid-${ratio}`}
              x1={chartPadding}
              y1={chartHeight - chartPadding - ratio * contentHeight}
              x2={width - chartPadding}
              y2={chartHeight - chartPadding - ratio * contentHeight}
              stroke="#e5e7eb"
              strokeDasharray="4"
            />
          ))}

          {/* Lines */}
          {points.map((series) => (
            <path
              key={`path-${series.name}`}
              d={generatePath(series.data)}
              fill="none"
              stroke={series.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Points and hover area */}
          {data.map((_, i) => (
            <g key={`hover-${i}`} onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)}>
              {/* Invisible hover rect */}
              <rect
                x={chartPadding + i * pointSpacing - pointSpacing / 2}
                y={chartPadding}
                width={pointSpacing}
                height={contentHeight}
                fill="transparent"
                cursor="pointer"
              />

              {/* Hover line */}
              {hoveredIndex === i && (
                <>
                  <line
                    x1={chartPadding + i * pointSpacing}
                    y1={chartPadding}
                    x2={chartPadding + i * pointSpacing}
                    y2={chartHeight - chartPadding}
                    stroke="#d1d5db"
                    strokeDasharray="4"
                  />
                  {/* Points on hover */}
                  {points.map((series) => (
                    <circle
                      key={`point-${series.name}`}
                      cx={series.data[i].x}
                      cy={series.data[i].y}
                      r="4"
                      fill={series.color}
                    />
                  ))}
                </>
              )}
            </g>
          ))}

          {/* Axes */}
          <line
            x1={chartPadding}
            y1={chartHeight - chartPadding}
            x2={width - chartPadding}
            y2={chartHeight - chartPadding}
            stroke="#d1d5db"
          />
          <line
            x1={chartPadding}
            y1={chartPadding}
            x2={chartPadding}
            y2={chartHeight - chartPadding}
            stroke="#d1d5db"
          />
        </svg>
      </div>

      {/* Hover tooltip */}
      {hoveredIndex !== null && (
        <div className="mt-4 p-3 bg-zinc-100 rounded-lg text-sm">
          <p className="font-semibold text-zinc-900">{data[hoveredIndex].date}</p>
          <div className="grid grid-cols-3 gap-4 mt-2">
            <div>
              <p className="text-blue-600 font-medium">{data[hoveredIndex].impressions}</p>
              <p className="text-xs text-zinc-600">Impressions</p>
            </div>
            <div>
              <p className="text-green-600 font-medium">{data[hoveredIndex].reach}</p>
              <p className="text-xs text-zinc-600">Reach</p>
            </div>
            <div>
              <p className="text-red-600 font-medium">{data[hoveredIndex].engagement}</p>
              <p className="text-xs text-zinc-600">Engagement</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
