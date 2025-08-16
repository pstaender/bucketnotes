import FocusEditorCore from "../focus-editor/FocusEditorCore.mjs";
import { useEffect, useRef, useState } from "react";
import * as s3 from "./s3";
import { debounce } from "./helper";

const localStorage = window.localStorage;

export function EditorWrapper({
  placeholder,
  initialText,
  indentHeadings,
  onChange,
  readOnly,
  focusMode,
  doGuessNextListItemLine,
  showNumberOfParagraphs,
  renderAllContent,
  scrollWindowToCenterCaret,
  previewImages,
  focusEditor,
  setFocusEditor,
} = {}) {
  let currentFocusEditor = null;
  const refEditor = useRef();

  const handleChange = (event) => {
    onChange(refEditor.current.editor.getMarkdown(), {});
  };

  const handleInput = (event) => {
    handleChangeDebounced(event);
  };

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

    async function checkForAwsImage(a) {
      const expiresIn = 3600;
      if (!a.getAttribute("href")) {
        return;
      }
      const url = a.getAttribute("href");
      const cacheKey = `s3_signed_url:${url}`;
      if (localStorage.getItem(cacheKey)) {
        const data = JSON.parse(localStorage.getItem(cacheKey));
        if (data.validUntil > new Date().getTime()) {
          a.href = "#/" + a.getAttribute("href");
          a.style.setProperty("--url", `url(${data.url})`);
          return;
        }
      }
      const imageUrl = await s3.getPublicUrl(url, expiresIn);
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          validUntil: new Date().getTime() + expiresIn * 1000,
          url: imageUrl,
        }),
      );
      a.href = "#/" + a.getAttribute("href");
      a.style.setProperty("--url", `url(${imageUrl})`);
    }

    refEditor.current.addEventListener("renderParagraphBlocks", (ev) => {
      if (ev.detail.elements) {
        ev.detail.elements.forEach((el) =>
          el
            .querySelectorAll('a.link.image[href^="images/"]:not(.aws-url)')
            .forEach((a) => {
              a.classList.add("aws-url");
              checkForAwsImage(a);
            }),
        );
      }
    });

    const handleChangeDebounced = debounce(handleChange, 200);

    refEditor.current.addEventListener("keyup", handleChangeDebounced);
    refEditor.current.addEventListener("paste", handleChange);

    if (scrollWindowToCenterCaret) {
      refEditor.current.addEventListener("keyup", (ev) => {
        refEditor.current.querySelector(".block.with-caret")?.scrollIntoView({
          behaviour: "smooth",
          container: "nearest",
          block: "center",
        });
      });
    }

    const editor = new FocusEditorCore(refEditor.current);
    refEditor.current.editor = editor;


    if (initialText) {
      editor.replaceText(initialText, { clearHistory: true });
    }
    editor.tabSize = 2;
    setFocusEditor(editor);
    return () => {
      if (
        typeof container !== "undefined" &&
        container.contains(_editorElement)
      ) {
        container.removeChild(_editorElement);
      }
      refEditor.current.destroy();
    };
  }, []);

  return (
    <focus-editor
      class={[indentHeadings ? "indent-headings" : ""]
        .filter((v) => !!v)
        .join(" ")}
      image-preview={previewImages ? "*" : null}
    >
      <div ref={refEditor} onInput={handleInput}></div>
    </focus-editor>
  );
}
