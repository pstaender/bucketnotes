import {
  ListObjectVersionsCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  GetBucketVersioningCommand,
  DeleteObjectsCommand,
  GetBucketCorsCommand
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// this is just for simulating offline mode in development
const forceOffline = false;
let s3Client = null;
let bucketName = null;


export async function listFileVersions(fileName) {
  const params = { Bucket: bucketName, Prefix: fileName };
  const response = await s3Client.send(new ListObjectVersionsCommand(params));
  return response.Versions;
}

export async function setS3Client(_s3Client) {
  s3Client = _s3Client;
}

export async function setBucketName(_bucketName) {
  bucketName = _bucketName;
}

export async function getFile(key) {
  if (forceOffline) {
    throw new Error("Offline mode");
  }
  let maxFileSize = 1024 * 1024 * 1; // 1 MB
  const { ContentType, ContentLength } = await s3Client.send(
    new HeadObjectCommand({
      Bucket: bucketName,
      Key: key
    })
  );
  if (ContentLength > maxFileSize) {
    return {
      error: `File is too large (${Math.round(
        ContentLength / 1024 / 1024
      )} MB)`,
      content: null,
      file: null
    };
  }
  if (
    !ContentType.startsWith("text") &&
    ContentType !== "application/octet-stream"
  ) {
    return {
      error: `Not a text file (${ContentType})`,
      content: null,
      file: null
    };
  }

  let command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key
  });
  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  let result = await (await fetch(signedUrl)).text();
  return { content: result, file: null, error: null };

  /*
  // this brings problems with being cached in the browser
  const file = await s3Client.send(command);
  const { Body } = file;
  const reader = Body.getReader();
  let decoder = new TextDecoder("utf-8");
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    result += decoder.decode(value, { stream: true });
  }
  file.Key = key;
  */
  // return { content: result, file, error: null };
}

export async function createFile(fileName, content) {
  if (forceOffline) {
    throw new Error("Offline mode");
  }
  let file = null;
  try {
    await getFile(fileName, bucketName, s3Client);
    return { file, error: "File already exists. Choose another filename" };
  } catch (err) {
    if (err?.name !== "NotFound") {
      throw err;
    }
    // file not found (i.e. does not exists), evertyhing is fine :)
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: new Blob([content], { type: "text/plain" }),
      ContentType: "text/plain"
    });
    await s3Client.send(command);
    return { file, error: null };
  }
}

// loadS3Files
export async function loadFiles(
  { Prefix, Delimiter, MaxKeys } = {}
) {
  if (forceOffline) {
    throw new Error("Offline mode");
  }
  // https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: Prefix || "",
    Delimiter: Delimiter || "", // use "/" for top-level only
    MaxKeys
  });
  let isTruncated = true;
  let files = [];

  while (isTruncated) {
    const { Contents, IsTruncated, NextContinuationToken } =
      await s3Client.send(command);
    isTruncated = IsTruncated;
    command.input.ContinuationToken = NextContinuationToken;
    files = files.concat(Contents);
  }

  return files;
}

export async function listFiles(props = {}) {
  if (forceOffline) {
    throw new Error("Offline mode");
  }
  if (!bucketName) {
    console.warn("No bucket name provided");
    return { files: [], commonPrefixes: [] };
  }
  if (!s3Client) {
    console.warn("No s3client provided");
    return { files: [], commonPrefixes: [] };
  }
  props = {
    ...{
      Bucket: bucketName
    },
    ...(props || {})
  };

  const command = new ListObjectsV2Command(props);
  let isTruncated = true;
  let files = [];
  let commonPrefixes = [];

  while (isTruncated) {
    const { Contents, IsTruncated, NextContinuationToken, CommonPrefixes } =
      await s3Client.send(command);
    isTruncated = IsTruncated;
    command.input.ContinuationToken = NextContinuationToken;
    files = files.concat(Contents);
    commonPrefixes = commonPrefixes.concat(CommonPrefixes);
  }

  return {
    files,
    commonPrefixes
  };
}

export async function updateTextFile(fileName, text) {
  if (forceOffline) {
    throw new Error("Offline mode");
  }
  return await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: new Blob([text], { type: "text/plain" }), // Convert string to Readable stream,
      ContentType: "text/plain"
    })
  );
}

export async function renameFile(oldKeyName, newKeyName) {
  if (forceOffline) {
    throw new Error("Offline mode");
  }
  // Copy object with new key name
  const copyParams = {
    Bucket: bucketName,
    // encodedURIComponent is necessary to handle special characters in the key name (see https://github.com/aws/aws-sdk-js-v3/issues/1896)
    CopySource: encodeURIComponent(`${bucketName}/${oldKeyName}`),
    Key: newKeyName
  };
  const copyCommand = new CopyObjectCommand(copyParams);
  await s3Client.send(copyCommand);

  // Delete original object
  const deleteParams = {
    Bucket: bucketName,
    Key: oldKeyName
  };
  const deleteCommand = new DeleteObjectCommand(deleteParams);
  await s3Client.send(deleteCommand);

  return { fileName: newKeyName };
}

export async function isBucketVersioningEnabled() {
  if (forceOffline) {
    throw new Error("Offline mode");
  }
  const params = { Bucket: bucketName };
  const response = await s3Client.send(new GetBucketVersioningCommand(params));
  // "Enabled", "Suspended", or "NotSet"
  return response.Status === "Enabled";
}

export async function deleteFile(fileName) {
  if (forceOffline) {
    throw new Error("Offline mode");
  }
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: fileName
  });
  return await s3Client.send(command);
}

export async function contentOfVersion(
  fileKey,
  versionId
) {
  if (forceOffline) {
    throw new Error("Offline mode");
  }
  const params = {
    Bucket: bucketName,
    Key: fileKey,
    VersionId: versionId
  };

  // Helper function to convert stream to string
  // const streamToString = (stream) => {
  //     return new Promise((resolve, reject) => {
  //         const chunks = [];
  //         resolve(Buffer.concat(chunks).toString('utf8'))
  //         // stream.on('data', (chunk) => chunks.push(chunk));
  //         // stream.on('error', reject);
  //         // stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  //     });
  // };

  const response = await s3Client.send(new GetObjectCommand(params));

  const { Body } = response;
  const reader = Body.getReader();
  let decoder = new TextDecoder("utf-8");
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    result += decoder.decode(value, { stream: true });
  }

  return result;
}

export async function deleteFolder(
  folderPath,
  deleteAllFiles = false
) {
  // List objects within the folder
  const listParams = {
    Bucket: bucketName,
    Prefix: folderPath
  };

  const listObjectsResponse = await s3Client.send(
    new ListObjectsV2Command(listParams)
  );

  // Extract keys of objects within the folder
  const objectsToDelete = listObjectsResponse.Contents.map((object) => ({
    Key: object.Key
  }));

  if (objectsToDelete.length > 0 && !deleteAllFiles) {
    throw Error(`Folder still contains files`);
  }

  if (objectsToDelete.length > 0) {
    // Delete objects within the folder
    const deleteObjectsParams = {
      Bucket: bucketName,
      Delete: { Objects: objectsToDelete }
    };
    await s3Client.send(new DeleteObjectsCommand(deleteObjectsParams));
    console.debug(`Deleting all ${objectsToDelete.length} files`);
  }

  console.debug(`Deleting folder '${folderPath}'`);

  // Delete the folder itself (empty folder deletion)
  return await s3Client.send(
    new DeleteObjectsCommand({ Bucket: bucketName, Key: folderPath })
  );
}

export async function corsRules() {
    // Create a GetBucketCorsCommand with the bucket name
    const command = new GetBucketCorsCommand({ Bucket: bucketName });
    // Execute the command
    const response = await s3Client.send(command);
    return response.CORSRules;
}
