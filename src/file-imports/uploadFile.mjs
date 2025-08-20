import * as s3 from "../s3";
import { sha1 } from "../helper";
import slugify from "slugify";

/**
 *
 * @param {DataTransferItem} transferItem
 * @param {File} file
 */
export function uploadFile(transferItem, filename, fileExtension, finalPath, onFinishedCallback) {
  const f = transferItem.getAsFile();
  const reader = new FileReader();
  reader.onload = async (event) => {
    const arrayBuffer = event.target.result;
    if (fileExtension) {
      let slugifiedFilename = slugify(filename.replace(/\.[^.]+$/, ''));
      let hash = await sha1(arrayBuffer);
      hash = hash.substring(0, 6);
      filename = `${finalPath.replace(/^\//, '')}/${slugifiedFilename}_${hash}.${fileExtension}`;
    } else {
      filename = `${finalPath.replace(/^\//, '')}_${hash}/${slugify(filename)}`;
    }
    console.log(filename, arrayBuffer, transferItem.type);
    await s3.uploadBinaryFile(filename, arrayBuffer, transferItem.type);
    onFinishedCallback({ filename });
  };
  reader.readAsArrayBuffer(f);
}
