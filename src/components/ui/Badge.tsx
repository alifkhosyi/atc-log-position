import React from "react"

type Tone = "neutral" | "success" | "warn" | "danger" | "info" | "accent"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

/**
 * Badge — inline pill untuk status / count / tag.
 * Tones map ke design tokens: neutral/success/warn/danger/info/accent.
 */
export function Badge({ tone = "neutral", children, className, ...rest }: BadgeProps) {
  const cls = ["ui-badge", `ui-badge-${tone}`, className].filter(Boolean).join(" ")
  return <span className={cls} {...rest}>{children}</span>
}
