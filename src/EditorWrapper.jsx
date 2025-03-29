import { FocusEditor } from "../focuseditor/editor/FocusEditor";
import { useEffect, useRef, useState } from "react";

export function EditorWrapper({
  placeholder,
  initialText,
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
  previewImages,
} = {}) {
  const [initialTextForEditor, setInitialTextForEditor] = useState("");
  const refEditor = useRef();

  useEffect(() => {
    setInitialTextForEditor(initialText);
  }, [initialText]);

  return (
    <FocusEditor
      initialText={initialTextForEditor}
      maxTextLength={maxTextLength}
      forcePlainText={true}
      scrollWindowToCenterCaret={Boolean(scrollWindowToCenterCaret)}
      placeholder={placeholder}
      indentHeadings={indentHeadings}
      startWithCaretAtEnd={true}
      preventUnfocusViaTabKey={true}
      useTextarea={textarea}
      onChange={onChange}
      trimPastedText={false}
      onBeforePaste={(text) => text?.trim()}
      forwardRef={refEditor}
      readOnly={readOnly}
      focusMode={focusMode}
      keyboardShortcuts={keyboardShortcuts}
      guessNextLinePrefixOnEnter={doGuessNextListItemLine}
      showNumberOfParagraphs={showNumberOfParagraphs}
      // initialCaretPosition={initialCaretPosition}
      initialActiveElementIndex={initialParagraphNumber}
      renderAllContent={renderAllContent}
      showPictureOnImageHover={previewImages}
    ></FocusEditor>
  );
}
