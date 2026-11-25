/** Text a sighted user sees. The URL stays in a screen-reader-only label. */
export function visibleLabel(link: HTMLElement): string {
  const clone = link.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".sr-only").forEach((node) => node.remove());
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}
