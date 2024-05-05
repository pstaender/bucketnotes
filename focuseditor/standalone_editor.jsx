import { createRoot } from "react-dom/client";
import { DemoApp } from "./DemoApp";

const container = document.getElementById("focus-editor");
const root = createRoot(container);
root.render(
  <focus-editor>
    <DemoApp
      localStorage={window.localStorage}
      indentHeadings={true}
      identifier="focus-editor"
      placeholder={"Write something - or drop a text or markdown file here"}
    />
  </focus-editor>
);

