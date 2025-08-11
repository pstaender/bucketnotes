import FocusEditorCore from "../focus-editor/FocusEditorCore.mjs";
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
  initialParagraphNumber,
  renderAllContent,
  scrollWindowToCenterCaret,
  previewImages,
} = {}) {
  const containerRef = useRef(null);
    const editorInstanceRef = useRef(null);
    const [editor, setEditor] = useState(null);
    const [editorElement, setEditorElement] = useState(null);

    const handleChange = (ev) => {
      if (onChange && editorInstanceRef.current) {
        onChange(editorInstanceRef.current.textContent, {});
      }
    };

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      // Create the web component element
      const div = document.createElement('div');
      const _editorElement = document.createElement('focus-editor');
      _editorElement.append(div);

      if (indentHeadings) {
        _editorElement.classList.add('indent-headings');
      }

      // Set attributes
      if (placeholder) _editorElement.setAttribute('placeholder', placeholder);
      if (readOnly) _editorElement.setAttribute('readonly', 'true');

      setEditor(new FocusEditorCore(div, initialText));

      // Append to container
      container.appendChild(_editorElement);
      _editorElement.addEventListener('input', handleChange);
      editorInstanceRef.current = _editorElement;

      setEditorElement(_editorElement);

      // Cleanup
      return () => {
        if (container.contains(_editorElement)) {
          container.removeChild(_editorElement);
        }
        editorInstanceRef.current = null;
      };
    }, []);

    useEffect(() => {
      if (!editor) {
        return;
      };
      editor.replaceText(initialText);
    }, [editor, initialText]);

    // Update attributes when props change
    useEffect(() => {
      const editor = editorInstanceRef.current;
      if (!editor) return;

      if (placeholder !== undefined) {
        editor.setAttribute('placeholder', placeholder || '');
      }
    }, [placeholder]);

    useEffect(() => {
      const editor = editorInstanceRef.current;
      if (!editor) return;

      editor.setAttribute('readonly', readOnly ? 'true' : 'false');
    }, [readOnly]);

    // Expose methods
    const getValue = () => editorInstanceRef.current?.value || '';
    const setValue = (text) => {
      if (editorInstanceRef.current) {
        editorInstanceRef.current.value = text;
      }
    };

    return (
      <span
        ref={containerRef}
      />
    );
}
