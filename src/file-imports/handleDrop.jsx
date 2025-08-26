import FEATURE_FLAGS from "../featureFlags.json" with { type: "json" };

import { extractTextFromPDF } from "./pdf";
import { uploadFile } from "./uploadFile";

import slugify from "slugify";
import { unslugify, createTurndownService } from "../helper";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  document.getElementById("pdfjs-worker-url")?.src ||
  document.querySelector(`link[href^="/assets/pdfjs"]`)?.href ||
  "/pdf.worker.mjs";

export function handleDrop(
  ev,
  {
    setInitialText,
    text,
    setText,
    updateStatusText,
    setReadonly,
    focusEditor,
    convertPDFToText,
  },
) {
  function insertText(text) {
    if (document.queryCommandSupported("insertText")) {
      document.execCommand("insertText", false, text);
    } else {
      let active =
        ev.target.closest(".main").querySelector(".block.with-caret") ||
        ev.target.closest(".main").querySelector(".block:last-child");
      active.textContent = (active.textContent + " " + text).trim();
    }
  }

  function applyText(newText) {
    let active =
      ev.target.closest(".main")?.querySelector(".block.with-caret") ||
      ev.target.closest(".main")?.querySelector(".block:last-child");
    if (active) {
      active.textContent = (active.textContent + "\n" + newText).trim();
      setText(active.textContent);
    } else {
      console.warn("No active element found, appending text");
      setInitialText((text += "\n" + newText));
      setText((text += "\n" + newText));
    }
    focusEditor.fullRefresh();
    setReadonly(false);
  }

  ev.preventDefault();

  /* https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/MIME_types/Common_types  */

  if (ev.dataTransfer.items) {
    [...ev.dataTransfer.items].forEach((item, i) => {
      if (item.kind !== "file") {
        updateStatusText("Unsupported item type: " + item.kind);
        return;
      }
      const uploadFilename = slugify(ev.dataTransfer.files[i].name);
      const fileExtension = item.type.split("/")[1];
      if (item.type.match(/^image\/.+/i)) {
        uploadFile(
          item,
          uploadFilename,
          fileExtension,
          FEATURE_FLAGS.IMAGE_UPLOAD_PATH,
          ({ filename, error }) => {
            if (error) {
              insertText("Error: Could not upload file: ${error.message}");
              updateStatusText(`Could not upload file, offline?`);
              return;
            }
            const text = unslugify(uploadFilename).replace(/\.[^.]+$/, "");
            insertText(`![${text || "Image"}](${filename})`);
            focusEditor.refresh();
          },
        );

        return;
      }
      if (item.type.match(/^application\/pdf/i)) {
        if (convertPDFToText) {
          (async () => {
            updateStatusText("Extracting text from PDF…");
            extractTextFromPDF({ dataTransferItem: item }, (text) => {
              applyText(text);
            });
          })();
        } else {
          updateStatusText("Uploading file, please wait…", 0);
          uploadFile(
            item,
            uploadFilename,
            fileExtension,
            FEATURE_FLAGS.PDF_UPLOAD_PATH,
            ({ filename, error }) => {
              if (error) {
                insertText(`\`Error: Could not upload file: ${error.message}\``);
                updateStatusText(`Could not upload file, offline?`);
                return;
              } else {
                insertText(`[${unslugify(uploadFilename)}](${filename})`);
                focusEditor.refresh();
                updateStatusText("Uploading finished");
              }
            },
          );
        }
        return;
      }

      if (
        item.type.match(
          /^(application\/zip|application\/x-7z-compressed|application\/x-zip-compressed|application\/x-tar|application\/vnd.rar|application\/gzip|application\/x-gzip|application\/epub\+zip|application\/x-7z-compressed)/i,
        )
      ) {
        updateStatusText("Uploading archive file, please wait…", 0);
        uploadFile(
          item,
          uploadFilename,
          fileExtension,
          FEATURE_FLAGS.ARCHIVE_UPLOAD_PATH,
          ({ filename, error }) => {
            if (error) {
              insertText(`\`Error: Could not upload file: ${error.message}\``);
              updateStatusText(`Could not upload file, offline?`);
              return;
            } else {
              insertText(`[${unslugify(uploadFilename)}](${filename})`);
              focusEditor.refresh();
              updateStatusText("Uploading finished");
            }
          },
        );
        return;
      }

      if (FEATURE_FLAGS.VIDEO_UPLOAD_PATH && item.type.match(/^video\//i)) {
        updateStatusText("Uploading video file, please wait…", 0);
        uploadFile(
          item,
          uploadFilename,
          fileExtension,
          FEATURE_FLAGS.VIDEO_UPLOAD_PATH,
          ({ filename, error }) => {
            if (error) {
              insertText(`\`Error: Could not upload file: ${error.message}\``);
              updateStatusText(`Could not upload file, offline?`);
              return;
            } else {
              insertText(`[${unslugify(uploadFilename)}](${filename})`);
              focusEditor.refresh();
              updateStatusText("Uploading finished");
            }
          },
        );
        return;
      }

      if (FEATURE_FLAGS.AUDIO_UPLOAD_PATH && item.type.match(/^audio\//i)) {
        updateStatusText("Uploading audio file, please wait…", 0);
        uploadFile(
          item,
          uploadFilename,
          fileExtension,
          FEATURE_FLAGS.AUDIO_UPLOAD_PATH,
          ({ filename, error }) => {
            if (error) {
              insertText(`\`Error: Could not upload file: ${error.message}\``);
              updateStatusText(`Could not upload file, offline?`);
              return;
            } else {
              insertText(`[${unslugify(uploadFilename)}](${filename})`);
              focusEditor.refresh();
              updateStatusText("Uploading finished");
            }
          },
        );
        return;
      }

      if (item.type.match(/text\/html/i)) {
        (async () => {
          updateStatusText("Converting HTML to Markdown…");
          const f = item.getAsFile();
          let html = await f.text();
          html = new DOMParser().parseFromString(html, "text/html");
          html.querySelectorAll("a[href]").forEach((a) => {
            a.innerText = a.innerText.trim();
            !a.innerText.trim() ? a.remove() : null;
          });
          html
            .querySelectorAll("iframe, style, script, video, audio")
            .forEach((img) => img.remove());
          html.querySelectorAll("title").forEach((el) => {
            let h1 = document.createElement("h1");
            if (!el.innerText) {
              return;
            }
            h1.innerText = el.innerText.trim();
            el.replaceWith(h1);
          });
          const turndownService = createTurndownService();
          const markdown = turndownService.turndown(
            html.querySelector("html")
              ? html.querySelector("html").innerHTML
              : html.documentElement.innerHTML,
          );

          applyText(
            markdown
              .split("\n")
              .map((l) => l.replace(/\s$/, ""))
              .join("\n"),
          );
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
