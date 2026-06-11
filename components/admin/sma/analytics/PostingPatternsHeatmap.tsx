'use client'

import { useState } from 'react'

interface PatternData {
  hour: number
  post_count: number
  avg_engagement: number
}

interface ChartProps {
  data: PatternData[]
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function PostingPatternsHeatmap({ data }: ChartProps) {
  const [hoveredCell, setHoveredCell] = useState<{ hour: number; day: number } | null>(null)

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-zinc-500">
        No pattern data available
      </div>
    )
  }

  // Find max for color scaling
  const maxEngagement = Math.max(...data.map((d) => d.avg_engagement), 1)

  // Get color based on engagement (white to red gradient)
  const getColor = (value: number): string => {
    if (value === 0) return '#f3f4f6' // light gray for no data
    const ratio = value / maxEngagement
    // Gradient from light to dark red
    if (ratio < 0.25) return '#fecaca'
    if (ratio < 0.5) return '#fca5a5'
    if (ratio < 0.75) return '#f87171'
    return '#ef4444'
  }

  const cellSize = 40
  const labelWidth = 60

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Header - Hours */}
        <div className="flex">
          <div style={{ width: labelWidth }} />
          {Array.from({ length: 24 }, (_, i) => (
            <div key={`hour-${i}`} style={{ width: cellSize }} className="flex items-center justify-center">
              <span className="text-xs font-medium text-zinc-600">{i.toString().padStart(2, '0')}</span>
            </div>
          ))}
        </div>

        {/* Heatmap Grid */}
        {DAYS.map((day, dayIndex) => (
          <div key={`day-${dayIndex}`} className="flex">
            {/* Day Label */}
            <div
              style={{ width: labelWidth }}
              className="flex items-center justify-center border-r border-zinc-200 bg-zinc-50"
            >
              <span className="text-xs font-medium text-zinc-700">{day}</span>
            </div>

            {/* Cells */}
            {Array.from({ length: 24 }, (_, hourIndex) => {
              // Note: This is a simplified heatmap that shows data for all days
              // In a real scenario, you'd need actual day-of-week data from logs
              // For now, we'll show the same hour data repeated
              const cellData = data[hourIndex]
              const isHovered =
                hoveredCell?.hour === hourIndex && hoveredCell?.day === dayIndex

              return (
                <div
                  key={`cell-${dayIndex}-${hourIndex}`}
                  onMouseEnter={() => setHoveredCell({ hour: hourIndex, day: dayIndex })}
                  onMouseLeave={() => setHoveredCell(null)}
                  style={{
                    width: cellSize,
                    backgroundColor: cellData ? getColor(cellData.avg_engagement) : '#f3f4f6',
                    border: isHovered ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                  }}
                  className="relative flex items-center justify-center cursor-pointer hover:shadow-md transition-shadow"
                >
                  {cellData && cellData.post_count > 0 && (
                    <span className="text-xs font-semibold text-white drop-shadow">
                      {cellData.avg_engagement}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {/* Footer - Legend */}
        <div className="mt-6 flex items-center gap-4 justify-center">
          <span className="text-sm text-zinc-700">Low</span>
          <div className="flex gap-1">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <div
                key={`legend-${ratio}`}
                style={{
                  width: 20,
                  height: 20,
                  backgroundColor:
                    ratio === 0 ? '#f3f4f6' : getColor(ratio * maxEngagement),
                  border: '1px solid #d1d5db',
                }}
              />
            ))}
          </div>
          <span className="text-sm text-zinc-700">High</span>
        </div>
      </div>

      {/* Hover Tooltip */}
      {hoveredCell && data[hoveredCell.hour] && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <p className="font-semibold text-zinc-900">
            {DAYS[hoveredCell.day]} at {hoveredCell.hour.toString().padStart(2, '0')}:00
          </p>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <p className="text-blue-600 font-medium">{data[hoveredCell.hour].post_count}</p>
              <p className="text-xs text-zinc-600">posts</p>
            </div>
            <div>
              <p className="text-blue-600 font-medium">{data[hoveredCell.hour].avg_engagement}</p>
              <p className="text-xs text-zinc-600">avg engagement</p>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
        <p className="font-semibold mb-1">Best Times to Post</p>
        <p>
          Darker cells indicate higher average engagement. Schedule posts during peak hours for maximum impact.
        </p>
      </div>
    </div>
  )
}
