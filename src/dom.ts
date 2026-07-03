// Small DOM helpers shared by views and modals.

/**
 * Escape a string for interpolation into an HTML template (element text or
 * a double-quoted attribute). Project names/paths come from project.godot
 * files on disk — never trust them as markup.
 */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

/** querySelector for an element known to exist, with the cast in one place. */
export function q<T extends HTMLElement>(root: ParentNode, selector: string): T {
  return root.querySelector(selector) as T;
}

/** Bind a click handler to every `[data-<attr>]` element; receives the attribute value. */
export function onDataClick(
  root: ParentNode,
  attr: string,
  handler: (value: string, el: HTMLElement) => void,
): void {
  root.querySelectorAll<HTMLElement>(`[data-${attr}]`).forEach((el) =>
    el.addEventListener("click", () => handler(el.dataset[attr] ?? "", el)),
  );
}
