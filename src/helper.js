import TurndownService from "turndown";
import { gfm } from "@truto/turndown-plugin-gfm";

export function isTouch() {
  return "ontouchstart" in window;
}

export function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints;
}

/**
 * Unslugifies a slugified string. (Source: https://github.com/danny-wood/unslugify/blob/master/index.js)
 *
 * @param {string} slug slugified string.
 * @returns {string} un-slugified string.
 */
export function unslugify(slug) {
  return slug
    .replace(/[-_]/g, " ")
    .replace(
      /\w\S*/g,
      (text) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase(),
    );
}

export function debounce(func, wait, immediate) {
  let timeout;
  return function () {
    let context = this;
    let args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    }, wait);
    if (immediate && !timeout) func.apply(context, args);
  };
}

// from: https://mojoauth.com/hashing/sha-1-in-javascript-in-browser/
export async function sha1(input) {

  if (typeof input === "String") {
    // Encode the input string to a Uint8Array
    const encoder = new TextEncoder();
    input = encoder.encode(input);
  }

  // Generate the SHA-1 hash
  const hashBuffer = await window.crypto.subtle.digest("SHA-1", input);

  // Convert the hash to a hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return hashHex; // Return the SHA-1 hash as a hex string
}

export function downloadFileByUrl(url) {
  const link = document.createElement('a');
  link.href = url;
  link.download = url.split("/").pop();
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke the object URL to free up memory
  window.URL.revokeObjectURL(url);
}

export function createTurndownService() {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    hr: "---",
  });
  turndownService.use(gfm);
  return turndownService;
}

export const VALID_FILE_EXTENSION =
  /\.(txt|md|markdown|csv|html|html|info|tex|xml|xhtml)$/i;
