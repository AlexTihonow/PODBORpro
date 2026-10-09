/** Склеивает условные Tailwind-классы, отбрасывая пустые. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
