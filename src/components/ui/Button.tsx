import React from "react"
import { I } from "../Icons.jsx"

type Variant = "primary" | "ghost" | "danger" | "subtle"
type Size = "sm" | "md" | "lg"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Icon name from Icons.jsx (e.g. "edit", "alert"). Left-side icon. */
  icon?: string
  /** Show spinner + disable. Useful untuk async submit. */
  loading?: boolean
}

/**
 * Button — design system primitive.
 *
 * Variants: primary (accent), ghost (outline), danger (alert red), subtle (elevated).
 * Sizes: sm (32px), md (44px — WCAG default), lg (52px).
 *
 * Touch target ≥ 44px for md+ per WCAG 2.5.5.
 */
export function Button({
  variant = "ghost",
  size = "md",
  icon,
  loading = false,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  const cls = ["ui-btn", `ui-btn-${variant}`, `ui-btn-${size}`, className]
    .filter(Boolean).join(" ")
  const iconSize = size === "sm" ? 12 : size === "lg" ? 18 : 14
  return (
    <button
      type="button"
      className={cls}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="ui-btn-spinner" aria-label="Memuat" />
      ) : icon ? (
        <I n={icon} s={iconSize} />
      ) : null}
      {children}
    </button>
  )
}
