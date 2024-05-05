export function isTouch() {
  return "ontouchstart" in window;
}

export const VALID_FILE_EXTENSION = /\.(txt|md|markdown|csv|html|html|info|tex|xml|xhtml)$/i;
