import moment from "moment";
import { useState } from "react";

export function FileVersions({
  fileVersions,
  setFileVersions,
  navigate,
  handleClickOnRestore,
  handleClickOnFileVersion,
  location,
  setShowSideBar
} = {}) {
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [activeVersion, setActiveVersion] = useState(null);
  return (
    <div className="file-versions">
      <div className="file-versions-container">
        <p>{fileVersions.length} versions available</p>
        <div className="restore-or-cancel-versioning">
          <button
            onClick={() => {
              setFileVersions([]);
              setShowSideBar(false);
              // reload actual file
              navigate(location.pathname);
            }}
          >
            Close
          </button>
          <button
            onClick={(ev) => {
              ev.target.disabled = true;
              if (activeVersion) {
                handleClickOnRestore(ev, activeVersion);
                setShowSideBar(false);
              } else {
                alert("No file selected");
              }
              ev.target.disabled = false;
            }}
          >
            Restore
          </button>
        </div>
        <ul>
          {fileVersions.map((v, i) => (
            <li
              key={v.VersionId}
              onClick={(ev) => {
                setActiveVersion(v);
                handleClickOnFileVersion(ev, v);
              }}
              className={[
                !showAllVersions &&
                (moment(fileVersions[i - 1]?.LastModified).fromNow() ==
                  moment(v.LastModified).fromNow() ||
                  fileVersions[i - 1]?.Size === v.Size)
                  ? "hide"
                  : null,
                activeVersion?.VersionId === v.VersionId ? "active" : null
              ]
                .filter((x) => !!x)
                .join(" ")}
            >
              {moment(v.LastModified).fromNow()} ({v.Size} bytes)
            </li>
          ))}
          {!showAllVersions && (
            <li onClick={() => setShowAllVersions(true)}>
              <p>Show all {fileVersions.length} versions...</p>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
