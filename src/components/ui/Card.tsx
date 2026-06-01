import React from "react"

interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Optional header title */
  title?: React.ReactNode
  /** Optional right-side header actions (buttons, badges) */
  actions?: React.ReactNode
}

/**
 * Card — generic container dengan optional header.
 * Reusable shell untuk Dashboard panels, settings sections, dll.
 */
export function Card({ title, actions, children, className, ...rest }: CardProps) {
  const cls = ["ui-card", className].filter(Boolean).join(" ")
  return (
    <div className={cls} {...rest}>
      {(title || actions) && (
        <div className="ui-card-h">
          {title && <div className="ui-card-title">{title}</div>}
          {actions && <div className="ui-card-actions">{actions}</div>}
        </div>
      )}
      <div className="ui-card-body">{children}</div>
    </div>
  )
}
