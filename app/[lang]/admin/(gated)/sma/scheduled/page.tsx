import PhasePlaceholder from '@/components/admin/PhasePlaceholder'

export default function SmaScheduledPage() {
  return (
    <PhasePlaceholder
      phase={3}
      title="Scheduled & Published"
      description="Approved drafts move through Scheduled → Publishing → Published with retry, rollback, and platform-specific error surfacing."
    />
  )
}
