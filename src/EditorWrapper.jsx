import { Editor as TinyMDE } from "tiny-markdown-editor";
import { useEffect, useRef } from "react";
import { debounce, createTurndownService } from "./helper";

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
