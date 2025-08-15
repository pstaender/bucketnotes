import * as s3 from "../s3";
import { sha1 } from "../helper";

/**
 *
 * @param {DataTransferItem} transferItem
 * @param {File} file
 */
export function uploadImage(transferItem, filename, fileExtension, onFinishedCallback) {
  const f = transferItem.getAsFile();
  const reader = new FileReader();
  reader.onload = async (event) => {
    const arrayBuffer = event.target.result;
    if (fileExtension) {
      let hash = await sha1(arrayBuffer);
      hash = hash.substring(0, 20); // shorten to 20 characters
      filename = `images/${hash}.${fileExtension}`;
    } else {
      filename = `images/${filename}`;
    }
    await s3.uploadBinaryFile(filename, arrayBuffer, transferItem.type);
    onFinishedCallback({ filename });
  };
  reader.readAsArrayBuffer(f);
}
