/**
 * src/components/ui/index.ts
 *
 * Design system primitives — single import point for all consumers.
 *
 *   import { Button, Badge, Card, EmptyState, Loading, ErrorBanner, Icon, Stack } from "@/components/ui"
 *
 * Phase 8 deliverable. Phases 9-10 akan codemod CSS literal + emoji → these.
 * Phase 12 god component decomposition akan adopt selama refactor.
 */

import "./ui.css"

export { Button } from "./Button"
export { Badge } from "./Badge"
export { Card } from "./Card"
export { EmptyState } from "./EmptyState"
export { Loading } from "./Loading"
export { ErrorBanner } from "./ErrorBanner"
export { Icon } from "./Icon"
export { Stack } from "./Stack"
