'use client'

import { TrendingUp, MessageCircle } from 'lucide-react'

interface SummaryData {
  total_posts: number
  avg_engagement: number
  wa_clicks: number
  wa_conversion_rate: number
}

export default function SummaryCards({ data }: { data: SummaryData }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Posts */}
      <div className="rounded-lg border border-zinc-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-zinc-600">Total Posts</p>
            <p className="text-3xl font-bold mt-1">{data.total_posts}</p>
          </div>
          <div className="text-blue-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Avg Engagement */}
      <div className="rounded-lg border border-zinc-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-zinc-600">Avg Engagement</p>
            <p className="text-3xl font-bold mt-1">{data.avg_engagement}</p>
            <p className="text-xs text-zinc-500 mt-2">per post</p>
          </div>
          <div className="text-green-600">
            <TrendingUp className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* WhatsApp Inquiries */}
      <div className="rounded-lg border border-zinc-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-zinc-600">WhatsApp Clicks</p>
            <p className="text-3xl font-bold mt-1">{data.wa_clicks}</p>
            <p className="text-xs text-zinc-500 mt-2">{data.wa_conversion_rate.toFixed(2)}% conversion</p>
          </div>
          <div className="text-purple-600">
            <MessageCircle className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Overall Trend Indicator */}
      <div className="rounded-lg border border-zinc-200 p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div>
          <p className="text-sm text-zinc-600">Performance Score</p>
          <p className="text-3xl font-bold mt-1">
            {Math.round((data.avg_engagement * data.wa_conversion_rate) / 10)}%
          </p>
          <p className="text-xs text-zinc-500 mt-2">engagement × conversion</p>
        </div>
      </div>
    </div>
  )
}
