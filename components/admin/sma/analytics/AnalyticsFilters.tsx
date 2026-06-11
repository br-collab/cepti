'use client'

import { useState } from 'react'

interface FilterProps {
  dateRange: { days: number }
  platform: string
  product: string
  onDateRangeChange: (range: { days: number }) => void
  onPlatformChange: (platform: string) => void
  onProductChange: (product: string) => void
  availableProducts: string[]
}

export default function AnalyticsFilters({
  dateRange,
  platform,
  product,
  onDateRangeChange,
  onPlatformChange,
  onProductChange,
  availableProducts,
}: FilterProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <div className="rounded-lg border border-zinc-200 p-6 bg-zinc-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-zinc-900">Filters</h3>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          {showAdvanced ? 'Hide' : 'Show'} Advanced
        </button>
      </div>

      {/* Quick Date Range Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Last 7 days', days: 7 },
          { label: 'Last 30 days', days: 30 },
          { label: 'Last 90 days', days: 90 },
          { label: 'All time', days: 365 },
        ].map((option) => (
          <button
            key={option.days}
            onClick={() => onDateRangeChange({ days: option.days })}
            className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              dateRange.days === option.days
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="mt-4 space-y-4 pt-4 border-t border-zinc-200">
          {/* Platform Filter */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Platform</label>
            <select
              value={platform}
              onChange={(e) => onPlatformChange(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Platforms</option>
              <option value="facebook">Facebook only</option>
              <option value="instagram">Instagram only</option>
              <option value="threads">Threads only</option>
            </select>
          </div>

          {/* Product Filter */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Product</label>
            <select
              value={product}
              onChange={(e) => onProductChange(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Products</option>
              {availableProducts.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
