// Printing the report preview on the Reports page. The preview is an iframe; printing the page
// around it cannot paginate the iframe's document, so printing goes to the iframe itself.

/** Ctrl+P, or Cmd+P on a Mac, with no other modifier. */
export function isPrintShortcut(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "p";
}

/**
 * Whether a frame holds its finished document. Until the preview's response arrives, the frame
 * still shows the empty initial "about:blank" document, which prints as a blank page.
 */
export function isFrameDocumentReady(frame: { href?: string; readyState?: string }): boolean {
  return Boolean(frame.href) && frame.href !== "about:blank" && frame.readyState === "complete";
}
