// Shared surface, control, and link styling. Full class strings are written
// out literally so Tailwind's scanner picks them up at build time.

export const panelClass = "border border-[var(--line)] bg-[var(--panel)]";

const buttonBase =
  "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap border px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/** The single main action on a page or panel. */
export const primaryButtonClass = `${buttonBase} border-[var(--accent-strong)] bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] print:text-[var(--foreground)]`;

/** Supporting actions next to a primary action. */
export const secondaryButtonClass = `${buttonBase} border-[var(--line-strong)] bg-[var(--panel)] text-[var(--foreground)] hover:border-[var(--accent-strong)] hover:bg-[var(--panel-strong)]`;

/** Destructive actions, shown only after the user asks for them. */
export const dangerButtonClass = `${buttonBase} border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-[var(--background)]`;

/** Text inputs, selects, and textareas. */
export const fieldClass =
  "min-h-10 w-full border border-[var(--line-strong)] bg-[var(--panel)] px-3 text-sm text-[var(--foreground)] transition-colors focus:border-[var(--accent-strong)]";

/** Inline text links. */
export const textLinkClass = "text-[var(--accent-strong)] underline-offset-2 hover:underline";

/** Uppercase label above a value, e.g. in <dt> elements. */
export const labelClass = "text-xs font-medium uppercase tracking-wide text-[var(--muted)]";

/** Filter chips (links or buttons): label first, then a muted count. */
export const chipClass = "inline-flex min-h-9 shrink-0 items-center gap-2 whitespace-nowrap border px-3 text-sm transition-colors";
export const activeChipClass = "border-[var(--accent-strong)] bg-[var(--info-soft)] text-[var(--foreground)]";
export const inactiveChipClass =
  "border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] hover:border-[var(--accent-strong)] hover:text-[var(--foreground)]";
export const chipCountClass = "tabular-nums text-[var(--muted)]";

/**
 * Scroll box around a data table with a sticky header. The top scroll padding keeps a
 * keyboard-focused row out from under the header; printing shows every row.
 */
export const tableScrollClass = "max-h-[75vh] overflow-auto scroll-pt-12 print:max-h-none print:overflow-visible";
