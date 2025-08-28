import { useCallback, useEffect, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useNavigate } from "react-router-dom";

import { VALID_FILE_EXTENSION } from "./helper.js";

export function JumpToFileBar({ s3, setJumpToFile }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!searchQuery) {
      return;
    }
    debounced(searchQuery);
  }, [searchQuery]);

  function showFile(file) {
    navigate(file);
    setJumpToFile(false);
  }

  const handleKeyDown = function(ev) {
    if (ev.key === "Enter" && selectedFile) {
      showFile(selectedFile);
    }
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      if (files.length === 0) {
        return;
      }
      let currentIndex = files.findIndex((f) => f && f.Key === selectedFile);
      if (currentIndex === -1) {
        currentIndex = 0;
      } else {
        if (ev.key === "ArrowDown") {
          currentIndex++;
          if (currentIndex >= files.length) {
            currentIndex = 0;
          }
        } else if (ev.key === "ArrowUp") {
          currentIndex--;
          if (currentIndex < 0) {
            currentIndex = files.length - 1;
          }
        }
      }
      setSelectedFile(files[currentIndex].Key);
    }
  }

  const debounced = useDebouncedCallback(
    async (value) => {
      let prefix = value.replace(/\//, "");
      let fileFound = files.find((f) => f && f.Key === prefix);
      if (fileFound) {
        setSelectedFile(fileFound.Key);
        return;
      }

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
      let result = await s3.listFiles(props);
      setFiles(result.files);
    },
    // delay in ms
    500,
  );

  return (
    <div id="jump-to-file-bar">
      <input
        type="text"
        placeholder="Jump to file..."
        id="jump-to-file-bar-input"
        autoFocus
        onInput={(ev) => setSearchQuery(ev.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="file-list">
        {(selectedFile || !selectedFile) && files.length > 0 &&
          files.filter(f => !!f?.Key).map((f) => (
            <div key={"file" + f.ETag} className={["file-item", selectedFile === f.Key ? 'selected' : ''].filter(v => !!v).join(' ')} onClick={() => showFile(f.Key)}>
              {f.Key}
            </div>
          ))}
      </div>
    </div>
  );
}
