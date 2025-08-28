default export JumpToFileBar() {
  return (<div id="jump-to-file-bar">
    <input type="text" placeholder="Jump to file..." />
    <div className="file-list">
      {/* Dynamically populated list of files */}
      <div className="folder-item">schule</div>
      <div className="file-item">File1.txt</div>
      <div className="file-item">File2.txt</div>
      <div className="file-item">Document.pdf</div>
      <div className="file-item">Image.png</div>
      <div className="file-item">Notes.md</div>
    </div>
  </div>)
}
