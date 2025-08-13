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
    if (focusEditor && placeholder) {
      focusEditor.placeholder = placeholder;
    }
  }, [focusEditor, placeholder]);

  useEffect(() => {
    if (!refEditor.current) {
      return;
    }
    const editor = new FocusEditorCore(refEditor.current/*/, {
      placeholder,
      initialText: initialTextForEditor,
      indentHeadings,
      textarea,
      onChange,
      readOnly,
      focusMode,
      keyboardShortcuts,
      maxTextLength,
      doGuessNextListItemLine,
      showNumberOfParagraphs,
      // initialCaretPosition,
      initialParagraphNumber,
      renderAllContent,
      scrollWindowToCenterCaret,
      previewImages
    } */);

    if (initialText) {
      editor.replaceText(initialText);
    }
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
      .join(" ")}>
      <div ref={refEditor} onInput={handleInput}></div>
    </focus-editor>
  );
}
