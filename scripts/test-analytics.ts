#!/usr/bin/env node
/**
 * Test script for Phase 2.5 Analytics Dashboard
 * Verifies coordinator methods and API endpoint
 */

import { createClient } from '@supabase/supabase-js'
import { SMACoordinator } from '@/lib/sma/coordinator/coordinator'
import { ConsoleAuditLogger } from '@/lib/sma/coordinator/audit'

async function testAnalytics() {
  console.log('Testing Phase 2.5 Analytics Dashboard...\n')

  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const coordinator = new SMACoordinator(supabase, new ConsoleAuditLogger())

  try {
    // Test 1: Get analytics data
    console.log('Test 1: getAnalyticsData()')
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

    const analyticsData = await coordinator.getAnalyticsData(startDate, endDate)
    console.log(`✓ Retrieved ${analyticsData.count} posts in date range`)

    // Test 2: Get engagement trend
    console.log('\nTest 2: getEngagementTrend()')
    const trend = await coordinator.getEngagementTrend(startDate, endDate)
    console.log(`✓ Retrieved ${trend.length} days of trend data`)

    // Test 3: Get top products
    console.log('\nTest 3: getTopProducts()')
    const topProducts = await coordinator.getTopProducts(startDate, endDate, 5)
    console.log(`✓ Retrieved ${topProducts.length} top products`)
    topProducts.forEach((p) => {
      console.log(`  - ${p.product}: ${p.avg_engagement} avg engagement (${p.posts_count} posts)`)
    })

    // Test 4: Get posting patterns
    console.log('\nTest 4: getPostingPatterns()')
    const patterns = await coordinator.getPostingPatterns(startDate, endDate)
    console.log(`✓ Retrieved pattern data for ${patterns.length} hours`)
    const bestHour = patterns.reduce((max, p) => (p.avg_engagement > max.avg_engagement ? p : max))
    console.log(`  - Best time to post: ${bestHour.hour.toString().padStart(2, '0')}:00 (${bestHour.avg_engagement} avg engagement)`)

    // Test 5: Get platform breakdown
    console.log('\nTest 5: getPlatformBreakdown()')
    const platformBreakdown = await coordinator.getPlatformBreakdown(startDate, endDate)
    console.log('✓ Retrieved platform breakdown:')
    platformBreakdown.forEach((p) => {
      console.log(`  - ${p.platform}: ${p.count} posts`)
    })

    // Test 6: Get WhatsApp inquiries
    console.log('\nTest 6: getWhatsappInquiries()')
    const waData = await coordinator.getWhatsappInquiries(startDate, endDate)
    console.log('✓ Retrieved WhatsApp data:')
    console.log(`  - Total clicks: ${waData.total_clicks}`)
    console.log(`  - Total impressions: ${waData.total_impressions}`)
    console.log(`  - Conversion rate: ${waData.conversion_rate}%`)

    console.log('\n✅ All analytics tests passed!')
  } catch (error) {
    console.error('❌ Analytics test failed:')
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

testAnalytics()
