interface Props {
  error: string
  onDismiss?: () => void
  onAction?: { label: string; onClick: () => void }
}

export default function ErrorBanner({ error, onDismiss, onAction }: Props) {
  if (!error) return null
  return (
    <div className="mx-4 mt-3 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5 text-xs text-red-600 dark:text-red-300">
      <span className="shrink-0 mt-0.5">⚠</span>
      <span className="flex-1 leading-relaxed">
        {error}
        <span className="block text-[10px] opacity-70 mt-0.5">Try refreshing the page — this often clears things up.</span>
      </span>
      {onAction && (
        <button
          onClick={onAction.onClick}
          className="shrink-0 text-red-300 underline hover:text-red-200 whitespace-nowrap"
        >
          {onAction.label}
        </button>
      )}
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 text-red-400 hover:text-red-200 leading-none">
          ×
        </button>
      )}
    </div>
  )
}
