import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import closeIcon from "./icons/close.svg";
import "./PrintLayout.css";

const MINIMAX_STYLESHEETS = [
  "https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax.css",
  "https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax-din-a4.css",
];

const MINIMAX_VARIANTS = [
  { label: "Default", hrefs: [
    "https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax-alternate-fonts.css",
  ] },
  {
    label: "Sans Serif",
    hrefs: [
      "https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax-alternate-fonts.css",
      "https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax-serif.css",
    ],
  },
  {
    label: "Browser Serif",
    hrefs: [
      "https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax-serif.css",
    ],
  },
  {
    label: "Browser Sans Serif",
    hrefs: [],
  },
  {
    label: "Monospace",
    hrefs: [
      "https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax-monospace.css",
    ],
  },
  {
    label: "Tufte",
    hrefs: [
      "https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax-serif.css",
      "https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax-tufte.css",
    ],
  },
];

const MINIMAX_LANDSCAPE =
  "https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax-page-landscape.css";

function appendPrintStylesheet(href) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.printLayout = "true";
  document.head.appendChild(link);
  return link;
}

export function PrintLayout({ text, filename, onClose } = {}) {
  const [variant, setVariant] = useState("Default");
  const [landscape, setLandscape] = useState(false);

  const html = useMemo(
    () => marked.parse(text || "", { gfm: true, breaks: false }),
    [text],
  );

  useEffect(() => {
    const metaColorScheme = document.querySelector(`meta[name="color-scheme"]`);
    const previousColorSchemeContent = metaColorScheme.content;
    const links = MINIMAX_STYLESHEETS.map(appendPrintStylesheet);
    metaColorScheme.content = "";
    return () => {
      links.forEach((link) => link.remove());
      metaColorScheme.content = previousColorSchemeContent;
    };
  }, []);

  useEffect(() => {
    const hrefs = MINIMAX_VARIANTS.find((v) => v.label === variant)?.hrefs;
    if (!hrefs) {
      return;
    }
    const links = hrefs.map((href) => appendPrintStylesheet(href));
    return () => links.forEach((link) => link.remove());
  }, [variant]);

  useEffect(() => {
    if (!landscape) {
      return;
    }
    const link = appendPrintStylesheet(MINIMAX_LANDSCAPE);
    return () => link.remove();
  }, [landscape]);

  useEffect(() => {
    const onKeyDown = (ev) => {
      if (ev.key === "Escape") {
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const title = (filename || "").replace(/^\/+/, "");

  return (
    <div
      className={["print-layout", landscape ? "landscape" : null]
        .filter((v) => !!v)
        .join(" ")}
    >
      <div className="print-layout-toolbar">
        <span className="print-layout-title">{title}</span>
        <div className="print-layout-actions">
          <label className="print-layout-landscape">
            <input
              type="checkbox"
              checked={landscape}
              onChange={(ev) => setLandscape(ev.target.checked)}
            />
            Landscape
          </label>
          <select
            value={variant}
            onChange={(ev) => setVariant(ev.target.value)}
          >
            {MINIMAX_VARIANTS.map((v) => (
              <option key={v.label} value={v.label}>
                {v.label}
              </option>
            ))}
          </select>
          <button onClick={() => window.print()}>Print</button>
          <button onClick={() => onClose?.()}>
            <img src={closeIcon} alt="Close" />
          </button>
        </div>
      </div>
      <div className="print-layout-page">
        <article
          className="minimax"
          dangerouslySetInnerHTML={{ __html: html }}
        ></article>
      </div>
    </div>
  );
}
