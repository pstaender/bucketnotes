import FEATURE_FLAGS from "./featureFlags.json" with { type: "json" };
import { useCallback, useEffect, useState } from "react";
import { VALID_FILE_EXTENSION, isTouchDevice } from "./helper.js";

import { useNavigate } from "react-router-dom";

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


  const normalizedFolderPath = (/\/[^.]+$/.test(folderPath) ? folderPath : folderPath.split('/').slice(0, -1).join('/')).replace(/\/+/, '/').replace(/[/]*$/, '/');

  const subfolders = files.filter(file => file.substring(normalizedFolderPath.length).includes('/')).map(file => file.split('/')[1]).filter((value, index, self) => self.indexOf(value) === index);

  useEffect(() => {
    setAllowFileDragAndDrop(FEATURE_FLAGS.MOVE_FILES_WITH_DRAG_AND_DROP && (key === "Meta" || key === "Control"));
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

  function Droppable({ id, folderName, realPath }) {
    const { isOver, setNodeRef } = useDroppable({
      id
    });

    return (
      <li
        ref={setNodeRef}
        key={`folder-${folderName}`}
        className={[
          'folder',
          location.pathname?.startsWith(folderName) ? "active" : null,
          isOver ? "over" : null
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          className="file-name"
          onClick={(ev) => handleClickOnFolder(ev, realPath || folderName)}
        >
          {folderName.startsWith('← ') ? (
            <>
              <span>{folderName.substring(0, 2)}</span>
              <span className="folder-path-text">{folderName.split('← ')[1]}</span>
            </>
          ) : (
            <>{folderName.replace(/\/*$/, '/')}</>
          )}

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
          {fileKey.split('/').at(-1)}
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
    let destination = over.id;

    if (destination === 'folder-up') {
      return;
    }
    destination = destination.replace(/^folder::/, "");
    let el = document.getElementById(active.id);
    if (!el) {
      console.error("Element not found");
    }
    el.style.display = "none";
    console.debug("Moving file", active.id, "to folder", destination);
    await moveFileToFolder(active.id, destination.replace(/\/*$/, '/'));
  }

  files = files.filter(f => f.substring(normalizedFolderPath.length).includes('.') && !f.substring(normalizedFolderPath.length).includes('/'));

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <ul>
        {folderPath &&
        folderPath !== "/" &&
        (!VALID_FILE_EXTENSION.test(folderPath) || folderPath.includes("/")) ? (
          <Droppable
            folderName={'← ' + normalizedFolderPath.split('/').slice(0, -1).join('/').replace(/^\/*/, '/')}
              id="folder-up"
              key="folder-up"
          ></Droppable>
        ) : (
          <li className="no-hover" key="no-hover-folder">
            &nbsp;
          </li>
        )}
        {folders.concat(subfolders).filter(v => v !== '/').map((folderName) => (
          <Droppable
            folderName={folderName}
            realPath={normalizedFolderPath + folderName}
            id={`folder::${normalizedFolderPath + folderName}`}
            key={`folder::${normalizedFolderPath + folderName}`}
          ></Droppable>
        ))}
        {location && ((!files || files.length === 0) && subfolders.length === 0) && (
          <li className="no-files-found" key="no-text-file-found">
            No files found
          </li>
        )}
        {files.map((fileKey) => (
          <Draggable
            fileKey={fileKey}
            key={fileKey}
            allowDragAndDrop={allowFileDragAndDrop}
          ></Draggable>
        ))}
      </ul>
    </DndContext>
  );
}
