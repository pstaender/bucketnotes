import FEATURE_FLAGS from "../featureFlags.json" with { type: "json" };

import { uploadFile } from "./uploadFile";

import slugify from "slugify";
import { unslugify } from "../helper";

const ARCHIVE_TYPE =
  /^(application\/zip|application\/x-7z-compressed|application\/x-zip-compressed|application\/x-tar|application\/vnd.rar|application\/gzip|application\/x-gzip|application\/epub\+zip)/i;

// Maps a file's MIME type onto the assets sub-path it should be uploaded to,
// mirroring the routing already done for drag-and-dropped files in handleDrop.
function uploadPathForType(type) {
  if (/^image\//i.test(type)) {
    return FEATURE_FLAGS.IMAGE_UPLOAD_PATH;
  }
  if (/^application\/pdf/i.test(type)) {
    return FEATURE_FLAGS.PDF_UPLOAD_PATH;
  }
  if (FEATURE_FLAGS.VIDEO_UPLOAD_PATH && /^video\//i.test(type)) {
    return FEATURE_FLAGS.VIDEO_UPLOAD_PATH;
  }
  if (FEATURE_FLAGS.AUDIO_UPLOAD_PATH && /^audio\//i.test(type)) {
    return FEATURE_FLAGS.AUDIO_UPLOAD_PATH;
  }
  if (ARCHIVE_TYPE.test(type)) {
    return FEATURE_FLAGS.ARCHIVE_UPLOAD_PATH;
  }
  return FEATURE_FLAGS.DOCUMENT_UPLOAD_PATH || FEATURE_FLAGS.ASSETS_BASE_PATH;
}

// The `accept` attribute for the file picker: images, documents, PDFs, audio,
// video and (zip) archives.
export const INSERT_MEDIA_FILE_ACCEPT = [
  "image/*",
  "audio/*",
  "video/*",
  "application/pdf",
  ".doc,.docx,.odt,.rtf,.txt,.md,.markdown,.csv,.tsv",
  ".xls,.xlsx,.ods,.ppt,.pptx,.odp",
  ".zip,.7z,.tar,.gz,.tgz,.rar,.epub",
].join(",");

// Opens a native file-open dialog and, once a file is chosen, uploads it to
// the assets bucket (same mechanism as dropped images/PDFs/…) and inserts a
// Markdown link/image to it at the current caret position in `focusEditor`.
export function pickAndInsertMediaFile({ updateStatusText, focusEditor }) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = INSERT_MEDIA_FILE_ACCEPT;
  input.style.display = "none";
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    input.remove();
    if (!file) {
      return;
    }
    insertMediaFile(file, { updateStatusText, focusEditor });
  });
  document.body.appendChild(input);
  input.click();
}

export function insertMediaFile(file, { updateStatusText, focusEditor }) {
  if (!focusEditor) {
    updateStatusText("No editor to insert into");
    return;
  }

  const uploadFilename = slugify(file.name);
  const fileExtension =
    file.name.split(".").pop() || file.type.split("/")[1] || "";
  const uploadPath = uploadPathForType(file.type);
  const isImage = /^image\//i.test(file.type);

  // uploadFile() works off a DataTransferItem-like object (a `type` string and
  // a `getAsFile()`), which a plain File from an <input> isn't — so wrap it.
  const transferItem = { type: file.type, getAsFile: () => file };

  updateStatusText("Uploading file, please wait…", 0);
  uploadFile(
    transferItem,
    uploadFilename,
    fileExtension,
    uploadPath,
    ({ filename, error }) => {
      if (error) {
        focusEditor.insertText(
          `\`Error: Could not upload file: ${error.message}\``,
        );
        updateStatusText("Could not upload file, offline?");
        return;
      }
      const label =
        unslugify(uploadFilename).replace(/\.[^.]+$/, "") ||
        (isImage ? "Image" : "File");
      focusEditor.insertText(
        isImage ? `![${label}](${filename})` : `[${label}](${filename})`,
      );
      focusEditor.refresh();
      updateStatusText("Uploading finished");
    },
  );
}
