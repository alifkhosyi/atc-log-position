import React from "react"

interface LoadingProps {
  /** Optional text below spinner */
  text?: React.ReactNode
  /** Size: sm (16), md (24, default), lg (40) */
  size?: "sm" | "md" | "lg"
  /** Inline (just the spinner, no centered block) */
  inline?: boolean
}

/**
 * Loading — spinner + optional caption.
 * Inline mode untuk button spinner, block mode untuk full-page / suspense fallback.
 */
export function Loading({ text, size = "md", inline = false }: LoadingProps) {
  const cls = inline
    ? `ui-spinner ui-spinner-${size}`
    : "ui-loading"
  if (inline) {
    return <span className={cls} aria-label={typeof text === "string" ? text : "Memuat"} />
  }
  return (
    <div className={cls} role="status" aria-live="polite">
      <span className={`ui-spinner ui-spinner-${size}`} />
      {text && <p className="ui-loading-text">{text}</p>}
    </div>
  )
}
