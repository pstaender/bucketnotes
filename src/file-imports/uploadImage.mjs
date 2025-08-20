import FEATURE_FLAGS from "../featureFlags.json" with { type: "json" };

import * as s3 from "../s3";
import { sha1 } from "../helper";
import slugify from "slugify";

/**
 *
 * @param {DataTransferItem} transferItem
 * @param {File} file
 */
export function uploadImage(transferItem, filename, fileExtension, onFinishedCallback) {
  const f = transferItem.getAsFile();
  const reader = new FileReader();
  // was before: `images/`, remove beginning slashes to ensure correct path
  const imageFolder = FEATURE_FLAGS.IMAGE_UPLOAD_PATH.replace(/^\/*/, '');
  reader.onload = async (event) => {
    const arrayBuffer = event.target.result;
    if (fileExtension) {
      let slugifiedFilename = slugify(filename.replace(/\.[^.]+$/, ''));
      let hash = await sha1(arrayBuffer);
      hash = hash.substring(0, 6);
      filename = `${imageFolder}/${hash}_${slugifiedFilename}.${fileExtension}`;
    } else {
      filename = `${imageFolder}/${slugify(filename)}`;
    }
    await s3.uploadBinaryFile(filename, arrayBuffer, transferItem.type);
    onFinishedCallback({ filename });
  };
  reader.readAsArrayBuffer(f);
}
