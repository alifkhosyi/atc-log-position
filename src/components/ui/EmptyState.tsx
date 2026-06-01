import React from "react"
import { I } from "../Icons.jsx"

interface EmptyStateProps {
  /** Icon name (Icons.jsx), default "info" */
  icon?: string
  title: React.ReactNode
  description?: React.ReactNode
  /** Optional CTA — usually a Button */
  action?: React.ReactNode
}

/**
 * EmptyState — standard empty/zero-data UI.
 * Centered icon + title + description + optional action.
 */
export function EmptyState({ icon = "info", title, description, action }: EmptyStateProps) {
  return (
    <div className="ui-empty">
      <div className="ui-empty-ic" aria-hidden="true">
        <I n={icon} s={32} />
      </div>
      <h3 className="ui-empty-title">{title}</h3>
      {description && <p className="ui-empty-desc">{description}</p>}
      {action && <div className="ui-empty-action">{action}</div>}
    </div>
  )
}
