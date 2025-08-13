import { useCallback, useEffect, useState } from "react";
import { VALID_FILE_EXTENSION, isTouchDevice } from "./helper.js";

import DeleteIcon from "./icons/delete.svg";
import HistoryIcon from "./icons/history.svg";
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

export function FileList({
  location,
  files,
  folders,
  handleClickOnFolder,
  setShowSideBar,
  handleClickOnFile,
  longPressOnFile,
  handleClickOnHistory,
  handleDeleteFolder,
  lastEditedFile,
  folderPath,
  moveFileToFolder,
  isPossiblyOffline
} = {}) {
  const [allowFileDragAndDrop, setAllowFileDragAndDrop] = useState(false);
  const [key, setKey] = useState(null);

  useEffect(() => {
    setAllowFileDragAndDrop(false);
    if (key === "Meta" || key === "Control") {
      setAllowFileDragAndDrop(true);
    }
  }, [key]);

  const registerKeyPress = useCallback((e) => {
    setKey(e.key);
  }, []);
  const registerKeyUp = useCallback((e) => {
    setKey(null);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", registerKeyPress);
    () => window.removeEventListener("keydown", registerKeyPress);
  }, [registerKeyPress]);

  useEffect(() => {
    window.addEventListener("keyup", registerKeyUp);
    () => window.removeEventListener("keydown", registerKeyUp);
  }, [registerKeyUp]);

  const [parent, setParent] = useState(null);

  function Droppable({ id, folderName }) {
    const { isOver, setNodeRef } = useDroppable({
      id
    });

    return (
      <li
        ref={setNodeRef}
        key={`folder-${folderName}`}
        className={[
          location.pathname?.startsWith(folderName) ? "active" : null,
          isOver ? "over" : null
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          className="file-name"
          onClick={(ev) => handleClickOnFolder(ev, folderName)}
        >
          {folderName}
        </div>
        <span
          className="icons"
          onClick={(ev) => handleDeleteFolder(ev, folderName)}
        >
          <span className="delete icon">
            <img src={DeleteIcon} alt="Delete" />
          </span>
        </span>
      </li>
    );
  }

  function Draggable({ fileKey, allowDragAndDrop } = {}) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
      id: fileKey
    });
    const style = {
      // Outputs `translate3d(x, y, 0)`
      transform: CSS.Translate.toString(transform)
    };

    let clickEvents = {
      onClick: (ev) => {
        if (isTouchDevice()) {
          setShowSideBar(false);
        }
        handleClickOnFile(ev, fileKey);
      },
      onDoubleClick: (ev) => {
        setShowSideBar(false);
        handleClickOnFile(ev, fileKey);
      },
      ...longPressOnFile(fileKey)
    };

    if (allowDragAndDrop) {
      clickEvents = { ...listeners, ...attributes };
    }

    return (
      <li
        key={fileKey}
        ref={setNodeRef}
        style={style}
        id={fileKey}
        {...clickEvents}
        className={
          location.pathname?.replace(/^\//, "") === fileKey ||
          (lastEditedFile && fileKey === lastEditedFile)
            ? "active"
            : null
        }
      >
        <span className="file-name">
          {fileKey.includes("/")
            ? fileKey.split("/").splice(1).join("/")
            : fileKey}
        </span>
        <span className="icons">
          {!isPossiblyOffline && (
            <span
              className="history icon"
              onClick={(ev) => handleClickOnHistory(ev, fileKey)}
            >
              <img src={HistoryIcon} alt="Versions" />
            </span>
          )}
          <span className="delete icon">
            <img src={DeleteIcon} alt="Delete" />
          </span>
        </span>
      </li>
    );
  }

  async function handleDragEnd({ over, active }) {
    if (!over || !active) {
      return;
    }
    let folderName = over.id.replace(/^folder::/, "");
    let el = document.getElementById(active.id);
    if (!el) {
      console.error("Element not found");
    }
    el.style.display = "none";
    await moveFileToFolder(active.id, folderName);
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <ul>
        {folderPath &&
        folderPath !== "/" &&
        (!VALID_FILE_EXTENSION.test(folderPath) || folderPath.includes("/")) ? (
          <li
            onClick={(ev) => {
              handleClickOnFolder(ev, folderPath, { goToRootFolder: true });
            }}
            key="folder-up"
          >
            ←
          </li>
        ) : (
          <li className="no-hover" key="no-hover-folder">
            &nbsp;
          </li>
        )}
        {folders.map((folderName) => (
          <Droppable
            folderName={folderName}
            id={`folder::${folderName}`}
            key={`folder::${folderName}`}
          ></Droppable>
        ))}
        {location && (!files || files.length === 0) && (
          <li className="no-files-found" key="no-text-file-found">
            No text files found
          </li>
        )}
        {files.map((fileKey) => (
          <Draggable
            fileKey={fileKey}
            key={fileKey}
            allowDragAndDrop={allowFileDragAndDrop}
          ></Draggable>
        ))}
        {/* {!isTouchDevice() && (
          <li key="allow-dad" className="no-hover allow-dad">
            <input
              type="checkbox"
              id="allow-file-dad"
              onChange={(ev) => setAllowFileDragAndDrop(ev.target.checked)}
            ></input>
            <label htmlFor="allow-file-dad">
              allow drag + drop file on folder
            </label>
          </li>
        )} */}
      </ul>
    </DndContext>
  );
}
