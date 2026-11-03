import { isValidTagColor } from "@/utils/masterData"

export default function ConditionBadge({
  condition,

  color,
}: {
  condition: string

  color?: string
}) {
  const backgroundColor = color && isValidTagColor(color) ? color : "#64748b"

  const hex = backgroundColor.slice(1)

  const red = Number.parseInt(hex.slice(0, 2), 16)

  const green = Number.parseInt(hex.slice(2, 4), 16)

  const blue = Number.parseInt(hex.slice(4, 6), 16)

  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255

  const textColor = luminance > 0.55 ? "#111827" : "#ffffff"

  return (
    <span
      className="badge"
      style={{ backgroundColor, color: textColor }}
      aria-label={`Condition: ${condition}`}
    >
      <i />
      {condition}
    </span>
  )
}
