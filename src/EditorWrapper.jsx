import FEATURE_FLAGS from "./featureFlags.json" with { type: "json" };
import { Editor as TinyMDE } from "tiny-markdown-editor";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { debounce, createTurndownService, VALID_FILE_EXTENSION } from "./helper";

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
    return /^[^@]+@[^@]+$/.test(text) ? `mailto:${text}` : text;
  }

  const marker = target.closest(
    LINK_PART_CLASSES.map((c) => `.${c}`).join(", "),
  );
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

// Removes up to `tabSize` characters of leading indentation from `line`: a
// single leading tab, or else as many leading spaces as are present (capped
// at `tabSize`). Returns the dedented line and how many characters were cut,
// so callers can shift the caret/selection by the same amount.
function dedentLine(line, tabSize) {
  if (line.startsWith("\t")) {
    return { line: line.slice(1), removed: 1 };
  }
  let removed = 0;
  while (removed < tabSize && line[removed] === " ") {
    removed++;
  }
  return { line: line.slice(removed), removed };
}

// Implements Tab/Shift+Tab for the editor: with an active selection, indents
// or dedents every line it touches (like a code editor); with just a caret,
// Tab inserts `tabSize` spaces and Shift+Tab dedents the current line.
function indentSelection(tinyMDE, tabSize, dedent) {
  const focus = tinyMDE.getSelection(false);
  if (!focus) {
    return;
  }
  const anchor = tinyMDE.getSelection(true) || focus;
  const collapsed = anchor.row === focus.row && anchor.col === focus.col;

  if (!tinyMDE.isRestoringHistory) {
    tinyMDE.pushHistory();
  }
  tinyMDE.clearDirtyFlag();

  if (collapsed && !dedent) {
    const { row, col } = focus;
    const spaces = " ".repeat(tabSize);
    tinyMDE.lines[row] =
      tinyMDE.lines[row].slice(0, col) + spaces + tinyMDE.lines[row].slice(col);
    tinyMDE.lineDirty[row] = true;
    tinyMDE.updateFormatting();
    tinyMDE.setSelection({ row, col: col + tabSize });
    tinyMDE.fireChange();
    return;
  }

  const anchorFirst =
    anchor.row < focus.row ||
    (anchor.row === focus.row && anchor.col <= focus.col);
  const startRow = anchorFirst ? anchor.row : focus.row;
  let endRow = anchorFirst ? focus.row : anchor.row;
  const endCol = anchorFirst ? focus.col : anchor.col;
  // A selection ending exactly at column 0 of a line didn't meaningfully
  // select that line, so leave it out (mirrors TinyMDE's own line commands).
  if (endRow > startRow && endCol === 0) {
    endRow--;
  }

  const newAnchor = { ...anchor };
  const newFocus = { ...focus };

  for (let row = startRow; row <= endRow; row++) {
    if (dedent) {
      const { line, removed } = dedentLine(tinyMDE.lines[row], tabSize);
      tinyMDE.lines[row] = line;
      if (newAnchor.row === row) {
        newAnchor.col = Math.max(0, newAnchor.col - removed);
      }
      if (newFocus.row === row) {
        newFocus.col = Math.max(0, newFocus.col - removed);
      }
    } else {
      tinyMDE.lines[row] = " ".repeat(tabSize) + tinyMDE.lines[row];
      if (newAnchor.row === row) {
        newAnchor.col += tabSize;
      }
      if (newFocus.row === row) {
        newFocus.col += tabSize;
      }
    }
    tinyMDE.lineDirty[row] = true;
  }

  tinyMDE.updateFormatting();
  tinyMDE.setSelection(newFocus, newAnchor);
  tinyMDE.fireChange();
}

// Converts a {row, col} selection into a single character offset into
// `content`, so the caret position can be persisted (e.g. across a page
// reload) as one plain number.
function offsetFromPosition(content, pos) {
  if (!pos) {
    return null;
  }
  const lines = content.split(/\r\n|\r|\n/);
  let offset = 0;
  for (let i = 0; i < pos.row; i++) {
    offset += (lines[i]?.length ?? 0) + 1;
  }
  return offset + pos.col;
}

// Inverse of offsetFromPosition: resolves a character offset back into a
// {row, col} selection against `content`, clamped to its bounds.
function positionFromOffset(content, offset) {
  const lines = content.split(/\r\n|\r|\n/);
  let remaining = offset;
  for (let row = 0; row < lines.length; row++) {
    if (remaining <= lines[row].length) {
      return { row, col: Math.max(0, remaining) };
    }
    remaining -= lines[row].length + 1;
  }
  const lastRow = lines.length - 1;
  return { row: lastRow, col: lines[lastRow]?.length ?? 0 };
}

function openLink(url, downloadAssetFile, navigate) {
  const target = resolveLinkTarget(url);
  if (!target) {
    return;
  }
  const isHttpLike = ["http:", "https:", "ftp:"].includes(target.protocol);
  if (isHttpLike && target.origin === window.location.origin) {
    if (target.pathname.startsWith(`${FEATURE_FLAGS.IMAGE_UPLOAD_PATH}/`)) {
      navigate(
        `${FEATURE_FLAGS.IMAGE_UPLOAD_PATH}${target.pathname.slice(FEATURE_FLAGS.IMAGE_UPLOAD_PATH.length)}`,
      );
      return;
    }
    if (VALID_FILE_EXTENSION.test(String(target))) {
      return navigate(String(target).split('#')[1]);
    }
    downloadAssetFile(`${target.pathname}${target.search}${target.hash}`);
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
  tabSize = 2,
  initialCaretPosition,
  downloadAssetFile,
} = {}) {
  const refEditor = useRef();
  const refTinyMDE = useRef();
  const refTabSize = useRef(tabSize);
  const refCaretRestored = useRef(false);
  // Remembers the last non-collapsed selection, so actions triggered from a
  // menu (which blurs the editor and collapses the DOM selection) can still
  // operate on what the user had selected.
  const refLastSelection = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    refTabSize.current = tabSize;
  }, [tabSize]);

  const handleChange = (content) => {
    const focusPos = refTinyMDE.current?.getSelection?.(false);
    onChange(content, { caretPosition: offsetFromPosition(content, focusPos) });
  };

  const handleChangeDebounced = debounce(handleChange, 200);

  // Syncs external content changes (e.g. a file (re)load) into the editor.
  // This can fire while the user is actively editing (a redundant reload of
  // content that's already on screen, or a race between two loads), so it
  // must not blow away focus/caret unless the content genuinely changed.
  useEffect(() => {
    if (initialText === null || initialText === undefined || !focusEditor) {
      return;
    }
    if (focusEditor.getMarkdown() === initialText) {
      return;
    }

    const hadFocus = document.activeElement === focusEditor.target;
    const focusPos = hadFocus ? focusEditor.getSelection(false) : null;
    const anchorPos = hadFocus ? focusEditor.getSelection(true) : null;

    focusEditor.replaceText(initialText, { clearHistory: true });

    if (hadFocus) {
      focusEditor.target.focus();
      const lines = initialText.split(/\r\n|\r|\n/);
      const clamp = (pos) => {
        if (!pos) {
          return pos;
        }
        const row = Math.min(Math.max(pos.row, 0), lines.length - 1);
        const col = Math.min(Math.max(pos.col, 0), lines[row].length);
        return { row, col };
      };
      focusEditor.setSelection(clamp(focusPos), clamp(anchorPos));
    }
  }, [initialText, focusEditor]);

  // One-time restore of the caret position persisted by handleChange (e.g.
  // across a browser/PWA reload of the same file), once the editor exists
  // and its content has been loaded.
  useEffect(() => {
    if (
      refCaretRestored.current ||
      !focusEditor ||
      initialCaretPosition === null ||
      initialCaretPosition === undefined
    ) {
      return;
    }
    refCaretRestored.current = true;
    const pos = positionFromOffset(
      focusEditor.getMarkdown(),
      initialCaretPosition,
    );
    focusEditor.setSelection(pos);
    focusEditor.target.focus();
  }, [focusEditor, initialCaretPosition]);

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
    // Re-applied unconditionally below (not just when the line changes)
    // because TinyMDE re-renders a line's DOM node in place (resetting its
    // className) whenever its content is edited, which would otherwise wipe
    // the class right back off while the caret stays put and typing continues.
    let currentCaretLine = null;
    tinyMDE.addEventListener("selection", (ev) => {
      if (!ev.focus) {
        return;
      }
      const line = tinyMDE.lineElements[ev.focus.row];
      if (!line) {
        return;
      }
      if (line !== currentCaretLine) {
        currentCaretLine?.classList.remove("with-caret");
        currentCaretLine = line;
        if (scrollWindowToCenterCaret) {
          line.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
      line.classList.add("with-caret");
    });

    // Track the last non-collapsed selection as character offsets.
    tinyMDE.addEventListener("selection", (ev) => {
      const focus = ev.focus;
      const anchor = ev.anchor || focus;
      if (!focus || !anchor) {
        return;
      }
      const content = tinyMDE.getContent();
      const a = offsetFromPosition(content, anchor);
      const b = offsetFromPosition(content, focus);
      if (a === b) {
        refLastSelection.current = null;
        return;
      }
      refLastSelection.current = {
        start: Math.min(a, b),
        end: Math.max(a, b),
        text: content.slice(Math.min(a, b), Math.max(a, b)),
      };
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

    // Tab indents (inserts spaces at the caret, or shifts selected lines
    // right); Shift+Tab shifts the current/selected lines left.
    refEditor.current.addEventListener("keydown", (ev) => {
      if (ev.key !== "Tab" || ev.ctrlKey || ev.metaKey || ev.altKey) {
        return;
      }
      if (!tinyMDE.e.isContentEditable) {
        return;
      }
      ev.preventDefault();
      indentSelection(tinyMDE, refTabSize.current, ev.shiftKey);
    });

    // Double-clicking a link, image destination, or autolink opens it
    // instead of the browser's default word-selection behavior.
    refEditor.current.addEventListener("dblclick", (ev) => {
      const url = getLinkUrlFromElement(ev.target);
      if (!url) {
        return;
      }
      ev.preventDefault();
      openLink(url, downloadAssetFile, navigate);
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
      // Returns the currently selected text along with its character offsets
      // into the full markdown, or null when nothing is selected. Falls back
      // to the last remembered selection when the editor has been blurred
      // (e.g. by opening a menu), as long as it still matches the content.
      getSelectedText() {
        const content = tinyMDE.getContent();
        const focus = tinyMDE.getSelection(false);
        const anchor = tinyMDE.getSelection(true) || focus;
        if (focus && anchor) {
          const a = offsetFromPosition(content, anchor);
          const b = offsetFromPosition(content, focus);
          const start = Math.min(a, b);
          const end = Math.max(a, b);
          if (start !== end) {
            return { start, end, text: content.slice(start, end) };
          }
        }
        const last = refLastSelection.current;
        if (
          last &&
          last.end <= content.length &&
          content.slice(last.start, last.end) === last.text
        ) {
          return { ...last };
        }
        return null;
      },
      setSelection(focus, anchor) {
        return tinyMDE.setSelection(focus, anchor);
      },
      // Inserts `text` at the current caret position (replacing any selection).
      // When focus has moved elsewhere (e.g. a menu was clicked) the DOM
      // selection is gone, so fall back to the end of the line that last held
      // the caret before letting TinyMDE append at the document end.
      insertText(text) {
        if (!tinyMDE.getSelection(false)) {
          const caretLine = tinyMDE.e.querySelector("div.with-caret");
          const row = caretLine
            ? Array.from(tinyMDE.e.children).indexOf(caretLine)
            : -1;
          if (row >= 0) {
            tinyMDE.setSelection({ row, col: tinyMDE.lines[row].length });
          }
        }
        tinyMDE.paste(text);
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
