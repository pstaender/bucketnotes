import { Cursor } from "./Cursor";

export function isSafari() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

export function isFirefox() {
  return /firefox/i.test(navigator.userAgent);
}

export function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints;
}

// TODO: replace the other stuff with this method call!!!
// USE THIS: currentElementInsideContentHolderWithCaret(getContentEditableHolderReference())
export function currentElementInsideContentHolderWithCaret(editor = null, checkForParentDiv = true) {
  let activeElement = currentElementWithCaret();
  if (activeElement && checkForParentDiv) {
    if (activeElement.tagName !== "DIV" && activeElement.parentElement.tagName === "DIV") {
      activeElement = activeElement.parentElement;
    }
  }
  if (
    activeElement.closest(".content-holder") &&
    !activeElement.classList.contains("content-holder")
  ) {
    return activeElement;
  }
  // Fallback: if we have a editor reference, we can search for the element by class
  if (editor) {
    return (
      editor.querySelector(".cursor-inside") ||
      editor.querySelector(".active") ||
      null
    );
  }
  return null;
}

export function putCursorIntoElement(el, position = 0, editor) {
  Cursor.setCurrentCursorPosition(position, el);
  if (editor) {
    editor.querySelectorAll(".cursor-inside, .active").forEach((el) => {
      el.classList.remove("cursor-inside");
      el.classList.remove("having-cursor-inside");
      el.classList.remove("active");
    });
  }
  el.classList.add("cursor-inside");
  el.classList.add("active");
}

export function currentElementWithCaret() {
  // https://stackoverflow.com/a/34809030/728804
  var sel = window.getSelection();
  var range = null;
  try {
    range = sel.getRangeAt(0);
  } catch (e) {
    if (e.message.match(/IndexSizeError/)) {
      console.error(e);
    } else {
      throw e;
    }
  }

  if (range?.commonAncestorContainer) {
    let el = range.commonAncestorContainer;
    if (el.nodeType === Node.TEXT_NODE) {
      el = el.parentNode;
    }
    return el;
  }

  var sel = window.getSelection();
  var range = sel.getRangeAt(0);
  return range.startContainer.parentNode;
}

export function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
}

export function rtrim(str) {
  return str.replace(/\s+$/, "");
}

export function trimLines(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .join("\n");
}

export function removeElementAndPlaceItsContentInParentElement(child) {
  let parent = child.parentNode;

  // child.id = Math.random().toString(36);
  let html = parent?.innerHTML?.replace(child.outerHTML, child.innerHTML);
  if (html !== undefined) {
    parent.innerHTML = html;
  }
}

export function someTextIsHighlighted() {
  // detects that some text is selected
  return window.getSelection && window.getSelection().type === "Range";
}

export function someTextIsHighlightedInEditor(editor) {
  return !!(
    window.getSelection &&
    window.getSelection().type === "Range" &&
    window.getSelection().anchorNode?.closest &&
    window.getSelection().anchorNode.closest(".editor").parentNode?.dataset
      ?.identifier === editor.dataset.identifier
  );
}

export function deselectAll(document) {
  if (window.getSelection) {
    window.getSelection().removeAllRanges();
  } else if (document.selection) {
    document.selection.empty();
  }
}

export function rtrimSourroundindElements(el) {
  // this helper is called on nearly every control key press
  if (!el) {
    return;
  }
  let elements = [
    el.previousElementSibling?.previousElementSibling,
    el.previousElementSibling,
    el.nextElementSibling,
    el.nextElementSibling?.nextElementSibling
  ];
  elements
    .filter((e) => !!e?.innerHTML)
    .forEach((e) => {
      if (!/(\s|&nbsp;)*$/.test(e.innerHTML)) {
        return;
      }
      let html = e.innerHTML.replace(/(&nbsp;)*$/, "");
      html = rtrim(html);
      if (html === "") {
        html = "<br>";
      }
      e.innerHTML = html;
    });
}

export function stripTags(html) {
  let div = document.createElement("div");
  div.innerHTML = html;
  return div.innerText;
}

// export function htmlEntitites(text) {
//   let div = document.createElement("div");
//   div.innerText = text;
//   return div.innerHTML;
// }

export function htmlEntititesToAsci(html) {
  let div = document.createElement("div");
  div.innerHTML = html;
  return div.innerText;
}

export function arrayOfRangeNumbers(start, end) {
  // [...Number.range(1, 10)]
  return [...Array(end - start + 1).keys()].map((i) => i + start);
}

export function elementToAppearOrDisappear(entries, target, cb) {
  // Create a new Intersection Observer
  const observer = new IntersectionObserver(entries => {
    // Loop through the entries
    entries.forEach(cb);
  });

  // Start observing the target element
  observer.unobserve(target);
  observer.observe(target);
}
