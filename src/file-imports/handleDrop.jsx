import { convertPDFToText } from "./pdf";
import { OCRImage, tesseractLanguageCodes } from "./ocr";
import TurndownService from "turndown";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  document.getElementById("pdfjs-worker-url")?.src ||
  document.querySelector(`link[href^="/assets/pdfjs"]`)?.href ||
  "/pdf.worker.mjs";

const tesseractWorkerURL = document.getElementById("tesseract-worker-url")?.src ||
document.querySelector(`link[href^="/assets/tesseract"]`)?.href ||
"/tesseract/tesseract-worker.mjs";

export function handleDrop(
  ev,
  {
    setInitialText,
    text,
    setText,
    updateStatusText,
    setReadonly,
    activeElementIndex,
  },
) {
  function applyText(newText) {
    let active =
      ev.target.closest(".content-holder")?.querySelector(".cursor-inside") ||
      ev.target.closest(".content-holder")?.querySelector(".active");
    if (active) {
      active.innerText = (active.innerText + "\n" + newText).trim();
    } else {
      console.warn("No active element found, appending text");
      setInitialText((text += "\n" + newText));
      setText((text += "\n" + newText));
    }
    setReadonly(false);
  }

  ev.preventDefault();
  if (ev.dataTransfer.items) {
    [...ev.dataTransfer.items].forEach((item, i) => {
      if (item.kind !== "file") {
        updateStatusText("Unsupported item type: " + item.kind);
        return;
      }
      console.debug(item.type);
      if (item.type.match(/^image\/.+/i)) {
        let lang = "";

        while (lang === "") {
          lang = prompt(`What language?`, "eng");
          if (lang && tesseractLanguageCodes.indexOf(lang) === -1) {
            lang = "";
            alert(
              `Invalid language code: ${lang}\n\nAvailable languages:\n${tesseractLanguageCodes.join(
                ", ",
              )}`,
            );
          }
        }

        if (!lang) {
          return;
        }

        updateStatusText("Starting OCR");
        setReadonly(true);
        let file = item.getAsFile();
        setTimeout(async () => {
          try {
            await OCRImage(
              {
                workerURL: tesseractWorkerURL,
                file,
                lang,
              },
              (text) => applyText(text),
            );
          } catch (e) {
            console.error(e);
            setReadonly(false);
            updateStatusText("OCR failed: " + e.message);
          }
        }, 1);
        return;
      }
      if (item.type.match(/^application\/pdf/i)) {
        (async () => {
          convertPDFToText({ dataTransferItem: item }, (text) => {
            applyText(text);
          });
        })();
        return;
      }
      if (item.type.match(/text\/html/i)) {
        (async () => {
          const f = item.getAsFile();
          let html = await f.text();
          html = new DOMParser().parseFromString(html, "text/html");
          html.querySelectorAll("a[href]").forEach((a) => {
            a.innerText = a.innerText.trim();
            !a.innerText.trim() ? a.remove() : null;
          });
          html
            .querySelectorAll("img, iframe, style, script, video, audio")
            .forEach((img) => img.remove());
          let turndownService = new TurndownService({
            headingStyle: "atx",
            codeBlockStyle: "fenced",
            hr: "---",
          });
          let markdown = turndownService.turndown(
            html.querySelector("body").outerHTML,
          );
          let _text = markdown
            .split("\n")
            .map((l) => l.replace(/\s$/, ""))
            .join("\n");

          applyText(_text);
        })();
        return;
      }
      if (item.type.match(/text\/.+/)) {
        const f = item.getAsFile();
        applyText("");
        // make this async, so that react updates "is loading" notification
        setTimeout(() => {
          f.text().then((text) => applyText(text));
        }, 10);
        return;
      }
      updateStatusText(`Unsupported file type: ${item.type}`);
    });
  }
}
