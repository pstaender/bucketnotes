import FEATURE_FLAGS from "./featureFlags.json" with { type: "json" };
import moreIcon from "./icons/more.svg";
import "./App.scss";

import { S3Client } from "@aws-sdk/client-s3";
import { useCallback, useEffect, useRef, useState } from "react";
import { Login } from "./Login.jsx";
import { useDebouncedCallback } from "use-debounce";

import { useLocation, useNavigate } from "react-router-dom";

import { EditorWrapper } from "./EditorWrapper.jsx";
import { JumpToFileBar } from "./JumpToFileBar.jsx";

import { useLongPress } from "use-long-press";

import * as s3 from "./s3.js";
import { FileVersions } from "./FileVersions.jsx";
import { handleDrop } from "./file-imports/handleDrop.jsx";
import { FileList } from "./FileList.jsx";
import {
  isTouch,
  VALID_FILE_EXTENSION,
  downloadFileByUrl,
  unifyMarkdownTableCellWidths,
  sortS3FilesByAttribute
} from "./helper.js";
import Cursor from "../focus-editor/Cursor.mjs";
import * as db from "./db.js";
import slugify from "slugify";
import * as encrypt from "./encrypt.js";

const DEFAULT_PLACEHOLDER_TEXT = "Type something…";

// need to be outside of component, used in setTimeout

function slugifyPath(s) {
  return s
    .split("/")
    .map((s) => {
      // replace all non-word characters with _, otherwise we get url encoded characters :(
      return slugify(s, {
        replacement: "_",
        locale: navigator.language.split("-")[0],
      });
    })
    .join("/");
}

export function App({ version, appName } = {}) {
  const defaultShowStatusTextInMilliseconds = 3000;
  const [showStatusTextInMilliseconds, setShowStatusTextInMilliseconds] =
    useState(defaultShowStatusTextInMilliseconds);

  const [credentials, setCredentials] = useState(null);
  const [files, setFiles] = useState(null);
  const [folders, setFolders] = useState(null);

  const [initialText, setInitialText] = useState("");
  const [statusText, setStatusText] = useState("");
  const [statusUpdatedAt, setStatusUpdatedAt] = useState(null);
  const [showSideBar, setShowSideBar] = useState(
    localStorage.getItem("hideSideBar") !== "true",
  );
  const [bucketName, setBucketName] = useState("");
  const [text, setText] = useState("");
  const [s3Client, setS3Client] = useState(null);
  const [loginErrorMessage, setLoginErrorMessage] = useState("");
  const [autoSave, setAutoSave] = useState(
    localStorage.getItem("autoSave") !== "false",
  );
  const [lastSavedText, setLastSavedText] = useState(null);
  const [lastEditedFile, setLastEditedFile] = useState(null);
  const [placeholder, setPlaceholder] = useState(DEFAULT_PLACEHOLDER_TEXT);
  const [readonly, setReadonly] = useState(false);
  const [fileVersions, setFileVersions] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [focusMode, setFocusMode] = useState(
    sessionStorage.getItem("focusMode") === "true",
  );
  const [scrollWindowToCenterCaret, setScrollWindowToCenterCaret] = useState(
    isTouch()
      ? false
      : localStorage.getItem("scrollWindowToCenterCaret") === "true",
  );
  const [createSmartNewLineContent, setCreateSmartNewLineContent] = useState(
    localStorage.getItem("createSmartNewLineContent") !== "false",
  );
  const [colorScheme, setColorScheme] = useState(
    localStorage.getItem("color-scheme"),
  );
  const [fontFamily, setFontFamily] = useState(
    localStorage.getItem("font-family"),
  );
  const [fontSize, setFontSize] = useState(null);
  const [initialCaretPosition, setInitialCaretPosition] = useState(null);
  // TODO: replace location.pathname with folderPath
  const [folderPath, setFolderPath] = useState("");
  const [s3Error, setS3Error] = useState(null);
  const [isPossiblyOffline, setIsPossiblyOffline] = useState(false);
  const [sortFilesByAttribute, setSortFilesByAttribute] = useState(
    localStorage.getItem("sortFilesByAttribute") || "Key",
  );
  const [previewImages, setPreviewImages] = useState(
    localStorage.getItem("previewImages") === "true",
  );
  const [focusEditor, setFocusEditor] = useState(null);
  const [jumpToFile, setJumpToFile] = useState(false);
  const [displayImageUrl, setDisplayImageUrl] = useState(null);
  const [playVideoUrl, setPlayVideoUrl] = useState(null);
  const [playAudioUrl, setPlayAudioUrl] = useState(null);
  const [offlineStorageEnabled, setOfflineStorageEnabled] = useState(
    localStorage.getItem("offlineStorage") === "true",
  );
  const [convertPDFToText, setConvertPDFToText] = useState(
    localStorage.getItem("convertPDFToText") === "true",
  );
  const [convertHTMLToMarkdown, setConvertHTMLToMarkdown] = useState(
    localStorage.getItem("convertHTMLToMarkdown") === "true",
  );
  const [renderMarkdownTables, setRenderMarkdownTables] = useState(
    localStorage.getItem("renderMarkdownTables") === "true",
  );
  const [showAdditionalMenuOption, setShowAdditionalMenuOption] =
    useState(false);
  const [fullWithEditor, setFullWithEditor] = useState(
    localStorage.getItem("fullWithEditor") === "true",
  );
  const [rightTrimTextBeforeSave, setRightTrimTextBeforeSave] = useState(
    localStorage.getItem("rightTrimTextBeforeSave") === "true",
  );
  const [globalKey, setGlobalKey] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();

  const debounced = useDebouncedCallback(
    (value, filename, lastSavedText) => {
      if (
        readonly ||
        !autoSave ||
        lastSavedText === null ||
        value.replace(/\s/g, "") === lastSavedText.replace(/\s/g, "") ||
        text.trim() === ""
      ) {
        // no changes
        return;
      }
      console.debug("Auto-save via debounce");
      saveFile(filename, text, { autoSave: true }).catch((e) =>
        console.error(e),
      );
    },
    // delay in ms
    5000,
  );

  const longPressOnFile = useLongPress((ev, arg) => {
    let fileKey = arg.context;
    if (fileKey) {
      renameFile(fileKey);
    }
  });

  function newNoteName() {
    return slugifyPath(
      `note-${new Date()
        .toISOString()
        .replace(/\.\d.+$/, "")
        .replace(/(\d)T(\d)/, "$1-$2")
        .replace(/\:/g, "-")}.txt`,
    );
  }

  function handleUnload(ev) {
    if (readonly) {
      return;
    }
    if (
      text !== lastSavedText &&
      VALID_FILE_EXTENSION.test(location.pathname)
    ) {
      ev.preventDefault();
      ev.returnValue = true;
    }
  }

  async function upsyncFiles() {
    let keys = await db.fileKeysFromDatabase();
    console.debug("Upsyncing files:", keys);

    for (let key of keys) {
      let file = await db.loadFileFromDatabase(key);
      if (file.fileSavedToS3) {
        continue;
      }
      await saveFile(key, file.content, { autoCreateNewFile: true });
    }
  }

  async function loadS3Files(_bucketName = null) {
    let prefix = folderPath
      .replace(/\/[^\/]+?\.[^\.]+$/, "")
      .replace(/\/+$/, "")
      .replace(/^\//, "");

    let delimiter = !prefix ? "/" : "";

    if (VALID_FILE_EXTENSION.test(prefix)) {
      if (!prefix.includes("/")) {
        delimiter = "/";
        prefix = "";
      }
    }

    let props = {
      Prefix: prefix,
      Delimiter: delimiter,
    };
    let files = [];
    let commonPrefixes = [];
    try {
      setS3Error(null);
      ({ files, commonPrefixes } = await s3.listFiles(props));
    } catch (err) {
      setS3Error(err);
      if (offlineStorageEnabled) {
        files = (await db.fileKeysFromDatabase()).map((f) => {
          return { Key: f, Prefix: null };
        });
      }
    }

    if (
      FEATURE_FLAGS.IMAGE_UPLOAD_PATH.includes(folderPath) ||
      FEATURE_FLAGS.VIDEO_UPLOAD_PATH.includes(folderPath) ||
      FEATURE_FLAGS.AUDIO_UPLOAD_PATH.includes(folderPath) ||
      FEATURE_FLAGS.ARCHIVE_UPLOAD_PATH.includes(folderPath)
    ) {
      /* SHOW ALL FILES AND FOLDER */
    } else {
      files = files.filter((c) => VALID_FILE_EXTENSION.test(c?.Key));
    }

    files = sortS3FilesByAttribute(files, sortFilesByAttribute);

    let folders =
      commonPrefixes.filter((f) => f?.Prefix).map((f) => f.Prefix) || [];

    console.debug(`Loaded file list of ${files.length} files`);
    setFiles(files.map((f) => f.Key));
    setFolders(folders);
  }

  async function loadFile(key) {
    let fileFromDatabase = offlineStorageEnabled
      ? (await db.loadFileFromDatabase(key)) || null
      : null;

    let content = fileFromDatabase?.content || "";
    let error = null;

    try {
      ({ content, error } = await s3.getFile(key));
      setS3Error(null);
      if (error) {
        updateStatusText(error);
        return;
      }
      if (offlineStorageEnabled) {
        db.saveFileToDatabase(key, {
          content,
          bucketName,
          fileSavedToS3: true,
        });
      }
    } catch (err) {
      setS3Error(err);
      if (offlineStorageEnabled) {
        db.saveFileToDatabase(key, {
          content,
          bucketName,
          fileSavedToS3: false,
        });
      }
    }
    updateStatusText(`Loaded '${key}' with ${content.length} characters`);
    if (content !== null && content !== undefined) {
      setText(content);
      setInitialText(content);
      setLastSavedText(content);
      setLastEditedFile(key);
    }
  }

  async function handleDeleteFolder(ev, folderName) {
    if (
      ev.shiftKey &&
      !confirm(`Delete folder '${folderName}' and all it\'s files?`)
    ) {
      return;
    }
    try {
      await s3.deleteFolder(folderName, ev.shiftKey);
      navigate(`/`);
    } catch (e) {
      if (e.message.includes("contains files")) {
        alert(
          "The folder still contains files. Press shift and click delete to force deleting all files in the folder.",
        );
        return;
      } else {
        console.error(e);
      }
      navigate(`/`);
    }
  }

  async function handleClickOnFile(ev, fileKey) {
    if (
      fileKey &&
      (ev.target.classList.contains("delete") || ev.target.alt === "Delete")
    ) {
      if (confirm(`Delete '${fileKey}'?`)) {
        try {
          setS3Error(null);
          await s3.deleteFile(fileKey);
        } catch (err) {
          setS3Error(err);
        }
        if (offlineStorageEnabled) {
          await db.deleteFileFromDatabase(fileKey);
        }
        setText("");
        setInitialText("");
        setLastEditedFile(null);
        setLastSavedText("");
        setFiles(files.filter((f) => f !== fileKey));
        navigate(`/`);
        setReadonly(false);
      }
      return;
    }
    if (text.trim() !== "" && text !== lastSavedText) {
      if (!confirm("Are you sure? File not saved!")) {
        return;
      }
    }
    navigate(`/${fileKey}`);
  }

  async function handleClickOnHistory(ev, fileKey) {
    handleClickOnFile(ev, fileKey);
    if (fileVersions?.length > 0 && fileVersions[0].Key === fileKey) {
      setFileVersions([]);
      return;
    }
    // load file
    let versions = await s3.listFileVersions(fileKey);
    setFileVersions(versions.filter((v) => v.Size > 0));
  }

  function updateStatusText(
    text,
    timeout = defaultShowStatusTextInMilliseconds,
  ) {
    console.debug(text);
    setStatusText(text);
    setShowStatusTextInMilliseconds(timeout);
    setStatusUpdatedAt(new Date().getTime());
  }

  function displayGoToParagraphDialog() {
    let paragraphNumber = prompt("Go to paragraph number");
    let target = focusEditor.target.querySelector(
      `:scope > .block:nth-child(${Number(paragraphNumber)})`,
    );
    if (Number(paragraphNumber) >= 0) {
      if (!target) {
        target = focusEditor.target.querySelector(`:scope > .block:last-child`);
      }
      Cursor.setCurrentCursorPosition(0, target);

      target.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }

  function toggleFullScreen() {
    if (document.fullscreenElement) {
      document
        .exitFullscreen()
        .then(() => console.debug("Document exited from full screen mode"))
        .catch((err) => console.error(err));
    } else {
      console.debug("Document entered full screen mode");
      document.documentElement.requestFullscreen();
    }
  }

  const handleBeforePrint = useCallback((ev) => {
    // do nothing
  });

  useEffect(() => {
    if (fontSize && fontSize >= 0) {
      // set the font size on html
      document.documentElement.style.fontSize = `${fontSize}px`;
    }
  }, [fontSize]);

  useEffect(() => {
    setIsPossiblyOffline(!window.navigator.onLine);
  }, [window.navigator.onLine]);

  useEffect(() => {
    localStorage.setItem("hideSideBar", String(!showSideBar));
  }, [showSideBar]);

  useEffect(() => {
    window.addEventListener("beforeprint", handleBeforePrint);
    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
    };
  }, [handleBeforePrint]);

  const registerGlobalKeyPress = useCallback((e) => {
    setGlobalKey(e.key);
  }, []);
  const registerGlobalKeyUp = useCallback((e) => {
    setGlobalKey(null);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", registerGlobalKeyPress);
    () => window.removeEventListener("keydown", registerGlobalKeyPress);
  }, [registerGlobalKeyPress]);

  useEffect(() => {
    window.addEventListener("keyup", registerGlobalKeyUp);
    () => window.removeEventListener("keydown", registerGlobalKeyUp);
  }, [registerGlobalKeyUp]);

  useEffect(() => {
    if (globalKey === "Escape") {
      setShowMoreOptions(false);
      setShowSideBar(false);
      setJumpToFile(false);
      focusEditor?.target?.focus();
      focusEditor?.target?.click();
      return;
    }
  }, [globalKey]);

  async function handleKeyDown(ev) {
    if ((ev.metaKey || ev.ctrKey) && ev.key === ";") {
      setShowSideBar(!showSideBar);
      ev.preventDefault();
      return;
    }

    if (ev.metaKey || ev.ctrKey) {
      if (ev.key.toLowerCase() === "t") {
        let textWithUnifiedTables = unifyMarkdownTableCellWidths(text);
        if (textWithUnifiedTables !== text) {
          setInitialText(unifyMarkdownTableCellWidths(textWithUnifiedTables));
          setText(unifyMarkdownTableCellWidths(textWithUnifiedTables));
        }
        return;
      }

      if (ev.key.toLowerCase() === "s") {
        if (
          (VALID_FILE_EXTENSION.test(location.pathname) &&
            location.pathname[0] === "/") ||
          location.pathname === "/" ||
          location.pathname === "/new"
        ) {
          ev.preventDefault();
          createOrSaveFile();
          return;
        }
      }
      if (ev.key.toLowerCase() === "b") {
        ev.preventDefault();
        navigate("new");
        setFolderPath("/");
        return;
      }
      if (ev.key === ".") {
        ev.preventDefault();
        setFocusMode(!focusMode);
        return;
      }
      if (ev.key === "/") {
        ev.preventDefault();
        setJumpToFile(!jumpToFile);
        return;
      }
      if (ev.key === "g") {
        ev.preventDefault();
        displayGoToParagraphDialog();
        return;
      }
      if (ev.key === "f" && ev.shiftKey) {
        ev.preventDefault();
        toggleFullScreen();
        return;
      }
    }
  }

  async function saveFile(fileKey, text, { autoCreateNewFile, autoSave } = {}) {
    if (rightTrimTextBeforeSave && focusEditor) {
      //  rtrim manually + carefullyhtml content
      focusEditor.allChildren().forEach((block) => {
        let html = block.innerHTML.replace(/(\s|&nbsp;)+$/, "");
        if (html !== block.innerHTML) {
          block.innerHTML = html;
        }
      });
    }

    if (!fileKey || !VALID_FILE_EXTENSION.test(fileKey)) {
      updateStatusText("No file present to save to");
      if (autoCreateNewFile) {
        let key = newNoteName();
        console.debug("Auto-create new file");
        let fileSavedToS3 = false;
        try {
          setS3Error(null);
          await s3.createFile(key, text);
          fileSavedToS3 = true;
          tryToLoadNewCreatedFileAndUpdateFiles(key);
        } catch (err) {
          setS3Error(err);
        }
        db.saveFileToDatabase(key, {
          content,
          bucketName,
          fileSavedToS3,
        });
      }
      return;
    }
    let previousContent = null;
    try {
      previousContent = (await s3.getFile(fileKey)).content;
      if (previousContent === text) {
        setStatusText("No changes to save");
        return;
      }
    } catch (e) {
      console.error(e);
    }
    let saveOrAutoSave = autoSave ? "Auto-saving" : "Saving";
    updateStatusText(`${saveOrAutoSave} '${fileKey}'`);
    setTimeout(async () => {
      try {
        setS3Error(null);
        await s3.updateTextFile(fileKey, text);
        saveOrAutoSave = autoSave ? "Auto-saved" : "Saved";
        updateStatusText(`${saveOrAutoSave} '${fileKey}'`);
        if (!autoSave) {
          loadS3Files().catch((e) => console.error(e));
        }
      } catch (err) {
        setS3Error(err);
        saveOrAutoSave += " offline (in local browser db)";
        let textForUpdateStatus = `${saveOrAutoSave} '${fileKey}'`;
        updateStatusText(textForUpdateStatus);
        await db.saveFileToDatabase(fileKey, {
          content: text,
          bucketName,
          fileSavedToS3: false,
        });
      }
    }, 1);
    setLastSavedText(text);
    setLastEditedFile(fileKey);
  }

  async function renameFile(fileKey) {
    let newFileName = "";

    while (newFileName !== null && newFileName?.length === 0) {
      newFileName = prompt("Enter new file name", fileKey);
      if (newFileName) {
        newFileName = slugifyPath(newFileName);
      }
    }

    if (newFileName === null || slugifyPath(fileKey) === newFileName) {
      return;
    }

    newFileName = slugifyPath(newFileName.trim());
    if (!VALID_FILE_EXTENSION.test(newFileName)) {
      newFileName += ".txt";
    }

    updateStatusText(`Renaming '${fileKey}' to '${newFileName}'`);
    setReadonly(true);

    try {
      setS3Error(null);
      await s3.renameFile(fileKey, newFileName);

      await db.saveFileToDatabase(newFileName, {
        content: text,
        bucketName,
        fileSavedToS3: true,
      });
    } catch (err) {
      setS3Error(err);
      await db.saveFileToDatabase(newFileName, {
        content: text,
        bucketName,
        fileSavedToS3: false,
      });
    }
    if (offlineStorageEnabled) {
      await db.deleteFileFromDatabase(fileKey);
    }

    updateStatusText(`File renamed to ${newFileName}`);

    try {
      await loadS3Files();
      setReadonly(false);
    } catch (_) {}
    navigate(newFileName);
  }

  function tryToLoadNewCreatedFileAndUpdateFiles(fileName, cb) {
    // give s3 max 5secs time
    let count = 0;
    let maxCount = 10;
    const intervalID = setInterval(async () => {
      console.debug("Trying to load new file…");
      count++;
      try {
        await loadFile(fileName);
        clearInterval(intervalID);
        if (cb) {
          cb(fileName);
        }
        return;
      } catch (err) {
        if (err?.name !== "NotFound") {
          throw err;
        }
      }
      if (count > maxCount) {
        clearInterval(intervalID);
        updateStatusText("New file could not be loaded…");
        if (cb) {
          cb(null);
        }
      }
    }, 500);
  }

  async function createNewFile(fileName) {
    let { error } = await s3.createFile(fileName, "");
    if (error) {
      alert(error);
    }
  }

  function handleOnChangeEditor(text, { caretPosition } = {}) {
    if (text !== undefined) {
      if (rightTrimTextBeforeSave) {
        text =
          text
            .split("\n")
            .map((l) => l.trimEnd())
            .join("\n")
            .trimEnd() + `\n`;
      }
      setText(text);
      if (location?.pathname && VALID_FILE_EXTENSION.test(location?.pathname)) {
        debounced(text, location?.pathname?.replace(/^\//, ""), lastSavedText);
      } else if (text.trim() !== "") {
        localStorage.setItem("new-unsaved-text", text);
      }
    }
    if (caretPosition) {
      localStorage.setItem("caretPosition", caretPosition);
    }
  }

  async function handleClickOnFileVersion(ev, version) {
    let content = await s3.contentOfVersion(version.Key, version.VersionId);
    setInitialText(content);
    setText(content);
    setReadonly(true);
  }

  async function handleClickOnRestore(ev, version) {
    let content = await s3.contentOfVersion(version.Key, version.VersionId);
    setInitialText(content);
    setText(content);
    setReadonly(false);
    setFileVersions([]);
    // save file
    if (!autoSave) {
      s3.updateTextFile(version.Key, content);
    }
  }

  function logout() {
    setS3Client(null);
    setCredentials(null);
    setLoginErrorMessage(null);
    setErrorMessage(null);
    localStorage.clear();
    sessionStorage.clear();
    db.deleteDatabase();
  }

  function createOrSaveFile() {
    updateStatusText("Saving file");
    try {
      let textToSave = text;
      if (
        location.pathname === "/new" ||
        location.pathname === "new" ||
        location.pathname === "/" ||
        location.pathname === ""
      ) {
        let fileName = textToSave
          .trim()
          .split("\n")[0]
          .replace(/^\W+/, "")
          .substring(0, 64);
        if (fileName.trim() === "") {
          fileName = "unnamed";
        }
        fileName = slugifyPath(fileName).replace(/\.txt$/i, "");
        if (files.indexOf(fileName + ".txt") !== -1) {
          fileName += "-" + newNoteName().replace(/^note\-/, "");
        } else {
          fileName += ".txt";
        }
        saveFile(fileName, textToSave);
        localStorage.setItem("new-unsaved-text", "");
        tryToLoadNewCreatedFileAndUpdateFiles(fileName, () => {
          setTimeout(() => loadS3Files(), 100);
          navigate(`/${fileName}`);
        });
        setReadonly(false);
        return;
      } else {
        saveFile(location?.pathname?.replace(/^\//, ""), textToSave);
      }
    } catch (err) {
      console.error(err);
      alert(`Could not save file: ${err.message}`);
    }
  }

  async function handleMoveFileToFolder(fileKey, folderName) {
    let newFileName = folderName + fileKey.split("/").pop();
    let { fileName } = await s3.renameFile(fileKey, newFileName);

    updateStatusText(`File moved to ${newFileName}`);

    try {
      loadS3Files();
      await loadFile(fileName);
      setReadonly(false);
      if (offlineStorageEnabled) {
        db.renameFileInDatabase(fileKey, fileName);
      }
    } catch (_) {}
    navigate(fileName);
  }

  useEffect(() => {
    localStorage.setItem("color-scheme", colorScheme || "");

    document.body.classList.remove("dark-color-scheme");
    document.body.classList.remove("light-color-scheme");

    if (colorScheme === "dark") {
      document.body.classList.add("dark-color-scheme");
    } else if (colorScheme === "light") {
      document.body.classList.add("light-color-scheme");
    }
  }, [colorScheme]);

  useEffect(() => {
    localStorage.setItem("font-family", fontFamily || "");

    document.body.classList.remove("font-family-firacode");
    document.body.classList.remove("font-family-ibm");

    if (fontFamily === "firacode") {
      document.body.classList.add("font-family-firacode");
    } else if (fontFamily === "ibm") {
      document.body.classList.add("font-family-ibm");
    }
  }, [fontFamily]);

  useEffect(() => {
    sessionStorage.setItem("focusMode", !!focusMode);
    localStorage.setItem(
      "createSmartNewLineContent",
      !!createSmartNewLineContent,
    );
  }, [focusMode, createSmartNewLineContent]);

  useEffect(() => {
    if (!s3Client) {
      return;
    }
    if (!files) {
      // file already loaded
      return;
    }
    s3.isBucketVersioningEnabled()
      .then((isEnabled) => {
        setAutoSave(isEnabled);
      })
      .catch((err) => setS3Error(err));
  }, [files, credentials, s3Client]);

  useEffect(() => {
    if (!showStatusTextInMilliseconds) {
      return;
    }
    if (statusText) {
      // let statusTextBefore = statusText;
      setTimeout(() => {
        if (
          statusUpdatedAt + (showStatusTextInMilliseconds - 100) <
          new Date().getTime()
        ) {
          // remove status text
          setStatusUpdatedAt(0);
          setStatusText(null);
        }
      }, showStatusTextInMilliseconds);
    }
  }, [statusText]);

  useEffect(() => {
    window.addEventListener("beforeunload", handleUnload);

    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [handleUnload]);

  useEffect(() => {
    if (focusEditor?.target?.editor) {
      focusEditor.target.editor.readonly = readonly;
    }
    if (readonly || !s3Client || initialCaretPosition !== null) {
      return;
    }
    if (!/^\//.test(location.pathname)) {
      return;
    }
    if (localStorage.getItem("caretPosition")) {
      setInitialCaretPosition(
        Number(localStorage.getItem("caretPosition")) || 0,
      );
    }
  }, [s3Client, location, initialCaretPosition, readonly, focusEditor]);

  useEffect(() => {
    // return;
    if (s3Client) {
      return;
    }
    (async () => {
      const { region, endpoint, bucketName, accessKeyId, secretAccessKey } =
        credentials
          ? credentials
          : {
              region:
                sessionStorage.getItem("s3-region") ||
                (await encrypt.decryptLocalStorageItem(
                  "s3-region",
                  localStorage,
                  sessionStorage,
                )),
              endpoint:
                sessionStorage.getItem("s3-endpoint") ||
                (await encrypt.decryptLocalStorageItem(
                  "s3-endpoint",
                  localStorage,
                  sessionStorage,
                )) ||
                undefined,
              bucketName:
                sessionStorage.getItem("s3-bucket") ||
                (await encrypt.decryptLocalStorageItem(
                  "s3-bucket",
                  localStorage,
                  sessionStorage,
                )),
              accessKeyId:
                sessionStorage.getItem("s3-access-key") ||
                (await encrypt.decryptLocalStorageItem(
                  "s3-access-key",
                  localStorage,
                  sessionStorage,
                )),
              secretAccessKey:
                sessionStorage.getItem("s3-secret-access-key") ||
                (await encrypt.decryptLocalStorageItem(
                  "s3-secret-access-key",
                  localStorage,
                  sessionStorage,
                )),
            };

      if (credentials === null || !secretAccessKey) {
        return;
      }

      if (region && bucketName && accessKeyId && secretAccessKey) {
        console.debug("Setting S3 client");
        setBucketName(bucketName);
        let _s3Client = new S3Client({
          endpoint,
          region,
          requestChecksumCalculation: "WHEN_REQUIRED", // Workaround for: https://github.com/aws/aws-sdk-js-v3/issues/6834#issuecomment-2611346849
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
        setS3Client(_s3Client);
        s3.setS3Client(_s3Client);
        s3.setBucketName(bucketName);
        try {
          await loadS3Files(bucketName);
          setTimeout(async () => {
            // needs to be, AFTER the setS3Client
            if (offlineStorageEnabled) {
              await upsyncFiles();
            }
          }, 10);
        } catch (err) {
          setS3Client(null);
          s3.setS3Client(null);
          setReadonly(true);
          if (/Failed to fetch/i.test(err.message)) {
            setErrorMessage(
              `${err.message || "No connection"}. Maybe you are offline?`,
            );
          } else if (/SignatureDoesNotMatch/i.test(err.name)) {
            logout();
            setLoginErrorMessage(`Wrong credentials? (${err.name})`);
          } else {
            if (import.meta.env.PROD) {
              setErrorMessage(err.message);
            } else {
              throw err;
            }
          }
          return;
        }
        setLoginErrorMessage(null);
      } else {
        console.error("Could not set up S3 client");
        setS3Client(null);
        s3.setS3Client(null);
      }
    })();
  }, [s3Client, credentials]);

  useEffect(() => {
    loadS3Files();
  }, [folderPath, sortFilesByAttribute]);

  useEffect(() => {
    if (location.pathname === "/logout") {
      return logout();
    }
    setDisplayImageUrl(null);
    setPlayAudioUrl(false);
    setPlayVideoUrl(false);
    if (location.pathname.startsWith(`${FEATURE_FLAGS.IMAGE_UPLOAD_PATH}/`)) {
      (async () => {
        const url = location.pathname.replace(/^\//, "");
        const publicUrl = await s3.cachedSignedPublicS3Url(url);
        setDisplayImageUrl(publicUrl);
      })();
      return;
    }
    if (location.pathname.startsWith(`${FEATURE_FLAGS.VIDEO_UPLOAD_PATH}/`)) {
      (async () => {
        const url = location.pathname.replace(/^\//, "");
        const publicUrl = await s3.cachedSignedPublicS3Url(url);
        setPlayVideoUrl(publicUrl);
      })();
      return;
    }
    if (location.pathname.startsWith(`${FEATURE_FLAGS.AUDIO_UPLOAD_PATH}/`)) {
      (async () => {
        const url = location.pathname.replace(/^\//, "");
        const publicUrl = await s3.cachedSignedPublicS3Url(url);
        setPlayAudioUrl(publicUrl);
      })();
      return;
    }
    if (location.pathname.startsWith(`${FEATURE_FLAGS.ASSETS_BASE_PATH}/`)) {
      // download file
      (async () => {
        const url = location.pathname.replace(/^\//, "");
        const publicUrl = await s3.getPublicUrl(url, 60);
        // download file in the browser
        fetch(publicUrl)
          .then((response) => response.blob())
          .then((blob) => {
            // Create a Blob URL
            const url = window.URL.createObjectURL(blob);
            downloadFileByUrl(url);
            updateStatusText(`Downloading file '${url}'`);
          })
          .catch((error) => console.error("Error downloading file:", error));
      })();
    }
    if (!s3Client || location.pathname === "/") {
      return;
    }
    // load a bit later, to prevent to be overwritten by the / path loading
    // this should only be applied on initial page calls
    if (location.pathname.endsWith("/")) {
      setTimeout(() => {
        // open sidebar to show that we have been navigated to a folder
        setShowSideBar(true);
        setFolderPath(decodeURI(location.pathname));
      }, 100);
    }
  }, [s3Client, location]);

  useEffect(() => {
    setReadonly(fileVersions?.length > 0);
  }, [fileVersions]);

  useEffect(() => {
    if (location?.pathname === "/reset") {
      localStorage.clear();
      sessionStorage.clear();
      db.deleteDatabase();
      db.setupDatabase();
      navigate("/");
      window.location.reload();
      return;
    }

    if (!location || !s3Client) {
      return;
    }

    (async () => {
      if (location.pathname === "/") {
        loadS3Files();
        return;
      }

      if (VALID_FILE_EXTENSION.test(location.pathname)) {
        // load file
        let filename = decodeURI(location.pathname.replace(/^\//, ""));
        // clear everything
        setText("");
        setInitialText("");
        document.querySelector("title").innerText = filename;
        setPlaceholder("Loading… Please stand by for a moment");
        setReadonly(true);
        setFileVersions([]);
        setTimeout(async () => {
          try {
            await loadFile(filename);
            setFolderPath(filename);
            setReadonly(false);
            try {
              let filesHistory = localStorage.getItem("latestLoadedFiles") ? JSON.parse(localStorage.getItem("latestLoadedFiles")) : [];
              filesHistory.push(filename);
              filesHistory = [...new Set(filesHistory)];
              localStorage.setItem("latestLoadedFiles", JSON.stringify(filesHistory));
            } catch (_) {
              console.error(_);
              localStorage.setItem("latestLoadedFiles", JSON.stringify([]));
            }
            console.log(localStorage.getItem("latestLoadedFiles"));

            localStorage.setItem("new-unsaved-text", "");
            // otherwise the Y scroll position is sometimes a bit off
            setTimeout(() => window.scrollTo(null, 0), 100);
          } catch (err) {
            console.error(err);
            updateStatusText(
              `Couldn't load '${filename}' (${err.name || err.message})`,
            );
          }
          setPlaceholder(DEFAULT_PLACEHOLDER_TEXT);
        }, 1);
        return;
      }

      let fileName = "";
      if (location.pathname === "/new-ask-for-filename") {
        while (fileName !== null && fileName?.length === 0) {
          fileName = prompt(
            "Enter file name",
            folderPath.replace(/\/[^/]+[.]+[^/]+$/, "/").replace(/\/*$/, "/") +
              newNoteName(),
          );
          if (fileName) {
            fileName = slugifyPath(fileName);
          }
        }
        if (fileName === null) {
          return;
        }
        if (!VALID_FILE_EXTENSION.test(fileName)) {
          fileName += ".txt";
        }
        // remove leading slashes
        fileName = fileName.replace(/^\/+/, "");
        try {
          setS3Error(null);
          await createNewFile(fileName);
        } catch (err) {
          setS3Error(err);
          db.saveFileToDatabase(fileName, {
            content: "",
            bucketName,
            fileSavedToS3: false,
          });
        }

        tryToLoadNewCreatedFileAndUpdateFiles(fileName, () => {
          setTimeout(() => loadS3Files(), 100);
          navigate(`/${fileName}`);
        });
        setReadonly(false);
        return;
      }

      if (location.pathname === "/new") {
        setText("");
        setInitialText("");
        setReadonly(false);
        setAutoSave(false);
        return;
      }

      if (localStorage.getItem("new-unsaved-text")) {
        setText(localStorage.getItem("new-unsaved-text"));
      }
    })();
  }, [location, s3Client]);

  useEffect(() => {
    if (autoSave) {
      localStorage.setItem("autoSave", "");
    } else {
      localStorage.setItem("autoSave", "true");
    }
  }, [autoSave]);

  useEffect(() => {
    if (!s3Error) {
      return;
    }
    if (
      s3Error.message.match(/Offline mode/i) ||
      s3Error.message.match(/Failed to fetch/i)
    ) {
      if (
        s3Error.message.match(/Failed to fetch/i) &&
        window.navigator.onLine
      ) {
        if (
          confirm(
            `Could not receive a valid response from server. Maybe wrong credentials (or misconfigured CORS).\n\nLogout and try different credentials?`,
          )
        ) {
          return logout();
        }
      }
      console.groupCollapsed("offlineMode");
      console.debug("Offline mode", s3Error);
      console.groupEnd("offlineMode");
      return;
    }
    console.groupCollapsed("s3Error");
    console.error(s3Error);
    console.groupEnd("s3Error");
    if (/SignatureDoesNotMatch/i.test(s3Error)) {
      logout();
      setLoginErrorMessage(`Wrong credentials?\n\n${s3Error}`);
    }
  }, [s3Error]);

  useEffect(() => {
    if (
      !autoSave ||
      text === null ||
      !location?.pathname ||
      !VALID_FILE_EXTENSION.test(location?.pathname)
    ) {
      return;
    }
    debounced(
      text,
      decodeURI(location.pathname.replace(/^\//, "")),
      lastSavedText,
    );
  }, [text, autoSave, location]);

  useEffect(() => {
    if (credentials) {
      return;
    }
    (async () => {
      let data = {
        accessKeyId: sessionStorage.getItem("s3-access-key"),
        bucketName: sessionStorage.getItem("s3-bucket"),
        region: sessionStorage.getItem("s3-region"),
        endpoint: sessionStorage.getItem("s3-endpoint"),
        secretAccessKey: sessionStorage.getItem("s3-secret-access-key"),
      };

      if (!data.accessKeyId || !data.bucketName || !data.region) {
        if (
          sessionStorage.getItem("tempPassword") ||
          localStorage.getItem("tempPassword")
        ) {
          data = {
            accessKeyId: await encrypt.decryptLocalStorageItem(
              "s3-access-key",
              localStorage,
              sessionStorage,
            ),
            bucketName: await encrypt.decryptLocalStorageItem(
              "s3-bucket",
              localStorage,
              sessionStorage,
            ),
            region: await encrypt.decryptLocalStorageItem(
              "s3-region",
              localStorage,
              sessionStorage,
            ),
            endpoint: await encrypt.decryptLocalStorageItem(
              "s3-endpoint",
              localStorage,
              sessionStorage,
            ),
            secretAccessKey: await encrypt.decryptLocalStorageItem(
              "s3-secret-access-key",
              localStorage,
              sessionStorage,
            ),
          };
        } else {
          return;
        }
        if (
          !data.accessKeyId ||
          !data.bucketName ||
          !data.region ||
          !data.secretAccessKey
        ) {
          console.debug(
            "credentials could not be decrypted… try fresh login/reset instead",
          );
          return;
        }
      }

      setCredentials(data);
    })();
  }, [credentials]);

  return (
    <div
      className={[
        "app-window",
        showSideBar ? "sidebar-expanded" : null,
        s3Client ? "logged-in" : "not-logged-in",
        fileVersions?.length > 0 ? "show-file-versions" : null,
      ]
        .filter((v) => !!v)
        .join(" ")}
      onKeyDown={handleKeyDown}
    >
      {s3Client && !loginErrorMessage && (
        <>
          <div className="side">
            <div className="files">
              {folders !== null && files !== null && (
                <FileList
                  location={location}
                  folders={folders}
                  files={files}
                  folderPath={folderPath}
                  moveFileToFolder={handleMoveFileToFolder}
                  handleClickOnFolder={(ev, folderName) => {
                    if (folderName.startsWith("← ")) {
                      // go level up]

                      folderName = folderName
                        .replace(/^← /, "")
                        .replace(/^\//, "")
                        .replace(/\/$/, "");

                      return setFolderPath(
                        folderName.includes(".")
                          ? "/" + folderName.split("/").slice(0, -2).join("/")
                          : "/" + folderName.split("/").slice(0, -1).join("/"),
                      );
                    }
                    setFolderPath(folderName.replace(/^← /, ""));
                  }}
                  setShowSideBar={setShowSideBar}
                  handleClickOnFile={handleClickOnFile}
                  longPressOnFile={longPressOnFile}
                  handleClickOnHistory={handleClickOnHistory}
                  handleDeleteFolder={handleDeleteFolder}
                  lastEditedFile={lastEditedFile}
                  isPossiblyOffline={isPossiblyOffline}
                ></FileList>
              )}
            </div>
            <div
              className="toggle-bar"
              onClick={() => {
                setShowSideBar(!showSideBar);
                if (!showSideBar) {
                  setFocusMode(false);
                }
              }}
            ></div>
          </div>
          {fileVersions?.length > 0 && (
            <FileVersions
              fileVersions={fileVersions}
              setFileVersions={setFileVersions}
              navigate={navigate}
              handleClickOnRestore={handleClickOnRestore}
              handleClickOnFileVersion={handleClickOnFileVersion}
              location={location}
              setShowSideBar={setShowSideBar}
            ></FileVersions>
          )}
          <div
            className="main"
            onClick={(ev) => {
              if (
                !ev.target.dataset.isMoreOptionsItem &&
                ev.target.tagName !== "INPUT"
              ) {
                setShowMoreOptions(false);
              }
            }}
          >
            {jumpToFile && s3 && (
              <JumpToFileBar
                s3={s3}
                setJumpToFile={setJumpToFile}
                sortFilesByAttribute={sortFilesByAttribute}
              ></JumpToFileBar>
            )}
            <div className="button-more">
              <div className="icon">
                <input
                  type="checkbox"
                  checked={showMoreOptions}
                  onChange={(ev) => setShowMoreOptions(ev.target.checked)}
                />
                <img src={moreIcon}></img>
              </div>
              {showMoreOptions && (
                <ul
                  className="menu"
                  onClick={(ev) => {
                    if (ev.target.dataset.isMoreOptionsItem) {
                      // don't close menu
                      return;
                    }
                    setShowMoreOptions(false);
                    setShowAdditionalMenuOption(false);
                  }}
                >
                  <li
                    className="create-file"
                    onClick={(ev) => {
                      navigate("new");
                      setFolderPath("/");
                    }}
                  >
                    New file
                    <span className="shortcut">⌘ + B</span>
                  </li>
                  <li
                    onClick={(ev) => {
                      navigate("new-ask-for-filename");
                    }}
                  >
                    New with specific name
                  </li>
                  <li
                    onClick={() =>
                      setCreateSmartNewLineContent(!createSmartNewLineContent)
                    }
                    className={createSmartNewLineContent ? "active" : null}
                    style={{ display: "none" }}
                  >
                    Guess lists and indents
                  </li>
                  <li
                    onClick={() => setAutoSave(!autoSave)}
                    className={[autoSave ? "active" : null, "border-bottom"]
                      .filter((v) => !!v)
                      .join(" ")}
                  >
                    Autosave
                  </li>
                  {true && (
                    <li
                      className={["border-bottom"].filter((v) => !!v).join(" ")}
                      data-is-more-options-item="true"
                      style={{ position: "relative" }}
                      onMouseEnter={() => setShowAdditionalMenuOption(true)}
                      onMouseLeave={() => setShowAdditionalMenuOption(false)}
                    >
                      More Options
                      {showAdditionalMenuOption && (
                        <div className="more-options">
                          <ul className="menu">
                            <li
                              data-is-more-options-item="true"
                              onClick={() => {
                                if (colorScheme === "dark") {
                                  setColorScheme("light");
                                } else if (colorScheme === "light") {
                                  setColorScheme("");
                                } else {
                                  setColorScheme("dark");
                                }
                              }}
                            >
                              Color scheme (
                              {colorScheme ? colorScheme + " → " : "auto → "}
                              {colorScheme === "dark"
                                ? "light"
                                : colorScheme === "light"
                                  ? "auto"
                                  : "dark"}
                              )
                            </li>
                            <li
                              data-is-more-options-item="true"
                              onClick={() => {
                                if (fontFamily === "firacode") {
                                  setFontFamily("");
                                } else if (fontFamily === "ibm") {
                                  setFontFamily("firacode");
                                } else {
                                  setFontFamily("ibm");
                                }
                              }}
                            >
                              Font (
                              {fontFamily ? fontFamily + " → " : "auto → "}
                              {fontFamily === "ibm"
                                ? "fira code"
                                : fontFamily === "firacode"
                                  ? "auto"
                                  : "ibm"}
                              )
                            </li>
                            {!isTouch() && (
                              <li
                                onClick={() => {
                                  setScrollWindowToCenterCaret(
                                    !scrollWindowToCenterCaret,
                                  );
                                  localStorage.setItem(
                                    "scrollWindowToCenterCaret",
                                    !scrollWindowToCenterCaret,
                                  );
                                }}
                                /* NOT WORKING?! TODO: check why not… */
                                style={{ display: "none" }}
                                className={
                                  scrollWindowToCenterCaret ? "active" : null
                                }
                              >
                                Scroll to center
                              </li>
                            )}
                            <li
                              onClick={toggleFullScreen}
                              className={
                                document.fullscreenElement ? "active" : null
                              }
                            >
                              Fullscreen{" "}
                              <span className="shortcut">⌘ + Shift + F</span>
                            </li>
                            <li className="border-bottom">
                              <div title="Increase or decrease font size">
                                <span
                                  data-is-more-options-item="true"
                                  onClick={() => {
                                    setFontSize(Number(fontSize || 16) + 1);
                                  }}
                                >
                                  Larger font
                                </span>
                                <span
                                  data-is-more-options-item="true"
                                  style={{
                                    transform: "scale(0.75)",
                                    display: "inline-flex",
                                    paddingLeft: "0.25rem",
                                  }}
                                  onClick={() => {
                                    setFontSize(Number(fontSize || 16) - 1);
                                  }}
                                >
                                  Smaller Font
                                </span>
                              </div>
                            </li>
                            <li
                              data-is-more-options-item="true"
                              onClick={async () => {
                                const value =
                                  sortFilesByAttribute === "LastModified"
                                    ? "Key"
                                    : "LastModified";
                                localStorage.setItem(
                                  "sortFilesByAttribute",
                                  value,
                                );
                                setSortFilesByAttribute(value);
                              }}
                            >
                              Sort files (
                              {sortFilesByAttribute === "Key"
                                ? "name"
                                : "modified"}{" "}
                              →{" "}
                              {sortFilesByAttribute === "LastModified"
                                ? "name"
                                : "modified"}
                              )
                            </li>
                            <li
                              data-is-more-options-item="true"
                              className={[
                                "border-bottom",
                                offlineStorageEnabled ? "active" : null,
                              ]
                                .filter((v) => !!v)
                                .join(" ")}
                              onClick={async () => {
                                let value = !offlineStorageEnabled;
                                if (value) {
                                  updateStatusText("Offline Storage enabled");
                                  setOfflineStorageEnabled(true);
                                  localStorage.setItem(
                                    "offlineStorage",
                                    "true",
                                  );
                                } else {
                                  setOfflineStorageEnabled(false);
                                  localStorage.removeItem("offlineStorage");
                                  await db.clearFiles();
                                  updateStatusText(
                                    "Offline Storage disabled + cleared",
                                  );
                                }
                              }}
                            >
                              Offline Storage
                            </li>
                            <li
                              data-is-more-options-item="true"
                              onClick={(ev) => {
                                setConvertPDFToText(!convertPDFToText);
                                localStorage.setItem(
                                  "convertPDFToText",
                                  convertPDFToText ? "false" : "true",
                                );
                              }}
                              className={convertPDFToText ? "active" : null}
                            >
                              Extract text from PDF on drop
                            </li>
                            <li
                              data-is-more-options-item="true"
                              onClick={(ev) => {
                                setConvertHTMLToMarkdown(
                                  !convertHTMLToMarkdown,
                                );
                                localStorage.setItem(
                                  "convertHTMLToMarkdown",
                                  convertHTMLToMarkdown ? "false" : "true",
                                );
                              }}
                              className={[
                                convertHTMLToMarkdown ? "active" : null,
                                "border-bottom",
                              ]
                                .filter((v) => !!v)
                                .join(" ")}
                            >
                              Convert HTML to MD on paste
                            </li>
                            <li
                              onClick={() => {
                                let textWithUnifiedTables =
                                  unifyMarkdownTableCellWidths(text);
                                if (textWithUnifiedTables !== text) {
                                  setInitialText(
                                    unifyMarkdownTableCellWidths(
                                      textWithUnifiedTables,
                                    ),
                                  );
                                  setText(
                                    unifyMarkdownTableCellWidths(
                                      textWithUnifiedTables,
                                    ),
                                  );
                                }
                              }}
                            >
                              Unify column widths{" "}
                              <span className="shortcut">Ctrl + ⌘ + T</span>
                            </li>
                            <li
                              data-is-more-options-item="true"
                              onClick={(ev) => {
                                setRightTrimTextBeforeSave(
                                  !rightTrimTextBeforeSave,
                                );
                                localStorage.setItem(
                                  "rightTrimTextBeforeSave",
                                  rightTrimTextBeforeSave ? "false" : "true",
                                );
                              }}
                              className={[
                                rightTrimTextBeforeSave ? "active" : null,
                                "border-bottom",
                              ]
                                .filter((v) => !!v)
                                .join(" ")}
                            >
                              Remove trailing spaces on Save
                            </li>
                            <li
                              data-is-more-options-item="true"
                              onClick={(ev) => {
                                setRenderMarkdownTables(!renderMarkdownTables);
                                localStorage.setItem(
                                  "renderMarkdownTables",
                                  renderMarkdownTables ? "false" : "true",
                                );
                              }}
                              className={renderMarkdownTables ? "active" : null}
                            >
                              Render Tables
                            </li>
                            <li
                              data-is-more-options-item="true"
                              onClick={(ev) => {
                                setFullWithEditor(!fullWithEditor);
                                localStorage.setItem(
                                  "fullWithEditor",
                                  fullWithEditor ? "false" : "true",
                                );
                              }}
                              className={fullWithEditor ? "active" : null}
                            >
                              Full-Width editing
                            </li>
                          </ul>
                        </div>
                      )}
                    </li>
                  )}
                  <li
                    onClick={(ev) => {
                      setShowSideBar(!showSideBar);
                    }}
                  >
                    {showSideBar ? "Hide" : "Show"} file list{" "}
                    <span className="shortcut">⌘ + ;</span>
                  </li>
                  <li onClick={displayGoToParagraphDialog}>
                    Jump to paragraph <span className="shortcut">⌘ + G</span>
                  </li>
                  <li
                    onClick={(ev) => {
                      setPreviewImages(!previewImages);
                      localStorage.setItem(
                        "previewImages",
                        previewImages ? "false" : "true",
                      );
                    }}
                    className={previewImages ? "active" : null}
                  >
                    Preview media
                  </li>
                  <li
                    onClick={(ev) => {
                      setFocusMode(!focusMode);
                      setShowSideBar(false);
                    }}
                    className={focusMode ? "active" : null}
                  >
                    Focus <span className="shortcut">⌘ + .</span>
                  </li>
                  <li onClick={logout} className="border-top border-bottom">
                    Logout
                  </li>
                  <li onClick={() => createOrSaveFile()}>
                    Save <span className="shortcut">⌘ + S</span>
                  </li>
                </ul>
              )}
            </div>
            {displayImageUrl || playVideoUrl || playAudioUrl ? (
              <>
                {displayImageUrl && (
                  <div className="display-single-image">
                    <img src={displayImageUrl}></img>
                  </div>
                )}
                {playVideoUrl && (
                  <div className="display-single-image">
                    <video controls>
                      <source src={playVideoUrl} />
                    </video>
                  </div>
                )}
                {playAudioUrl && (
                  <div className="display-single-image">
                    <figure>
                      <audio controls src={playAudioUrl}></audio>

                      <figcaption style={{ textAlign: "center" }}>
                        <p>
                          <a href={playAudioUrl}>Download audio file</a>
                        </p>
                      </figcaption>
                    </figure>
                  </div>
                )}
              </>
            ) : (
              <div
                onClick={(ev) => {
                  if (ev.target.dataset.isMoreOptionsItem) {
                    // don't close menu
                    return;
                  }
                  if (ev.isTrusted) {
                    setShowMoreOptions(false);
                    setShowSideBar(false);
                    setJumpToFile(false);
                    setShowAdditionalMenuOption(false);
                  }
                }}
                className={[
                  "editor-wrapper",
                  colorScheme === "light" ? "light-color-scheme" : null,
                  colorScheme === "dark" ? "dark-color-scheme" : null,
                ]
                  .filter((v) => !!v)
                  .join(" ")}
              >
                <div
                  onDrop={(ev) => {
                    handleDrop(ev, {
                      text,
                      setInitialText,
                      setText,
                      updateStatusText,
                      setReadonly,
                      focusEditor,
                      convertPDFToText,
                    });
                  }}
                  className="drop-wrapper"
                >
                  <EditorWrapper
                    placeholder={placeholder}
                    indentHeadings={true}
                    initialText={initialText}
                    onChange={handleOnChangeEditor}
                    readOnly={readonly}
                    focusMode={focusMode}
                    doGuessNextListItemLine={createSmartNewLineContent}
                    initialCaretPosition={initialCaretPosition}
                    scrollWindowToCenterCaret={scrollWindowToCenterCaret}
                    previewImages={previewImages}
                    fullWithEditor={fullWithEditor}
                    renderMarkdownTables={renderMarkdownTables}
                    focusEditor={focusEditor}
                    setFocusEditor={setFocusEditor}
                    convertHTMLToMarkdown={convertHTMLToMarkdown}
                  ></EditorWrapper>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      {(loginErrorMessage || !credentials) && (
        <Login
          setCredentials={setCredentials}
          errorMessage={loginErrorMessage}
          setErrorMessage={setLoginErrorMessage}
        ></Login>
      )}
      {errorMessage && (
        <div className="global-error-message">
          {s3Error ? (
            <div>Problem on loading: {s3Error.message}</div>
          ) : (
            errorMessage
          )}
          <div>
            <a
              onClick={() => {
                logout();
              }}
            >
              Logout
            </a>
          </div>
        </div>
      )}
      {statusText && (
        <div className="status-bar" onClick={() => setStatusText("")}>
          {statusText}
        </div>
      )}
    </div>
  );
}
