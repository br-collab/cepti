import { NextResponse } from 'next/server'
import { requireSmaAdmin } from '@/lib/sma/auth'
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server'
import { SMACoordinator } from '@/lib/sma/coordinator/coordinator'
import { ConsoleAuditLogger } from '@/lib/sma/coordinator/audit'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const user = await requireSmaAdmin()
  if (!user) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const url = new URL(request.url)
    const startParam = url.searchParams.get('start') || ''
    const endParam = url.searchParams.get('end') || ''
    const platform = url.searchParams.get('platform') || 'all'
    const product = url.searchParams.get('product') || 'all'

    // Parse date range
    if (!startParam || !endParam) {
      return NextResponse.json(
        { error: 'Missing required query parameters: start, end (ISO format)' },
        { status: 400 },
      )
    }

    const startDate = new Date(startParam)
    const endDate = new Date(endParam)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO 8601 (YYYY-MM-DD or ISO string)' },
        { status: 400 },
      )
    }

    // Ensure start <= end
    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 },
      )
    }

    const supabase = await getSupabaseServiceRoleClient()
    const auditLogger = new ConsoleAuditLogger()
    const coordinator = new SMACoordinator(supabase, auditLogger)

    // Fetch all analytics data in parallel
    const [
      { posts: allPosts, count: totalPosts },
      engagementTrend,
      topProducts,
      postingPatterns,
      platformBreakdown,
      whatsappData,
    ] = await Promise.all([
      coordinator.getAnalyticsData(startDate, endDate),
      coordinator.getEngagementTrend(startDate, endDate),
      coordinator.getTopProducts(startDate, endDate, 5),
      coordinator.getPostingPatterns(startDate, endDate),
      coordinator.getPlatformBreakdown(startDate, endDate),
      coordinator.getWhatsappInquiries(startDate, endDate),
    ])

    // Apply platform filter if specified
    let posts = allPosts
    if (platform !== 'all') {
      posts = allPosts.filter((p) => p.platforms?.includes(platform as any))
    }

    // Apply product filter if specified (basic topic matching)
    if (product !== 'all') {
      posts = posts.filter((p) => p.draft && Object.values(p.draft).some((d: any) =>
        d?.body?.toLowerCase().includes(product.toLowerCase())
      ))
    }

    // Calculate summary metrics
    const avgEngagement = posts.length > 0
      ? Math.round(
        posts.reduce((sum, p) => {
          const engagements = Object.values(p.metrics || {}).map((m: any) => m.engagement || 0)
          return sum + (engagements.length > 0 ? engagements.reduce((a: number, b: number) => a + b, 0) / engagements.length : 0)
        }, 0) / posts.length,
      )
      : 0

    // Calculate WA clicks and conversion
    const waClicks = whatsappData.total_clicks
    const waConversion = whatsappData.conversion_rate

    return NextResponse.json({
      summary: {
        total_posts: posts.length,
        avg_engagement: avgEngagement,
        wa_clicks: waClicks,
        wa_conversion_rate: parseFloat(waConversion),
      },
      platform_breakdown: platformBreakdown,
      engagement_trend: engagementTrend,
      top_products: topProducts,
      posting_patterns: postingPatterns,
      whatsapp_data: whatsappData,
      filters: {
        start_date: startParam,
        end_date: endParam,
        platform: platform,
        product: product,
      },
    })
  } catch (error) {
    console.error('GET /api/sma/coordinator/analytics error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
