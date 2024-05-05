import { FocusEditor } from "./editor/FocusEditor";
import TurndownService from "turndown";
import * as examples from "./examples.json";
import { useEffect, useRef, useState } from "react";

export function DemoApp({
  localStorage,
  placeholder,
  indentHeadings,
  readonly,
  identifier,
  maxTextLength
} = {}) {
  const [initialTextForEditor, setInitialTextForEditor] = useState(
    localStorage.getItem(`${identifier}-text`)
  );
  const [hash, setHash] = useState(window.location.hash);
  const [isLoading, setIsLoading] = useState(null);
  const refEditor = useRef();

  // 800.000 - 1.500.000 seems to work on faster machines with enough memory… but loading takes ~ 10secs
  // const maxTextLength = 200000;

  if (!identifier) {
    identifier = "focus-editor";
  }

  window.addEventListener("hashchange", (event) => {
    setHash(window.location.hash);
  });

  function handleDrop(ev) {
    ev.preventDefault();
    if (ev.dataTransfer.items) {
      [...ev.dataTransfer.items].forEach((item, i) => {
        if (
          item.kind === "file" &&
          item.type.match(/^text\//i)
        ) {
          const f = item.getAsFile();
          setIsLoading(true);
          setInitialTextForEditor("");
          // make this async, so that react updates "is loading" notification
          setTimeout(() => {
            f.text().then((text) => {
              if (text.length > maxTextLength) {
                text = text.substring(0, maxTextLength + 1);
              }
              text = text.replace(/\t/g, "    ");
              setInitialTextForEditor(text);
              setIsLoading(false);
            });
          }, 10);
        } else {
          console.warn(`Unsupported file type: ${item.type}`);
        }
      });
    }
  }

  useEffect(() => {
    let text = window.location.hash
      ? examples[window.location.hash.substring(1)]
      : null;

    if (!text) {
      text = localStorage.getItem(`${identifier}-text`);
    }

    setInitialTextForEditor(text);
  }, [hash]);

  return (
    <div onDrop={handleDrop} className="drop-wrapper">
      {isLoading && (
        <div className="file-is-loading">File is loading - please stand by</div>
      )}
      <FocusEditor
        initialText={initialTextForEditor}
        maxTextLength={maxTextLength}
        forcePlainText={true}
        guessNextLinePrefixOnEnter={true}
        scrollWindowToCenterCaret={true}
        placeholder={placeholder}
        localStorage={localStorage}
        indentHeadings={indentHeadings}
        startWithCaretAtEnd={true}
        preventUnfocusViaTabKey={true}
        initialCaretPosition={localStorage.getItem(
          `${identifier}-caretPosition`
        )}
        onChange={({ text, activeElementIndex, caretPosition }) => {
          if (text !== undefined) {
            localStorage.setItem(
              `${identifier}-text`,
              text.replace(/\s+$/, "")
            );
          }
          if (caretPosition >= 0) {
            localStorage.setItem(`${identifier}-caretPosition`, caretPosition);
          }
        }}
        trimPastedText={false}
        readOnly={readonly}
        forwardRef={refEditor}
      ></FocusEditor>
    </div>
  );
}
