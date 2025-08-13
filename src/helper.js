export function isTouch() {
  return "ontouchstart" in window;
}

export function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints;
}

export const VALID_FILE_EXTENSION = /\.(txt|md|markdown|csv|html|html|info|tex|xml|xhtml)$/i;
