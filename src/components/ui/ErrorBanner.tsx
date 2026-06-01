import React from "react"
import { I } from "../Icons.jsx"

type Tone = "error" | "warn" | "info"

interface ErrorBannerProps {
  tone?: Tone
  title?: React.ReactNode
  children: React.ReactNode
  /** Optional retry / dismiss action */
  action?: React.ReactNode
}

/**
 * ErrorBanner — non-disruptive inline error / warning / info banner.
 * Untuk display di-page (bukan toast). Tone-based icon + color.
 */
export function ErrorBanner({ tone = "error", title, children, action }: ErrorBannerProps) {
  const iconMap: Record<Tone, string> = {
    error: "alert",
    warn: "alert",
    info: "info",
  }
  return (
    <div className={`ui-banner ui-banner-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <div className="ui-banner-ic" aria-hidden="true">
        <I n={iconMap[tone]} s={16} />
      </div>
      <div className="ui-banner-body">
        {title && <div className="ui-banner-title">{title}</div>}
        <div className="ui-banner-msg">{children}</div>
      </div>
      {action && <div className="ui-banner-action">{action}</div>}
    </div>
  )
}
