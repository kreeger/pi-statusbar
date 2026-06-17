import { truncateToWidth } from "@earendil-works/pi-tui";

export function formatCount(value: number): string {
  if (value < 1000) return String(value);
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`.replace(".0M", "M");
  }
  return `${(value / 1000).toFixed(1)}k`;
}

export function formatCost(value: number): string {
  return `$${value.toFixed(3)}`;
}

export function joinSections(
  parts: Array<string | undefined>,
  divider: string,
): string {
  return parts.filter((part): part is string => Boolean(part)).join(divider);
}

export function truncateStatusbarLine(line: string, width: number): string {
  return truncateToWidth(line, width, "…");
}
