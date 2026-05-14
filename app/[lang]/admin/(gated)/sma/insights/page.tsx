import PhasePlaceholder from '@/components/admin/PhasePlaceholder'

export default function SmaInsightsPage() {
  return (
    <PhasePlaceholder
      phase={5}
      title="Insights"
      description="Daily metrics snapshots per platform plus WhatsApp quote attribution from the ref-token we ship in Phase 1."
    />
  )
}
