import { Editor as TinyMDE } from "tiny-markdown-editor";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { debounce, createTurndownService } from "./helper";

// Elements TinyMDE renders as part of a link/image construct. It has no
// per-token wrapper, so a double click anywhere inside one of these needs to
// walk to the sibling that actually carries the destination URL.
const LINK_PART_CLASSES = [
  "TMLink",
  "TMImage",
  "TMLinkDestination",
  "TMImageDestination",
  "TMLinkTitle",
  "TMImageTitle",
  "TMMark_TMLink",
  "TMMark_TMImage",
];

function isLinkPart(el) {
  return !!el && LINK_PART_CLASSES.some((c) => el.classList.contains(c));
}

// Resolves the URL/path behind a double-clicked link, image, or autolink
// span, or null if the click didn't land on one.
function getLinkUrlFromElement(target) {
  const autolink = target.closest(".TMAutolink");
  if (autolink) {
    const text = autolink.textContent.trim();
    if (!text) {
      return null;
    }
    if (/^(https?|ftp|mailto|xmpp):/i.test(text)) {
      return text;
    }
    if (/^www\./i.test(text)) {
      return `http://${text}`;
    }
    return text.includes("@") ? `mailto:${text}` : text;
  }

  const marker = target.closest(LINK_PART_CLASSES.map((c) => `.${c}`).join(", "));
  if (!marker || !marker.parentElement) {
    return null;
  }

  const siblings = Array.from(marker.parentElement.children);
  const index = siblings.indexOf(marker);
  let start = index;
  while (start > 0 && isLinkPart(siblings[start - 1])) {
    start--;
  }
  let end = index;
  while (end < siblings.length - 1 && isLinkPart(siblings[end + 1])) {
    end++;
  }
  for (let i = start; i <= end; i++) {
    if (
      siblings[i].classList.contains("TMLinkDestination") ||
      siblings[i].classList.contains("TMImageDestination")
    ) {
      const text = siblings[i].textContent.trim();
      return text || null;
    }
  }
  return null;
}

// Resolves the URL a link points to. A URL with a scheme (http:, mailto:, ...)
// is resolved as-is; a fragment stays relative to the current page; anything
// else is a vault-relative path (e.g. "assets/images/x.png") and is resolved
// against the origin root, not the current page's path, so it always becomes
// "/assets/images/x.png" regardless of which note is currently open.
function resolveLinkTarget(url) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  }
  if (url.startsWith("#")) {
    return new URL(url, window.location.href);
  }
  return new URL(url.startsWith("/") ? url : `/${url}`, window.location.origin);
}

function openLink(url, navigate) {
  const target = resolveLinkTarget(url);
  if (!target) {
    return;
  }
  const isHttpLike = ["http:", "https:", "ftp:"].includes(target.protocol);
  if (isHttpLike && target.origin === window.location.origin) {
    navigate(`${target.pathname}${target.search}${target.hash}`);
    return;
  }
  if (isHttpLike) {
    window.open(target.href, "_blank", "noopener,noreferrer");
    return;
  }
  window.location.href = target.href;
}

export function EditorWrapper({
  placeholder,
  initialText,
  indentHeadings,
  onChange,
  readOnly,
  focusMode,
  scrollWindowToCenterCaret,
  fullWithEditor,
  focusEditor,
  setFocusEditor,
  convertHTMLToMarkdown,
  // Accepted for backwards compatibility with callers, but currently unused:
  // tiny-markdown-editor has no per-block table/media rendering to toggle, and
  // "smart next list item" was already a no-op in the previous implementation.
  doGuessNextListItemLine,
  previewImages,
  renderMarkdownTables,
} = {}) {
  const refEditor = useRef();
  const refTinyMDE = useRef();
  const navigate = useNavigate();

  const handleChange = (content) => {
    onChange(content, {});
  };

  const handleChangeDebounced = debounce(handleChange, 200);

  useEffect(() => {
    if (initialText !== null && initialText !== undefined && focusEditor) {
      focusEditor.replaceText(initialText, { clearHistory: true });
    }
  }, [initialText, focusEditor]);

  useEffect(() => {
    if (!focusEditor) {
      return;
    }
    function isSet(val) {
      return val !== null && val !== undefined;
    }
    if (isSet(placeholder)) {
      focusEditor.placeholder = placeholder;
    }
    if (isSet(readOnly)) {
      focusEditor.readOnly = readOnly;
    }
  }, [focusEditor, placeholder, readOnly]);

  useEffect(() => {
    if (!refEditor.current) {
      return;
    }

    const tinyMDE = new TinyMDE({
      element: refEditor.current,
      content: initialText || "",
    });
    refTinyMDE.current = tinyMDE;
    tinyMDE.e.contentEditable = !readOnly;
    if (placeholder) {
      tinyMDE.placeholder = placeholder;
      tinyMDE.e.setAttribute("data-placeholder", placeholder);
      tinyMDE.updatePlaceholder();
    }

    // Move a "with-caret" class to the line the caret is currently on, so CSS
    // can dim every other line (focus mode) and/or keep the caret centered.
    let currentCaretLine = null;
    tinyMDE.addEventListener("selection", (ev) => {
      const line = tinyMDE.lineElements[ev.focus.row];
      if (!line || line === currentCaretLine) {
        return;
      }
      currentCaretLine?.classList.remove("with-caret");
      line.classList.add("with-caret");
      currentCaretLine = line;
      if (scrollWindowToCenterCaret) {
        line.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });

    tinyMDE.addEventListener("change", (ev) =>
      handleChangeDebounced(ev.content),
    );

    // TinyMDE attaches its own native paste handler on `tinyMDE.e`. Intercept
    // the paste first (capture phase runs before that bubble-phase handler),
    // and hand it converted Markdown instead of raw HTML when requested.
    refEditor.current.addEventListener(
      "paste",
      (ev) => {
        const clipboardData = ev.clipboardData || window.clipboardData;
        const pastedHtml = clipboardData?.getData("text/html");
        if (pastedHtml && convertHTMLToMarkdown) {
          ev.preventDefault();
          ev.stopPropagation();
          tinyMDE.paste(createTurndownService().turndown(pastedHtml));
        }
      },
      { capture: true },
    );

    // Double-clicking a link, image destination, or autolink opens it
    // instead of the browser's default word-selection behavior.
    refEditor.current.addEventListener("dblclick", (ev) => {
      const url = getLinkUrlFromElement(ev.target);
      if (!url) {
        return;
      }
      ev.preventDefault();
      openLink(url, navigate);
    });

    const editor = {
      get target() {
        return tinyMDE.e;
      },
      getMarkdown() {
        return tinyMDE.getContent();
      },
      getSelection(getAnchor) {
        return tinyMDE.getSelection(getAnchor);
      },
      setSelection(focus, anchor) {
        return tinyMDE.setSelection(focus, anchor);
      },
      replaceText(text, { clearHistory = false } = {}) {
        if (clearHistory) {
          // Drop old undo/redo history *before* setting content, so the
          // freshly loaded content becomes the sole baseline to undo back to.
          tinyMDE.undoStack = [];
          tinyMDE.redoStack = [];
        }
        tinyMDE.setContent(text ?? "");
      },
      set placeholder(value) {
        tinyMDE.placeholder = value;
        tinyMDE.e.setAttribute("data-placeholder", value || "");
        tinyMDE.updatePlaceholder();
      },
      set readOnly(value) {
        tinyMDE.e.contentEditable = !value;
      },
      // TinyMDE re-renders reactively on every content change, so there is
      // nothing to force here. Kept as no-ops so existing callers that used
      // to trigger a re-render after DOM-level edits keep working unchanged.
      refresh() {},
      fullRefresh() {},
    };

    setFocusEditor(editor);
  }, []);

  return (
    <focus-editor
      class={[
        indentHeadings ? "indent-headings" : "",
        focusMode ? "highlight-current-paragraph" : "",
        fullWithEditor ? "full-width-editor" : "",
        fullWithEditor ? "no-wrap" : "",
      ]
        .filter((v) => !!v)
        .join(" ")}
    >
      <div ref={refEditor}></div>
    </focus-editor>
  );
}
