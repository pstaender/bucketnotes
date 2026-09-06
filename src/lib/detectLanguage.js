// Language detection for the current document. Uses the browser's built-in
// LanguageDetector API (https://developer.mozilla.org/en-US/docs/Web/API/LanguageDetector)
// when available, and falls back to the user agent / navigator language.
// The detected (or user-picked) identifier is written to `.app-window[lang]`
// so the browser applies the right spellchecking dictionary and hyphenation.

// The languages offered in the "Text language" submenu. `code` is a BCP-47
// identifier; `label` is the English name shown in the menu.
export const SUPPORTED_LANGUAGES = [
  { code: "ar", label: "Arabic" },
  { code: "bg", label: "Bulgarian" },
  { code: "ca", label: "Catalan" },
  { code: "cs", label: "Czech" },
  { code: "da", label: "Danish" },
  { code: "de", label: "German" },
  { code: "el", label: "Greek" },
  { code: "en", label: "English" },
  { code: "en-GB", label: "English (UK)" },
  { code: "en-US", label: "English (US)" },
  { code: "es", label: "Spanish" },
  { code: "et", label: "Estonian" },
  { code: "fa", label: "Persian" },
  { code: "fi", label: "Finnish" },
  { code: "fr", label: "French" },
  { code: "he", label: "Hebrew" },
  { code: "hi", label: "Hindi" },
  { code: "hr", label: "Croatian" },
  { code: "hu", label: "Hungarian" },
  { code: "id", label: "Indonesian" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "lt", label: "Lithuanian" },
  { code: "lv", label: "Latvian" },
  { code: "nb", label: "Norwegian Bokmål" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "pt", label: "Portuguese" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "ro", label: "Romanian" },
  { code: "ru", label: "Russian" },
  { code: "sk", label: "Slovak" },
  { code: "sl", label: "Slovenian" },
  { code: "sr", label: "Serbian" },
  { code: "sv", label: "Swedish" },
  { code: "th", label: "Thai" },
  { code: "tr", label: "Turkish" },
  { code: "uk", label: "Ukrainian" },
  { code: "vi", label: "Vietnamese" },
  { code: "zh", label: "Chinese" },
];

// Language identifier derived from the browser / OS settings. Always returns
// something usable, defaulting to "en".
export function userAgentLanguage() {
  return (
    navigator.language ||
    (navigator.languages && navigator.languages[0]) ||
    navigator.userLanguage ||
    "en"
  );
}

// Detects the language of `text` with the LanguageDetector API. Resolves to a
// BCP-47 identifier, or `null` when the API is missing, the text is too short,
// or the detector is not confident enough.
export async function detectLanguage(text) {
  const sample = (text || "").replace(/\s+/g, " ").trim();

  if (sample.length < 12) {
    return null;
  }

  const Detector =
    (typeof self !== "undefined" && self.LanguageDetector) ||
    (typeof window !== "undefined" && window.LanguageDetector) ||
    null;

  if (!Detector) {
    return null;
  }

  try {
    const availability = await Detector.availability();
    if (availability === "unavailable") {
      return null;
    }

    const detector = await Detector.create();
    if (typeof detector.ready?.then === "function") {
      await detector.ready;
    }

    const results = await detector.detect(sample.slice(0, 4000));
    const best = (results || []).find(
      (r) => r.detectedLanguage && r.detectedLanguage !== "und",
    );

    if (best && best.confidence >= 0.5) {
      return best.detectedLanguage;
    }
  } catch (err) {
    console.debug("LanguageDetector failed, falling back to navigator", err);
  }

  return null;
}
