import FocusEditorCore from "../focus-editor/FocusEditorCore.mjs";
import { useEffect, useRef, useState } from "react";

export function EditorWrapper({
  placeholder,
  initialText,
  indentHeadings,
  onChange,
  readOnly,
  focusMode,
  doGuessNextListItemLine,
  showNumberOfParagraphs,
  initialParagraphNumber,
  renderAllContent,
  scrollWindowToCenterCaret,
  previewImages,
} = {}) {
  const refEditor = useRef();
  const [focusEditor, setFocusEditor] = useState(null);

  const handleInput = (event) => {
    onChange(focusEditor.getMarkdown(), {});
  };

  useEffect(() => {
    if (initialText !== null && initialText !== undefined && focusEditor) {
      focusEditor.replaceText(initialText);
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
    const editor = new FocusEditorCore(refEditor.current);

    if (initialText) {
      editor.replaceText(initialText);
    }
    editor.tabSize = 2;
    setFocusEditor(editor);
    return () => {
      if (container.contains(_editorElement)) {
                container.removeChild(_editorElement);
              }
              editorInstanceRef.current = null;
      refEditor.current.destroy();
    };
  }, []);

  return (
    <focus-editor class={[indentHeadings ? "indent-headings" : '']
      .filter((v) => !!v)
      .join(" ")} image-preview={previewImages ? '*' : null}>
      <div ref={refEditor} onInput={handleInput}></div>
    </focus-editor>
  );
}
