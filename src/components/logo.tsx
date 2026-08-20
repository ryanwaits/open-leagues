/** The Open Leagues mark: a standings table, first place filled.
 * Mono currentColor so it rides any skin/theme; pass a size class. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 44" fill="none" aria-hidden className={className}>
      <rect x="6" y="9" width="32" height="7.5" rx="2" fill="currentColor" />
      <rect x="6" y="20.5" width="32" height="7.5" rx="2" stroke="currentColor" strokeWidth="2.4" />
      <rect x="6" y="32" width="22" height="7.5" rx="2" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}
