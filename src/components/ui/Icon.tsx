import React from "react"
import { I } from "../Icons.jsx"

interface IconProps {
  name: string
  size?: number
  /** Accessible label. Kalau ada → role="img", kalau tidak → role="presentation". */
  label?: string
  className?: string
}

/**
 * Icon — semantic wrapper around legacy Icons.jsx `<I />` component.
 * Adds aria-label semantics + role attribute.
 *
 * Use case:
 *   <Icon name="edit" />                    → decorative (presentation)
 *   <Icon name="delete" label="Hapus" />    → meaningful (img + aria-label)
 */
export function Icon({ name, size = 16, label, className }: IconProps) {
  return (
    <span
      className={className}
      role={label ? "img" : "presentation"}
      aria-label={label}
    >
      <I n={name} s={size} />
    </span>
  )
}
