import { useEffect, useMemo, useRef, useState } from "react";
import { Marked } from "marked";
import markedFootnote from "marked-footnote";
import katex from "katex";
import FEATURE_FLAGS from "./featureFlags.json" with { type: "json" };
import closeIcon from "./icons/close.svg";
import * as s3 from "./s3";
import "./PrintLayout.css";

const MINIMAX_STYLESHEETS = [
  "https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax.css",
  "https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax-din-a4.css",
];

const MINIMAX_VARIANTS = [
  {
    label: "Default",
    hrefs: [
      "https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax-alternate-fonts.css",
    ],
  },
  {
    label: "Serif",
    hrefs: [
      "https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax-alternate-fonts.css",
      "https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax-serif.css",
    ],
  },
  {
    label: "Browser Serif",
    hrefs: ["https://cdn.jsdelivr.net/npm/minimaxcss@latest/minimax-serif.css"],
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

// Resolves an <img src="…"> that points at an S3 asset (either a plain
// "/assets/…" path, or a hash-routed link such as "…#/assets/…") to its
// bucket key, so it can be fetched and inlined for printing.
function assetKeyFromImageSrc(src) {
  if (!src) {
    return null;
  }
  const base = FEATURE_FLAGS.IMAGE_UPLOAD_PATH;
  let url;
  try {
    url = new URL(src, window.location.href);
  } catch {
    return null;
  }
  const hashPath = url.hash ? url.hash.slice(1) : "";
  if (hashPath.startsWith(base)) {
    return decodeURIComponent(hashPath.replace(/^\/+/, ""));
  }
  if (url.pathname && url.pathname.startsWith(base)) {
    return decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  }
  return null;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

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
  const articleRef = useRef(null);

  const html = useMemo(
    () =>
      new Marked()
        .use(markedFootnote())
        .parse(text || "", { gfm: true, breaks: true }),
    [text],
  );

  // Inline every image that points at an S3 asset as a data URL, so it
  // prints/exports reliably instead of depending on a (possibly expired or
  // unauthenticated) signed URL being fetchable at print time.
  useEffect(() => {
    if (!articleRef.current) {
      return;
    }
    const images = Array.from(articleRef.current.querySelectorAll("img") || []);
    let cancelled = false;
    images.forEach((img) => {
      const key = assetKeyFromImageSrc(img.getAttribute("src"));
      if (!key) {
        return;
      }
      (async () => {
        try {
          const signedUrl = await s3.cachedSignedPublicS3Url(key);
          const response = await fetch(signedUrl);
          const blob = await response.blob();
          const dataUrl = await blobToDataUrl(blob);
          if (!cancelled) {
            img.src = dataUrl;
          }
        } catch (err) {
          console.error(`Could not inline image '${key}':`, err);
        }
      })();
    });

    // katex
    articleRef.current
      .querySelectorAll("pre:has(> code.language-katex)")
      .forEach((pre) => {
        const div = document.createElement("div");
        console.log('ok');
        try {
          katex.render(pre.querySelector("code.language-katex").innerText, div, {
            throwOnError: true,
          });
        } catch (e) {
          console.debug(`Could not render katex (check syntax):`, e);
        }
        div.classList.add('katex');
        pre.replaceWith(div);
      });

    return () => {
      cancelled = true;
    };
  }, [html]);

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
      <article className="print-layout-page">
        <section
          ref={articleRef}
          className="minimax"
          dangerouslySetInnerHTML={{ __html: html }}
        ></section>
      </article>
    </div>
  );
}
