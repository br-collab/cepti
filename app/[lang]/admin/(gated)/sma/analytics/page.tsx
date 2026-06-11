'use client'

import { useState, useEffect } from 'react'
import AnalyticsFilters from '@/components/admin/sma/analytics/AnalyticsFilters'
import SummaryCards from '@/components/admin/sma/analytics/SummaryCards'
import EngagementTrendChart from '@/components/admin/sma/analytics/EngagementTrendChart'
import PlatformBreakdownChart from '@/components/admin/sma/analytics/PlatformBreakdownChart'
import TopProductsChart from '@/components/admin/sma/analytics/TopProductsChart'
import PostingPatternsHeatmap from '@/components/admin/sma/analytics/PostingPatternsHeatmap'

interface AnalyticsData {
  summary: {
    total_posts: number
    avg_engagement: number
    wa_clicks: number
    wa_conversion_rate: number
  }
  platform_breakdown: Array<{ platform: string; count: number }>
  engagement_trend: Array<{
    date: string
    impressions: number
    reach: number
    engagement: number
    platformSplit: Record<string, number>
  }>
  top_products: Array<{
    product: string
    posts_count: number
    total_engagement: number
    total_impressions: number
    avg_engagement: number
  }>
  posting_patterns: Array<{
    hour: number
    post_count: number
    avg_engagement: number
  }>
  whatsapp_data: {
    total_clicks: number
    total_impressions: number
    conversion_rate: string
  }
}

function getDefaultDateRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)
  return { start, end }
}

export default function AnalyticsDashboard() {
  const [dateRange, setDateRange] = useState({ days: 30 })
  const [platform, setPlatform] = useState('all')
  const [product, setProduct] = useState('all')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true)
      setError(null)

      try {
        const end = new Date()
        const start = new Date()
        start.setDate(start.getDate() - (dateRange.days || 30))

        const params = new URLSearchParams({
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
          platform: platform,
          product: product,
        })

        const response = await fetch(`/api/sma/coordinator/analytics?${params}`)
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        const analyticsData = await response.json()
        setData(analyticsData)
      } catch (err) {
        console.error('Failed to fetch analytics:', err)
        setError(err instanceof Error ? err.message : 'Failed to load analytics')
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [dateRange, platform, product])


  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-zinc-200 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-zinc-200 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-zinc-200 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h3 className="text-red-900 font-semibold">Error Loading Analytics</h3>
        <p className="text-red-700 text-sm mt-2">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-zinc-200 p-6">
        <p className="text-zinc-600">No data available for the selected date range.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <AnalyticsFilters
        dateRange={dateRange}
        platform={platform}
        product={product}
        onDateRangeChange={setDateRange}
        onPlatformChange={setPlatform}
        onProductChange={setProduct}
        availableProducts={data.top_products.map((p) => p.product)}
      />

      {/* Summary Cards */}
      <SummaryCards data={data.summary} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagement Trend */}
        <div className="rounded-lg border border-zinc-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Engagement Trend</h3>
          <EngagementTrendChart data={data.engagement_trend} />
        </div>

        {/* Platform Breakdown */}
        <div className="rounded-lg border border-zinc-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Platform Breakdown</h3>
          <PlatformBreakdownChart data={data.platform_breakdown} />
        </div>
      </div>

      {/* Top Products */}
      <div className="rounded-lg border border-zinc-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Top Products by Engagement</h3>
        <TopProductsChart data={data.top_products} />
      </div>

      {/* Posting Patterns Heatmap */}
      <div className="rounded-lg border border-zinc-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Best Times to Post</h3>
        <PostingPatternsHeatmap data={data.posting_patterns} />
      </div>
    </div>
  )
}
