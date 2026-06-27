import PhasePlaceholder from '@/components/admin/PhasePlaceholder'
import ExamplesManager from '@/components/admin/sma/ExamplesManager'

export default function SmaSettingsPage() {
  return (
    <div className="space-y-8">
      <ExamplesManager />
      <PhasePlaceholder
        phase={2}
        title="Settings"
        description="Cadence per platform, default voice settings, and reconnect controls will live here once Phase 2 lands."
      />
    </div>
  )
}
