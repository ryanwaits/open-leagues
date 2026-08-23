/** Index of the snap child nearest to scrollLeft. cardW includes the gap. */
export function settledIndex(scrollLeft: number, cardW: number, count: number): number {
  if (cardW <= 0 || count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(scrollLeft / cardW)));
}
