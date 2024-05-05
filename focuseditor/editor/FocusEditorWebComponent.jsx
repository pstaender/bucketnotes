import React from "react";
import r2wc from "@r2wc/react-to-web-component";
import { FocusEditor } from "./FocusEditor";

export function FocusEditorWebComponent(props) {
  let { value, id, localStorage, placeholder, readonly, focusMode, indentHeadings, maxlength } = props;

  if (!value && props.container?.innerText?.trim()) {
    let html = (
      props.container.querySelector("pre") || props.container
    ).innerHTML
      .replace("\n", "<br>")
      .trim();
    let doc = new DOMParser().parseFromString(html, "text/html");
    value = doc.documentElement.textContent;
  }

  return (
    <FocusEditor
      initialText={value}
      useTextarea={window.navigator.maxTouchPoints > 1}
      forcePlainText={true}
      identifier={id}
      localStorage={localStorage ? window.localStorage : null}
      placeholder={placeholder}
      readOnly={Boolean(readonly || readonly === "")}
      focusMode={focusMode || focusMode === ""}
      indentHeadings={indentHeadings || indentHeadings === ""}
      maxTextLength={maxlength === undefined ? 100000 : Number(maxlength)}
    ></FocusEditor>
  );
}

export default function defineFocusEditorWebComponent(props) {
  const FocusEditorComponent = r2wc(FocusEditorWebComponent, {
    /* Shadow DOM not yet supported :/ */
    // shadow: "open",
    props: {
      value: "string",
      id: "string",
      localStorage: "object",
      placeholder: "string",
      readonly: "string",
      focusMode: "string",
      indentHeadings: "string",
      maxlength: "string"
    }
  });
  customElements.define("focus-editor", FocusEditorComponent);
  return FocusEditorComponent;
}
