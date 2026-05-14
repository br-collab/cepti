export default function PhasePlaceholder({
  phase,
  title,
  description,
}: {
  phase: number
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
      <div className="text-xs uppercase tracking-wide text-zinc-500">Phase {phase}</div>
      <h2 className="mt-1 text-lg font-medium">{title}</h2>
      <p className="mt-2 text-sm text-zinc-500 max-w-md mx-auto">{description}</p>
    </div>
  )
}
