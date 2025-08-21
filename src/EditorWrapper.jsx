import FEATURE_FLAGS from "./featureFlags.json" with { type: "json" };
import FocusEditorCore from "../focus-editor/FocusEditorCore.mjs";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as s3 from "./s3";
import { debounce, downloadFileByUrl } from "./helper";

const localStorage = window.localStorage;

export function EditorWrapper({
  placeholder,
  initialText,
  indentHeadings,
  onChange,
  readOnly,
  focusMode,
  doGuessNextListItemLine,
  renderAllContent,
  scrollWindowToCenterCaret,
  previewImages,
  focusEditor,
  setFocusEditor,
  fullWithEditor,
} = {}) {
  let currentFocusEditor = null;
  const refEditor = useRef();
  const navigate = useNavigate();

  const handleChange = (event) => {
    onChange(refEditor.current.editor.getMarkdown(), {});
  };

  const handleChangeDebounced = debounce(handleChange, 200);

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

    async function checkForAwsFile(a) {
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
      return a;
    }

    refEditor.current.addEventListener("renderParagraphBlocks", (ev) => {
      if (ev.detail.elements) {
        ev.detail.elements.forEach((el) => {
          el.querySelectorAll(
            `a.link.image[href^="${FEATURE_FLAGS.IMAGE_UPLOAD_PATH.replace(/^\/*/, "")}"]:not(.aws-url)`,
          ).forEach((a) => {
            a.classList.add("aws-url");
            checkForAwsFile(a);
          });
          el.querySelectorAll(
            `a.link[href^="${FEATURE_FLAGS.AUDIO_UPLOAD_PATH.replace(/^\/*/, "")}"]:not(.aws-url)`,
          ).forEach((a) => {
            a.classList.add("aws-url");
            a.setAttribute('href', "#/" + a.getAttribute("href"));
          });
          el.querySelectorAll(
            `a.link[href^="${FEATURE_FLAGS.VIDEO_UPLOAD_PATH.replace(/^\/*/, "")}"]:not(.aws-url)`,
          ).forEach((a) => {
            a.classList.add("aws-url");
            a.setAttribute('href', "#/" + a.getAttribute("href"));
          });
          el.querySelectorAll(
            `a.link:not(.aws-url)[href^="${FEATURE_FLAGS.ASSETS_BASE_PATH.replace(/^\/*/, "")}"]`,
          ).forEach((a) => {
            a.classList.add("aws-url");
            a.classList.add("prevent-dblclick-visit");
            a.addEventListener("dblclick", (ev) => {
              ev.preventDefault();
              downloadFileByUrl(a.getAttribute("href"));
            });
          });
          el.querySelectorAll('a.link:not(.aws-url)[href^="/"]').forEach(
            (a) => {
              a.classList.add("prevent-dblclick-visit");
              a.addEventListener("dblick", (ev) => {
                ev.preventDefault();
                navigate(a.getAttribute("href"));
              });
            },
          );
          el.querySelectorAll('a.link.aws-url:not(.image)[href^="#/"]').forEach(
            async (a) => {
              let url = a.dataset.uswUrl || (await s3.cachedSignedPublicS3Url(a.getAttribute("href").replace(/^#\//, "")));
              a.addEventListener("mouseenter", (ev) => {
                if (a.querySelector(".audio-preview")) {
                  a.querySelector(".audio-preview").classList.add("visible");
                  return;
                }
                let div = document.createElement("div");
                div.classList.add("audio-preview");
                div.classList.add("visible");
                let audio = document.createElement("audio");
                audio.src = url;
                audio.controls = true;
                div.appendChild(audio);
                a.appendChild(div);
              });
              a.addEventListener("mouseleave", (ev) => {
                a.querySelector(".audio-preview")?.classList?.remove("visible");
              });
            },
          );
        });
      }
    });

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
    editor.replaceHttpUrlsWithLinks = FEATURE_FLAGS.TRANSFORM_HTTP_URL_TEXT_TO_LINKS;
    editor.tabSize = 2;
    setFocusEditor(editor);
    return () => {
      if (
        typeof container !== "undefined" &&
        container.contains(_editorElement)
      ) {
        container.removeChild(_editorElement);
      }
      refEditor.current?.destroy();
    };
  }, []);

  return (
    <focus-editor
      class={[
        indentHeadings ? "indent-headings" : "",
        focusMode ? "highlight-current-paragraph" : "",
        fullWithEditor ? "full-width-editor" : "",
      ]
        .filter((v) => !!v)
        .join(" ")}
      image-preview={previewImages ? "*" : null}
    >
      <div ref={refEditor} onInput={handleInput}></div>
    </focus-editor>
  );
}
