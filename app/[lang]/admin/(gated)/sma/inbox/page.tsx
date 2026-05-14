import PhasePlaceholder from '@/components/admin/PhasePlaceholder'

export default function SmaInboxPage() {
  return (
    <PhasePlaceholder
      phase={4}
      title="Inbox"
      description="Public comments arrive here classified as inquiry, compliment, complaint, or spam. AI drafts replies to inquiries and compliments; humans approve every reply before it posts."
    />
  )
}
