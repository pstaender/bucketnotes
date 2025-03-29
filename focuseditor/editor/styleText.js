// https://www.markdownguide.org/basic-syntax/
import { Cursor } from "./Cursor";
import {
  arrayOfRangeNumbers,
  currentElementInsideContentHolderWithCaret,
  currentElementWithCaret,
  isFirefox,
  isSafari,
  isTouchDevice,
  removeElementAndPlaceItsContentInParentElement,
  rtrim,
  slugify
} from "./helper";

const preIndentPattern = /^(\s|&nbsp;){2}?\S+/;
const checkForEmptyTextInDiv = true;

// https://stackoverflow.com/a/9340862
function innerTextOfElement(el) {
  let child = el.firstChild;
  let texts = [];

  while (child) {
    if (child.nodeType == 3) {
      texts.push(child.data);
    }
    child = child.nextSibling;
  }

  return texts.join("");
}

function removeHeaderClasses(child) {
  ["heading", "h1", "h2", "h3", "h4", "h5", "h6"].forEach((heading) => {
    child.classList.remove(heading);
  });
}

export function cleanupAndStyleNestedDivs(div) {
  if (isFirefox()) {
    // causes caret problems in firefox
    return;
  }
  if (div.children?.length > 0) {
    if (
      [...div.children].filter(
        (el) => el.tagName === "BR" || el.tagName === "DIV"
      ).length > 0
    ) {
      let newDiv = document.createElement("div");
      newDiv.innerText = div.innerText;
      // only cleanup if there is a (real) difference
      if (newDiv.innerText !== div.innerText.replace(/\n$/, "")) {
        div.innerText = div.innerText;
      }
      // replace <br> with splitting up divs to keep non-nested divs
      if (/<br>/.test(div.innerHTML)) {
        let divs = [];
        div.innerHTML.split("<br>").forEach((htmlSegment, i) => {
          let clonedDiv = div.cloneNode(true);
          if (i > 0) {
            clonedDiv.classList.remove("active");
            clonedDiv.classList.remove("cursor-inside");
          }
          clonedDiv.innerHTML = htmlSegment;
          divs.push(clonedDiv);
        });

        if (divs.filter((d) => d.innerText.trim() !== "").length > 0) {
          divs.forEach((d) => {
            div.after(d);
          });
          // remove old div
          div.remove();
        }
      }
    }
  }
}

export function removeStyleClassesOfNotMatchingMarkdownSyntax(child) {
  if (!child) {
    return;
  }
  child.removeAttribute("style");
  if (child.children.length > 0) {
    [...child.children].forEach(removeStyleClassesOfNotMatchingMarkdownSyntax);
  }

  if (child.tagName === "DIV" && checkForEmptyTextInDiv) {
    if (child.innerText.trim() === "") {
      child.classList.add("no-text");
    } else {
      child.classList.remove("no-text");
    }
  }

  if (
    child.classList.contains("list-item") &&
    !/^\s*([\*\-\•]|\d+\.)\s+/.test(child.innerText)
  ) {
    child.classList.remove("list-item");
  }
  if (
    child.classList.contains("blockquote") &&
    !/^\>\s+/.test(child.innerText)
  ) {
    child.classList.remove("blockquote");
  }
  if (
    child.classList.contains("pre-indent") &&
    !preIndentPattern.test(child.innerText)
  ) {
    child.classList.remove("pre-indent");
  }
  if (
    child.classList.contains("hr") &&
    !/^(\_{3,}|\-{3,}|\*{3,})$/.test(child.innerText)
  ) {
    child.classList.remove("hr");
  }
  if (child.innerText === undefined) {
    return;
  }
}

export function createBRIfIsEmpty(child) {
  if (
    child.innerText &&
    child.innerText.trim() === "" &&
    child.children?.length > 0 &&
    !child.classList.contains("content-editable-holder") &&
    !child.classList.contains("content-holder")
  ) {
    [...child.children].forEach((el) => {
      if (
        child.classList.contains("content-editable-holder") ||
        child.classList.contains("content-holder")
      ) {
        return;
      }
      if (
        el.tagName === "BR" ||
        el.classList.contains("content-editable-holder") ||
        el.classList.contains("editor")
      ) {
        return;
      }
      el.remove();
    });

    child.innerHTML = "<br>";
  }
}

export function removeStyleClasses(el, additionalClasses = []) {
  [
    ...["list-item", "blockquote", "table-delimiter", "pre-indent"],
    ...additionalClasses
  ].forEach((className) => {
    el.classList.remove(className);
  });
  removeHeaderClasses(el);
}

function removeSpans(child) {
  child.innerHTML = child.innerHTML.replace(
    /(<span(\s+class=["']{2)*>)(.+?)(<\/span>)/,
    "$3"
  );
  return child;
}

let activeElement = null;

export function hr(child) {
  if (rtrim(child.innerText).match(/^(\_{3,}|\-{3,}|\*{3,})$/)) {
    child.classList.add("hr");
    return child;
  }
}

export function heading(child) {
  removeHeaderClasses(child);
  if (!child.innerText.match(/^#{1,6}\s+/)) {
    return;
  }
  child.classList.add("heading");
  child.classList.add(
    "h" + child.innerText.match(/^#{1,6}[^#]/)[0].trim().length
  );
}

export function styleText(elements, document) {
  try {
    if (!currentElementInsideContentHolderWithCaret(document)) {
      activeElement = currentElementWithCaret();
    }
  } catch (e) {
    if (e.name.match(/IndexSizeError/)) {
      console.error(e);
    } else {
      throw e;
    }
  }

  function styleElement(child, i) {
    if (child.children.length > 0) {
      styleText(child.children, document);
    }

    if (child.tagName === "DIV" && checkForEmptyTextInDiv) {
      if (child.innerText.trim() === "") {
        child.classList.add("no-text");
      } else {
        child.classList.remove("no-text");
      }
    }

    if (
      child.tagName === "BR" ||
      child.classList.contains("content-holder") ||
      child.classList.contains("fenced-code-block")
    ) {
      return;
    }

    if (child.tagName === "DIV") {
      if (child.innerHTML.match(/^\s+$/)) {
        child.innerHTML = "<br>";
        child.classList.add("white-space");
        return;
      }

      if (!hr(child)) {
        heading(child);
      }
    }

    let html = innerTextOfElement(child);

    if (html === undefined) {
      html = child.innerHTML;
    }

    removeStyleClassesOfNotMatchingMarkdownSyntax(child);

    if (child.tagName === "DIV") {
      if (child.innerText.trim() === "") {
        removeStyleClasses(child, ["new"]);
      }

      // remove spans
      removeSpans(child);

      // bold/strong (blueprint for italic/strikethrough/...)
      if (html.match(/\*\*[^\*]+?\*\*/)) {
        let newHtml = child.innerHTML.replace(
          /(.{0,1})(\*\*[^\*]+?\*\*)/g,
          (match, p1, p2, p3) => {
            if (p1 === ">" || p1 === "\\") {
              return match;
            }
            // addedElements.push(`<b>${p2}</b>`);
            return `${p1 || ""}<b class="new">${p2 || ""}</b>`;
          }
        );

        if (child.innerHTML !== newHtml) {
          child.innerHTML = newHtml;
        }
      }

      // italic
      if (html.match(/\*{1}[^\*]+?\*{1}/)) {
        let newHtml = child.innerHTML.replace(
          /(.{0,1})(\*[^\s][^\*]+?\*)(.{0,1})/g,
          (match, p1, p2, p3) => {
            if (
              p1 === ">" ||
              p1 === "\\" ||
              p1 === "*" ||
              p3 === "*" ||
              p2.startsWith("**")
            ) {
              return match;
            }
            // addedElements.push(`<i>${p2}</i>`);
            return `${p1 || ""}<i>${p2 || ""}</i>${p3 || ""}`;
          }
        );

        if (child.innerHTML !== newHtml) {
          child.innerHTML = newHtml;
        }
      }

      // code
      if (html.match(/`.+?`/)) {
        let newHtml = child.innerHTML.replace(
          /(.{0,1})(`[^\`]+?`)(.{0,1})/g,
          (match, p1, p2, p3) => {
            if (p1 === ">" || p1 === "`" || p3 === "`" || p3 === "\\") {
              return match;
            }
            // addedElements.push(`<code>${p2}</code>`);
            return `${p1 || ""}<code class="new">${p2 || ""}</code>${p3 || ""}`;
          }
        );

        if (child.innerHTML !== newHtml) {
          child.innerHTML = newHtml;
        }
      }

      // <s> / strikethrough
      if (html.match(/\~\~[^\~]+.*?\~\~/)) {
        let newHtml = child.innerHTML.replace(
          /(.{0,1})(\~\~[^\~]+.*?\~\~)(.{0,1})/g,
          (match, p1, p2, p3) => {
            if (p1 === ">" || p1 === "~" || p3 === "~") {
              return match;
            }
            // addedElements.push(`<s>${p2}</s>`);
            return `${p1 || ""}<s>${p2 || ""}</s>${p3 || ""}`;
          }
        );

        if (child.innerHTML !== newHtml) {
          child.innerHTML = newHtml;
        }
      }
    }
  }

  [...elements].forEach(styleElement);
}

export function styleLinks(div, { showPictureOnImageHover = false } = {}) {
  /**
   * Internal linking allows easy link to another note
   * e.g. /#another-note.txt
   */
  const internalLinkPattern = /(.{0,1})#(\/.+)[\s\n]*/g; // to disable internal linking, set this to null

  if (div.children.length > 0) {
    [...div.children].forEach((e) => {
      styleLinks(e);
    });
  }
  if (
    div.tagName === "BR" ||
    div.tagName === "SPAN" ||
    div.classList.contains("fenced-code-block")
  ) {
    return;
  }

  function visitLink(e) {
    e.preventDefault();
    let target = e.tagName === "A" ? e : e.target.closest("a");
    let href = target.href;
    if (!href) {
      href = target.innerText.match(/\((.+?)\)/)[1];
      target.href = href.trim();
    }
    if (!href) {
      return;
    }
    if (href.startsWith("#")) {
      window.location.hash = href;
    }
    if (!/^(\/|http[s]*\:\/\/)/.test(href)) {
      return;
    }
    window.open(href, "_blank");
  }

  function linkOnMouseLeave(ev) {
    let img =
      ev.target.tagName === "IMG" ? ev.target : ev.target.querySelector("img");
    img?.remove();
  }
  function linkOnMouseEnter(ev) {
    if (ev.target.classList.contains("image")) {
      let a = ev.target;
      let img = document.createElement("img");
      img.src = a.href;
      img.addEventListener("error", () => img.remove());
      a.appendChild(img);
      return;
    }
  }

  function visitLinkIfMetaOrAltKeyPressed(e) {
    const metaOrAltKeyPressed = e.metaKey || e.altKey;

    if (internalLinkPattern && e.target.innerText.startsWith("#")) {
      if (metaOrAltKeyPressed) {
        // open internakl link in new tab
        visitLink(e);
      } else {
        location.hash = e.target.innerText;
      }
    }

    if (!metaOrAltKeyPressed) {
      return;
    }

    visitLink(e);
  }

  function reAssignClickEvents(a) {
    if (isTouchDevice()) {
      a.removeEventListener("dblclick", visitLink);
      a.addEventListener("dblclick", visitLink);
    } else {
      a.removeEventListener("click", visitLinkIfMetaOrAltKeyPressed);
      a.addEventListener("click", visitLinkIfMetaOrAltKeyPressed);
      if (showPictureOnImageHover) {
        a.removeEventListener("mouseleave", linkOnMouseLeave);
        a.addEventListener("mouseleave", linkOnMouseLeave);
        a.removeEventListener("mouseenter", linkOnMouseEnter);
        a.addEventListener("mouseenter", linkOnMouseEnter);
      }
    }
  }

  if (div.tagName === "A") {
    if (!/^\[(.+?)\]\((.+?)\)$/.test(div.innerHTML)) {
      return removeElementAndPlaceItsContentInParentElement(div);
    }
    reAssignClickEvents(div);
    return;
  }

  const markdownLinkPattern = /(.{0,1})\[([^\]]+?)\]\((.+?)\)/g;

  if (internalLinkPattern?.test(div.innerText)) {
    div.innerHTML = div.innerHTML.replace(
      internalLinkPattern,
      (match, previousChar, url) => {
        if (previousChar && previousChar !== " " && previousChar !== "\n") {
          return match;
        }
        return `${previousChar}<a href="#${url}" class="link internal">#${url}</a>`;
      }
    );
  }



  if (markdownLinkPattern.test(div.innerText)) {
    div.innerHTML = div.innerHTML.replace(
      markdownLinkPattern,
      (match, previousChar, title, url) => {
        let cssClasses = ["link"];
        if (previousChar === ">" || previousChar === "\\") {
          return match;
        }
        if (previousChar === "!") {
          // image
          cssClasses.push("image");
          return `<a href="${url}" class="${cssClasses.join(" ")}">${
            previousChar || ""
          }[${title}](${url})</a>`;
        }
        // title tag messes up html, don't use it
        // let titleEscaped = title ? stripTags(title).replace('"', "'") : '';
        return `${previousChar || ""}<a href="${url}" class="${cssClasses.join(
          " "
        )}">[${title}](${url})</a>`;
      }
    );
  }

  function transformInlineHttpUrlsToATags(html) {
    // in regex: `;` is not allowed in urls, but it is allowed here because html entities are not converted yet
    // look for pure url which can be converted to links
    const linkUrlPattern =
      /(.{0,1})(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=;]*))(.{0,1}|)/g;

    // look for links without markdown syntax
    if (linkUrlPattern.test(html)) {
      return html.replace(
        linkUrlPattern,
        (match, previousChar, url, _, appendix, next) => {
          // if url is followed by ; it may be html-entity... anyway, don't transform to an a-tag
          if (url.at(-1) === ";") {
            return match;
          }
          // appendix can be `&gt` and next `;`
          if ([">", "[", "(", '"', "'", "\\"].includes(previousChar)) {
            return match;
          }
          // remove trailing entities
          url = url.replace(/\&[a-zA-Z]+$/, "");
          next = next || "";
          if (next === ";" && /\&[a-zA-Z]+$/.test(appendix)) {
            next = appendix.match(/\&[a-zA-Z]+$/)[0] + next;
          }
          appendix = "";
          return `${previousChar}<a href="${url}" class="link direct">${url}</a>${appendix}${next}`;
        }
      );
    }
    // nothing found
    return null;
  }

  let foundHttpUrls = false;
  div.innerHTML = div.innerHTML
    .split("&nbsp;")
    .map((innerHTML) => {
      let html = transformInlineHttpUrlsToATags(innerHTML);
      if (!foundHttpUrls && html) {
        foundHttpUrls = true;
      }
      return html || innerHTML;
    })
    .join("&nbsp;");

  if (foundHttpUrls) {
    div.querySelectorAll("a.direct.link").forEach((a) => {
      a.innerText = a.innerText.trim();
    });
  }

  div.querySelectorAll("a.link").forEach(reAssignClickEvents);
  stylePageReferences(div);
}

function stylePageReferences(div) {
  if (/\[\^[^\]]+?\]/.test(div.innerText)) {
    function assignClickOnPageReference(ev) {
      // find the target
      let name = ev.target.href.replace(/^.+?\#/, "#");
      let targetElements = ev.target
        .closest(".content-holder")
        .querySelectorAll(`a[href="${name}"]`);
      if (targetElements.length < 2) {
        // if the link was not visible (yet) it will not be found here
        // so try to find it by its text…
        let foundElements = [...ev.target.closest('.content-holder').querySelectorAll(':scope > div')].filter((d) => {
          return d.innerText.includes(ev.target.innerText.trim());
        });
        if (foundElements.length <= 1) {
          console.warn(`No target found for page reference ${name}`);
          return;
        }
        targetElements = foundElements;
      }
      ev.preventDefault();

      let targetElement = [...targetElements].pop();
      targetElement.scrollIntoView({
        /*behavior: "instant",*/ block: "center"
      });
      Cursor.setCurrentCursorPosition(0, targetElement);
    }

    div.innerHTML = div.innerHTML.replace(
      /(.{0,1})(\[\^[^\]]+?\])(.{0,1})/g,
      (match, before, inner, after) => {
        if ([">", "[", "]", ")", "(", '"', "'", "\\"].includes(before)) {
          return match;
        }

        return `${before}<a href="#${slugify(
          inner.substr(2).replace(/\]$/, "")
        )}" class="page-reference">${inner}</a>${after}`;
      }
    );
    div.querySelectorAll("a.page-reference").forEach((a) => {
      a.removeEventListener("dblclick", assignClickOnPageReference);
      a.addEventListener("dblclick", assignClickOnPageReference);
    });
  }
}

export function blockquotes(div) {
  if (div.classList.contains("fenced-code-block")) {
    return;
  }
  if (/^\>\s+/.test(div.innerText.trim())) {
    div.classList.add("blockquote");
  } else {
    div.classList.remove("blockquote");
  }
}

export function markFencedCodeBlocks(elements) {
  let maxEmptyLines = 50;
  let isFencedCodeBlock = false;
  let emptyLinesCount = 0;
  let fencedCodeBlocks = [];
  elements.forEach((div, i) => {
    if (div.innerText.startsWith("```")) {
      if (
        fencedCodeBlocks.at(-1) === undefined ||
        fencedCodeBlocks.at(-1)[0] === "end"
      ) {
        fencedCodeBlocks.push(["begin", i]);
        return;
      }
    }
    if (div.innerText.trim().endsWith("```")) {
      fencedCodeBlocks.push(["end", i]);
    }
  });
  let groups = [];
  fencedCodeBlocks.forEach((codeBlock, i) => {
    let [beginOrEnd, j] = codeBlock;
    if (!codeBlock[0] || fencedCodeBlocks[i + 1] === undefined) {
      // has been deleted before
      return;
    }
    if (codeBlock[0] === "begin" && fencedCodeBlocks[i + 1][0] === "end") {
      groups.push([codeBlock[1], fencedCodeBlocks[i + 1][1]]);
      fencedCodeBlocks[i + 1][0] = null;
    }
  });

  function markDivAsFencesCodeBlock(div, i) {
    function markAsFencedCodeBlock(div) {
      div.classList.add("fenced-code-block");
      [...div.classList]
        .filter(
          (c) =>
            !["active", "fenced-code-block", "cursor-inside", "new"].includes(c)
        )
        .forEach((c) => div.classList.remove(c));
    }

    if (isFencedCodeBlock) {
      markAsFencedCodeBlock(div);
    } else {
      div.classList.remove("fenced-code-block");
      div.classList.remove("first-fenced-code-block");
      div.classList.remove("last-fenced-code-block");
    }
    if (div.innerText.startsWith("```")) {
      isFencedCodeBlock = !isFencedCodeBlock;
      if (isFencedCodeBlock) {
        markAsFencedCodeBlock(div);
        if (
          div.previousElementSibling &&
          !div.previousElementSibling.classList.contains("fenced-code-block")
        ) {
          div.classList.add("first-fenced-code-block");
        }
      } else {
        div.classList.add("last-fenced-code-block");
      }
    }

    // count empty lines, to prevent code blocks from being too long without closing ```
    if (div.innerText.trim() === "") {
      emptyLinesCount++;
    } else {
      emptyLinesCount = 0;
    }
    if (isFencedCodeBlock) {
      if (emptyLinesCount > maxEmptyLines) {
        isFencedCodeBlock = false;
      }
    }
    if (!isFencedCodeBlock) {
      emptyLinesCount = 0;
    }
  }

  groups.forEach((groupRange) => {
    [...elements]
      .slice(groupRange[0], groupRange[1] + 1)
      .forEach(markDivAsFencesCodeBlock);
  });

  let elementsWithFencesCodeBlock = groups.map((groupRange) => {
    return arrayOfRangeNumbers(groupRange[0], groupRange[1]);
  });
  elementsWithFencesCodeBlock = elementsWithFencesCodeBlock.flat();
  [...elements]
    .filter(
      (el, i) =>
        el.classList.contains("fenced-code-block") &&
        elementsWithFencesCodeBlock.indexOf(i) === -1
    )
    .forEach((el, i) => {
      el.classList.remove("fenced-code-block");
    });
}

export function preIndentElement(child) {
  if (preIndentPattern.test(child.innerText)) {
    removeStyleClasses(child);
    child.classList.add("pre-indent");
  }
}

export function convertObsoleteElementsToSpan(child) {
  if (child.children.length > 0) {
    [...child.children].forEach(convertObsoleteElementsToSpan);
  }

  if (child.tagName === "DIV") {
    if (
      child.classList.contains("blockquote") &&
      !/^\>\s+/.test(child.innerText)
    ) {
      child.classList.remove("blockquote");
    }
    if (
      child.classList.contains("pre-indent") &&
      !/^\s{2,}/.test(child.innerText)
    ) {
      child.classList.remove("pre-indent");
    }

    return;
  }

  if (
    child.tagName === "CODE" &&
    !/^`[^\`].*?[^`]`$/.test(child.innerText.trim())
  ) {
    return removeElementAndPlaceItsContentInParentElement(child);
  }
  if (child.tagName === "B" && !child.innerHTML.match(/^\*\*.+\*\*$/)) {
    return removeElementAndPlaceItsContentInParentElement(child);
  }
  if (child.tagName === "I" && !child.innerHTML.match(/^\*[^\*].*?\*$/)) {
    return removeElementAndPlaceItsContentInParentElement(child);
  }
  if (child.tagName === "S" && !child.innerHTML.match(/^\~\~.+?\~\~$/)) {
    return removeElementAndPlaceItsContentInParentElement(child);
  }
}
