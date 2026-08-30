import { useEffect, useMemo } from "react";
import { marked } from "marked";
import closeIcon from "./icons/close.svg";
import "./PrintLayout.css";

const MINIMAX_STYLESHEETS = [
  "https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax.css",
  "https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax-din-a4.css",
  // "https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax-serif.css",
  // "https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax-alternate-fonts.css",
  // "https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax-monospace.css",
  // "https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax-tufte.css",
];

export function PrintLayout({ text, filename, onClose } = {}) {
  const html = useMemo(
    () => marked.parse(text || "", { gfm: true, breaks: false }),
    [text],
  );

  useEffect(() => {
    const metaColorScheme = document.querySelector(`meta[name="color-scheme"]`);
    const previousColorSchemeContent = metaColorScheme.content;
    // temporarily load the minimax print stylesheets while the layout is open
    const links = MINIMAX_STYLESHEETS.map((href) => {
      document
        .querySelectorAll('head link[rel="stylesheet"]')
        .forEach((link) => {
          if (link.dataset.printLayout) {
            return;
          }
          link.disabled = true;
        });
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.printLayout = "true";
      document.head.appendChild(link);
      return link;
    });
    metaColorScheme.content = '';
    window.print();
    return () => {
      links.forEach((link) => link.remove());
      metaColorScheme.content = previousColorSchemeContent;
      document
        .querySelectorAll('head link[rel="stylesheet"]')
        .forEach((link) => (link.disabled = false));
    };
  }, []);

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
    <div className="print-layout">
      <div className="print-layout-toolbar">
        <span className="print-layout-title">{title}</span>
        <div className="print-layout-actions">
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
