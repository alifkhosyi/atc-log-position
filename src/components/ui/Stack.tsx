import React from "react"

interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Direction (default vertical column). */
  direction?: "row" | "column"
  /** Gap unit (1=4px, 2=8px, 3=12px, 4=16px, 5=24px, 6=32px). Default 4 (16px). */
  gap?: 1 | 2 | 3 | 4 | 5 | 6
  /** Align-items: start | center | end | stretch (default stretch column / center row) */
  align?: "start" | "center" | "end" | "stretch"
  /** Justify-content: start | center | end | between | around */
  justify?: "start" | "center" | "end" | "between" | "around"
  wrap?: boolean
}

/**
 * Stack — flex layout primitive. Vertical (column) by default,
 * horizontal (row) via prop. Gap via spacing scale token.
 *
 *   <Stack gap={3}>...</Stack>            → column, 12px gap
 *   <Stack direction="row" gap={2}>...    → row, 8px gap
 */
export function Stack({
  direction = "column",
  gap = 4,
  align,
  justify,
  wrap = false,
  className,
  style,
  ...rest
}: StackProps) {
  const cls = ["ui-stack", `ui-stack-${direction}`, `ui-stack-gap-${gap}`, className]
    .filter(Boolean).join(" ")
  const justifyMap: Record<NonNullable<StackProps["justify"]>, string> = {
    start: "flex-start",
    center: "center",
    end: "flex-end",
    between: "space-between",
    around: "space-around",
  }
  const alignMap: Record<NonNullable<StackProps["align"]>, string> = {
    start: "flex-start",
    center: "center",
    end: "flex-end",
    stretch: "stretch",
  }
  const mergedStyle: React.CSSProperties = {
    ...(align ? { alignItems: alignMap[align] } : {}),
    ...(justify ? { justifyContent: justifyMap[justify] } : {}),
    ...(wrap ? { flexWrap: "wrap" } : {}),
    ...style,
  }
  return <div className={cls} style={mergedStyle} {...rest} />
}
