import { useEffect, useState, useRef } from "react";
import { useInterval } from "usehooks-ts";
import { Cursor } from "./Cursor";
import "./FocusEditor.scss";

// TODO: replace Cursor.setCurrentCursorPosition -> putCursorIntoElement

import {
  styleText,
  markFencedCodeBlocks,
  styleLinks,
  blockquotes,
  removeStyleClassesOfNotMatchingMarkdownSyntax,
  createBRIfIsEmpty,
  removeStyleClasses,
  preIndentElement
} from "./styleText";
import {
  isSafari,
  rtrim,
  isFirefox,
  someTextIsHighlighted,
  isTouchDevice,
  rtrimSourroundindElements,
  currentElementInsideContentHolderWithCaret,
  putCursorIntoElement,
  elementToAppearOrDisappear
} from "./helper";

import TurndownService from "turndown";

let defaultKeyboardShortcuts = {
  focus: "Period"
};

const onActionStub = () => null;

export function FocusEditor({
  initialText,
  initialActiveElementIndex,
  initialCaretPosition,
  startWithCaretAtEnd,
  focusMode,
  identifier,
  /* max text length is text but spaces excluded, TODO: fix this */
  maxTextLength,
  forcePlainText,
  onPaste,
  onChange,
  onAfterInitialize,
  keyboardShortcuts,
  scrollWindowToCenterCaret,
  readOnly,
  placeholder,
  indentHeadings,
  preventUnfocusViaTabKey,
  forwardRef,
  showNumberOfParagraphs = true,
  onKeyDown,
  onKeyUp,
  guessNextLinePrefixOnEnter = false,
  preIndent = false,
  disableFocusWhenTextIsSelected = false,
  renderAllContent = false,
  showPictureOnImageHover = false
} = {}) {
  if (!onChange) {
    onChange = onActionStub;
  }

  if (!keyboardShortcuts && keyboardShortcuts !== false) {
    keyboardShortcuts = {};
  }

  if (!onAfterInitialize) {
    onAfterInitialize = onActionStub;
  }

  keyboardShortcuts = keyboardShortcuts
    ? { ...defaultKeyboardShortcuts, ...keyboardShortcuts }
    : {};

  const [text, setText] = useState(null);
  const [focus, setFocus] = useState(focusMode || false);
  const [tempDisableFocus, setTempDisableFocus] = useState(false);
  const [lastChangedAt, setLastChangedAt] = useState(0);
  const [contentEditableHasContent, setContentEditableHasContent] =
    useState(false);
  const [isProcessing, setIsProcessing] = useState(true);
  const [maxContentLengthReached, setMaxContentLengthReached] = useState(false);
  const [metaOrAltKeyPressed, setMetaOrAltKeyPressed] = useState(false);
  const [shiftKeyPressed, setShiftKeyPressed] = useState(false);
  const [guessNextListItemLine, setGuessNextListItemLine] = useState(
    !!guessNextLinePrefixOnEnter
  );
  const [preIndentation, setPreIndentation] = useState(preIndent || false);
  const [hasContent, setHasContent] = useState(false);

  const ref = useRef(null);
  const refContentHolder = useRef(null);

  function getContentEditableHolderReference() {
    return (ref && ref.current) || documentOrShadow()?.shadowRoot;
  }

  function documentOrShadow() {
    let hasShadowRoot =
      ref?.current?.parentElement?.parentNode?.constructor === ShadowRoot;
    if (hasShadowRoot) {
      // let css = document.querySelector("link[href*='webcomponent']");
      // let link = document.createElement('link');
      // link.setAttribute('rel', 'stylesheet');
      // link.setAttribute('href', 'whatever.css');
      // ref.current.parentElement.parentNode.appendChild(css);
    }
    return hasShadowRoot ? ref?.current?.parentElement?.parentNode : document;
  }

  function placeCursorAtTheBeginningOfElement(activeElementIndex) {
    let current = [
      ...refContentHolder.current.querySelectorAll(":scope > div")
    ][activeElementIndex - 1];
    if (!current) {
      // fallback
      current = refContentHolder.current.querySelector(":scope > div");
    }
    if (!current) {
      console.warn("no active element found");
      return;
    }
    setTimeout(() => {
      current.focus({ focusVisible: true, preventScroll: false });
      current.scrollIntoView();
      try {
        Cursor.setCurrentCursorPosition(0, current);
        refContentHolder.current
          .querySelectorAll(":scope > div.active, :scope > div.cursor-inside")
          .forEach((el) => {
            el.classList.remove("active");
            el.classList.remove("cursor-inside");
          });
        current.classList.add("cursor-inside");
        current.classList.add("active");
      } catch (e) {
        // ignore
      }
      if (scrollWindowToCenterCaret) {
        try {
          scrollCaretToCenter();
        } catch (e) {
          // ignore
          console.warn(e);
        }
      }
    }, 1);
  }

  function triggerLastChangedAt() {
    setLastChangedAt(new Date().getTime());
  }

  function initializeText(text) {
    if (!getContentEditableHolderReference()) {
      console.warn("editor is not (yet) ready");
      return;
    }

    if (maxTextLength > 0 && text.length > maxTextLength) {
      text = text.slice(0, maxTextLength + text.match(/\s/g).length) + "…";
      setMaxContentLengthReached(true);
    }

    // allows to use more than one space with setting innerText
    text = text.replace(/ {2}/g, "⇪2spcs⇪");

    [...getContentEditableHolderReference().children].forEach((child) =>
      child.remove()
    );

    let div = refContentHolder.current;
    // remove trailing whitespaces
    text = text
      .split("\n")
      .map((l) => l.replace(/\s+$/, ""))
      .join("\n");
    div.innerText = text;

    div.innerHTML = div.innerHTML
      .replace(/⇪2spcs⇪/g, "&nbsp;&nbsp;")
      .replace(/<div><\/div>/g, "<br>")
      .split("<br>")
      .map((line) => {
        return `<div>${line || "<br>"}</div>`;
      })
      .join("\n");

    getContentEditableHolderReference().appendChild(div);
    if (initialActiveElementIndex >= 0) {
      placeCursorAtTheBeginningOfElement(initialActiveElementIndex);
    }
    triggerLastChangedAt();
    return text;
  }

  useEffect(() => {
    setFocus(!!focusMode);
  }, [focusMode]);

  useEffect(() => {
    setGuessNextListItemLine(!!guessNextLinePrefixOnEnter);
  }, [guessNextLinePrefixOnEnter]);

  useEffect(() => {
    if (lastChangedAt) {
      let hasText =
        getContentEditableHolderReference()?.innerText?.trim() ||
        getContentEditableHolderReference()?.innerText?.match(/\n/g)?.length >
          1 ||
        getContentEditableHolderReference()?.innerText === " ";
      if (
        isFirefox() &&
        getContentEditableHolderReference().innerText === "\n"
      ) {
        hasText = false;
      }
      setContentEditableHasContent(!!hasText);
      // if (!hasText && someTextIsHighlightedInEditor(getContentEditableHolderReference())) {
      //   deselectAll();
      // }
    }
  }, [placeholder, lastChangedAt, getContentEditableHolderReference()]);

  useEffect(() => {
    triggerLastChangedAt();
    if (text === null) {
      // load initial text
      let previousText = initialText;
      setIsProcessing(false);
      if (previousText) {
        previousText = initializeText(previousText);
        setText(previousText);
      } else {
        initializeText("");
        setTimeout(
          () => {
            Cursor.setCurrentCursorPosition(
              0,
              refContentHolder.current.querySelector(":scope > div")
            );
          },
          isSafari() ? 100 : 10
        );
      }
      return;
    }
  }, [text]);

  useEffect(() => {
    if (focus && !text) {
      setTimeout(() => {
        let active = currentElementInsideContentHolderWithCaret(
          getContentEditableHolderReference()
        );
        let el = refContentHolder.current.querySelector(":scope > div");
        let isDiv = active.tagName === "DIV";
        if (!active || !isDiv) {
          // sometimes the initial element is not selected (i.e. instead of a div the body is selected)
          // force caret to be placed in the first div of editable area
          active = el;
        }
        if (active) {
          active.classList.add("cursor-inside");
          active.classList.add("active");
          Cursor.setCurrentCursorPosition(0, active);
        }
      }, 100);
    }
  }, [focus, text]);

  useEffect(() => {
    if (renderAllContent) {
      styleMarkdown(getContentEditableHolderReference(), {
        styleAll: true
      });
    }
  }, [renderAllContent]);

  useEffect(() => {
    try {
      initializeText(initialText || "");
      setText(initialText || "");
      setIsProcessing(true);
      if (Number(initialCaretPosition) >= 0) {
        setTimeout(() => {
          Cursor.setCurrentCursorPosition(
            Number(initialCaretPosition),
            getContentEditableHolderReference()
          );
        }, 1);
      }
      if (getContentEditableHolderReference().innerText.trim()) {
        styleMarkdown(getContentEditableHolderReference(), {
          styleAllVisible: true
        });
      }
      setIsProcessing(false);

      if (initialText !== undefined) {
        // otherwise it may be triggered twice
        onAfterInitialize();
      }

      // restore caret position
      if (!startWithCaretAtEnd) {
        return;
      }
      let activeElement = currentElementInsideContentHolderWithCaret(
        getContentEditableHolderReference()
      );

      if (!activeElement && initialActiveElementIndex >= 0) {
        placeCursorAtTheBeginningOfElement(initialActiveElementIndex);
      } else if (activeElement) {
        Cursor.setCurrentCursorPosition(
          activeElement.innerText.length,
          activeElement
        );
      }
    } catch (e) {
      // if editor is created (and removed) in the same render cycle
      // we get errors because not existing elements
      // anyway, we remove the processing flag so that the content can be accessed
      // it will be re-rendered anyway
      setIsProcessing(false);
      console.warn("editor could not be initialized", e);
      if (!e.name.match(/IndexSizeError/)) {
        throw e;
      } else {
        // try again and again after updating react states
        setIsProcessing(true);
        let tries = 0;
        let intervalID = setInterval(() => {
          try {
            styleMarkdown(getContentEditableHolderReference(), {
              styleAllVisible: true
            });
            setIsProcessing(false);
            clearInterval(intervalID);
          } catch (e) {
            console.warn(e);
          }
          tries++;
          if (tries > 10) {
            clearInterval(intervalID);
            console.warn("could not initialize editor. giving up");
          }
        }, 10);
      }
    }
  }, [initialText, initialCaretPosition]);

  useEffect(() => {
    if (initialActiveElementIndex >= 0) {
      placeCursorAtTheBeginningOfElement(initialActiveElementIndex);
    }
  }, [initialActiveElementIndex]);

  useInterval(
    () => {
      // disable focus for the time a text is selected
      if (focus && someTextIsHighlighted()) {
        setTempDisableFocus(true);
      } else {
        setTempDisableFocus(false);
      }
    },
    disableFocusWhenTextIsSelected ? 100 : null
  );

  function activeElementIndex(elementWithCursorInside = null) {
    if (!elementWithCursorInside) {
      elementWithCursorInside = currentElementInsideContentHolderWithCaret(
        getContentEditableHolderReference()
      );
    }
    return [
      ...refContentHolder.current.querySelectorAll(":scope > div")
    ].indexOf(elementWithCursorInside);
  }

  function addCursorInsideClassForActiveElement(elementWithCursorInside) {
    // set cursor-inside class to simulate focus/blur
    if (elementWithCursorInside === undefined) {
      elementWithCursorInside = currentElementInsideContentHolderWithCaret(
        getContentEditableHolderReference()
      );
    }
    if (!elementWithCursorInside) {
      console.warn("no active element found or given");
      return;
    }
    getContentEditableHolderReference()
      .querySelectorAll(".cursor-inside")
      .forEach((el) => el.classList.remove("cursor-inside"));
    if (
      !elementWithCursorInside.classList.contains("content-holder")
      //!elementWithCursorInside.contentEditable
    ) {
      onChange({
        activeElementIndex: activeElementIndex(),
        caretPosition: Cursor.getCurrentCursorPosition(
          getContentEditableHolderReference()
        )
      });
      if (elementWithCursorInside.tagName !== "DIV") {
        // TODO: fix cleanup of class `having-cursor-inside`
        elementWithCursorInside
          .closest("div")
          .classList.add("having-cursor-inside");
      }
      elementWithCursorInside.classList.add("cursor-inside");
    }
  }

  function removeStyleClassesOfNotMatchingMarkdownSyntaxOfActiveElement() {
    if (!getContentEditableHolderReference()) {
      console.error("editor is not available");
      return;
    }
    let activeElements = [
      refContentHolder.current.querySelector(":scope > div.active") ||
        currentElementInsideContentHolderWithCaret(
          getContentEditableHolderReference()
        )
      // TODO: remove:
      // getContentEditableHolderReference().querySelector(
      //   "div.content-holder > div"
      // )
    ];
    activeElements.forEach(removeStyleClassesOfNotMatchingMarkdownSyntax);

    // remove fenced code block class if not matching
    activeElements.forEach((el) => {
      if (!el) {
        console.warn("el is not available (anymore)");
        return;
      }
      if (
        el.classList.contains("first-fenced-code-block") &&
        !/^```/.test(el.innerText)
      ) {
        el.classList.remove("first-fenced-code-block");
        el.classList.remove("fenced-code-block");
        let nextElementSibling = el.nextElementSibling;
        while (
          nextElementSibling &&
          nextElementSibling.classList.contains("fenced-code-block")
        ) {
          nextElementSibling.classList.remove("fenced-code-block");
          nextElementSibling = nextElementSibling.nextElementSibling;
        }
      }
    });
    return activeElements;
  }

  function scrollCaretToCenter() {
    if (!Cursor.getCaretGlobalPosition()) {
      return;
    }

    if (
      getContentEditableHolderReference().parentElement?.getBoundingClientRect()
        ?.height > window.innerHeight
    ) {
      // scroll window
      let { top } = Cursor.getCaretGlobalPosition();
      if (top) {
        let newTop = top - window.innerHeight / 2;
        window.scrollTo(0, newTop);
      }
    } else {
      /*
      if (ev?.target) {
        // scroll editor div
        let parent = ev.target;
        let { top } = Cursor.getCaretPositionRelativTo(parent);
        let height = parent.getBoundingClientRect().height;
        let newTop = top - height / 2;
        parent.scrollTo({ top: newTop, behavior: "instant" });
        return;
      }
      */
    }
  }

  function checkForSelectedElementsOnTab(ev) {
    ev.preventDefault();

    // TODO: not working
    // return;
    let elements =
      getContentEditableHolderReference().querySelectorAll(
        ":scope > div > div"
      );
    let selectedDivs = [...elements].filter((el) =>
      window.getSelection().containsNode(el)
    );
    if (selectedDivs.length === 0) {
      if (typeof window.getSelection().focusNode?.textContent) {
        // find selected div via text
        selectedDivs = [...elements].filter(
          (ev) => ev.innerText === window.getSelection().focusNode.textContent
        );
      }
      if (selectedDivs.length !== 1) {
        return;
      }
    } else {
      if (selectedDivs[0].previousElementSibling) {
        selectedDivs.unshift(selectedDivs[0].previousElementSibling);
      }
      if (selectedDivs.at(-1).nextElementSibling) {
        selectedDivs.push(selectedDivs.at(-1).nextElementSibling);
      }
    }

    const selection = window.getSelection();

    selectedDivs.forEach((el) => {
      if (!el.innerText.trim()) {
        return;
      }
      el.innerHTML = ev.shiftKey
        ? el.innerHTML.replace(/^(&nbsp;|\s){2}/, "")
        : (el.innerHTML = "&nbsp;&nbsp;" + el.innerHTML);
    });
    setTimeout(() => {
      let intervalID = setInterval(() => {
        if (someTextIsHighlighted()) {
          clearInterval(intervalID);
          return;
        }
        selection.setBaseAndExtent(
          selectedDivs.at(0),
          0,
          selectedDivs.at(-1),
          1
        );
      }, 50);
    }, 200);
  }

  function handleKeyDown(ev) {
    if (onKeyDown && onKeyDown(ev) === "preventEditorDefault") {
      return;
    }
    setMetaOrAltKeyPressed(ev.metaKey || ev.altKey);
    setShiftKeyPressed(ev.shiftKey);
    if (readOnly) {
      return;
    }

    if (
      getContentEditableHolderReference().parentElement?.closest("focus-editor")
    ) {
      let controlKey = /^(Alt|Shift|Arrow|Meta|Escape)/.test(ev.code);
      let el =
        getContentEditableHolderReference().parentElement?.closest(
          "focus-editor"
        );
      if (!controlKey) {
        el.classList.add("hide-placeholder");
      }
    }
    if (ev.key === "Dead") {
      return;
    }

    setMaxContentLengthReached(false);
    // indent or outdent via TAB
    triggerLastChangedAt();
    let cursorPosition = Cursor.getCurrentCursorPosition(
      getContentEditableHolderReference()
    );
    const activeElement = currentElementInsideContentHolderWithCaret(
      getContentEditableHolderReference()
    );

    const caretIsAtTheEndOfElement =
      Cursor.getCurrentCursorPosition(getContentEditableHolderReference()) >=
      activeElement?.innerText?.length;
    if (ev.code === "Tab") {
      let editor = getContentEditableHolderReference();
      // prevent editor catching all tabs if it is not used as main element on the document
      if (!preventUnfocusViaTabKey) {
        let cursorPosition = Cursor.getCurrentCursorPosition(editor);
        let textLengthWithoutLinebreaks = editor.innerText.replace(
          /\n/g,
          ""
        ).length;
        // let browser select next or previous element with tab is caret
        // is at the beginning or end
        if (
          !editor.innerText.trim() &&
          cursorPosition - 1 <= textLengthWithoutLinebreaks
        ) {
          return;
        }

        if (!ev.shiftKey && cursorPosition >= textLengthWithoutLinebreaks) {
          return;
        }
        if (ev.shiftKey && cursorPosition === 0) {
          return;
        }
      }

      ev.preventDefault();

      let activeElement = currentElementInsideContentHolderWithCaret(
        getContentEditableHolderReference()
      );

      if (activeElement) {
        if (someTextIsHighlighted()) {
          // don't indent or outdent when text is highlighted
          // because we can't take selected text into account; so
          // instead of indenting or outdenting text which is
          // not actually selected by user, we just skip the event
          // and prevent default behaviour (change focus to next/previous element)

          checkForSelectedElementsOnTab(ev);
          // ev.preventDefault();
          return;
        }

        // TODO: quick hack, until tab behaviour is fixed
        if (!ev.shiftKey) {
          document.execCommand("insertText", false, "  ");
          return;
        }

        if (!/^\s+/.test(activeElement.innerText)) {
          return;
        }

        if (ev.shiftKey) {
          // outdent

          if (activeElement.innerText.trim() === "") {
            return;
          }

          activeElement.innerHTML = activeElement.innerHTML.replace(
            /^(&nbsp;|\s){2}/,
            ""
          );
          let spaces = activeElement.innerText.match(/^\s+/);

          if (!spaces) {
            Cursor.setCurrentCursorPosition(0, activeElement);
          } else {
            // set cursor to beginning of line (after spaces) or to the end of the line
            Cursor.setCurrentCursorPosition(
              spaces && spaces[0]
                ? spaces[0].length
                : activeElement.innerText.length,
              activeElement
            );
          }
        }
        return;
      }
    }

    if (ev) {
      /**
       * We replace the browser defaults behaviour on hitting ENTER here, because:
       *   * new inserted elements sometimes have no content
       *   * new inserted elements sometimes have the same classes as the current active
       */
      if (ev.code === "Enter") {
        let addEmptyPrefixSpaces = "";
        // let activeElement = currentElementInsideContentHolderWithCaret(
        //   getContentEditableHolderReference()
        // );
        if (!activeElement) {
          return;
        }
        let cursorPosition = Cursor.getCurrentCursorPosition(activeElement);
        ev.preventDefault();

        let div = document.createElement("DIV");

        div.innerHTML = "<br>"; // safari &nbsp;?

        const caretIsAtTheBeginningOfElement = cursorPosition === 0;

        if (
          caretIsAtTheBeginningOfElement &&
          activeElement.innerText.trim() !== ""
        ) {
          // caret is at the beginnen, insert new line above
          activeElement.before(div);
        } else {
          // insert new line after (default)
          // split text?
          if (
            activeElement.innerText.length > 0 &&
            cursorPosition > 0 &&
            cursorPosition < activeElement.innerText.length
          ) {
            if (
              addEmptyPrefixSpaces !== false &&
              activeElement.innerText.match(/^\s+/)
            ) {
              addEmptyPrefixSpaces = activeElement.innerText.match(/^\s+/)[0];
            }
            let text = [
              activeElement.innerText.substring(0, cursorPosition),
              activeElement.innerText.substring(cursorPosition)
            ].filter((e) => e !== undefined);
            if (text.length == 2) {
              activeElement.innerText = text[0];
              div.innerText = addEmptyPrefixSpaces + text[1];

              // TODO: fix this
              setTimeout(() => {
                Cursor.setCurrentCursorPosition(
                  addEmptyPrefixSpaces.length,
                  div
                );
              }, 1);
            }
          }
          activeElement.classList.remove("active");
          activeElement.classList.remove("cursor-inside");
          div.classList.add("active");
          div.classList.add("cursor-inside");
          activeElement.after(div);
          Cursor.setCurrentCursorPosition(0, div);
        }

        activeElement.innerText = rtrim(activeElement.innerText);
        styleMarkdown([activeElement, div], {
          onlyStyleGivenElements: true,
          preIndentation
        });
        setTimeout(() => {
          if (activeElement.innerHTML.trim() === "") {
            activeElement.innerHTML = "<br>";
          }

          if (guessNextListItemLine && caretIsAtTheEndOfElement) {
            /**
             * Suggest a new list item on hitting Enter
             *  */

            if (
              /^\s*([\*\-\·\•\+\>\|]{1}|\d+\.)\s*$/.test(
                activeElement.innerText
              )
            ) {
              // last entered new line is an empty list, so clear it
              activeElement.innerHTML = "<br>";
              removeStyleClasses(activeElement);
            } else if (
              /^(\s*)([\*\-\·\•\+\>\|]{1}\s+)/.test(activeElement.innerText)
            ) {
              let parts = activeElement.innerText.match(
                /^(\s*)([\*\-\·\•\+\>\|]{1}\s+)/
              );
              let add = (parts[0] || "") + (parts[1] || "");
              let textBefore = div.innerText;
              div.innerText = rtrim(add);
              div.innerHTML += "&nbsp;";
              let newCursorPosition = div.innerText.length;
              div.innerText += textBefore;
              setTimeout(() => {
                Cursor.setCurrentCursorPosition(newCursorPosition, div);
              }, 1);
            } else if (
              /^(\s*)(\d{1,}[\.\)])\s+/.test(activeElement.innerText)
            ) {
              let parts = activeElement.innerText.match(
                /^(\s*)(\d{1,}[\.\)])(\s+)*/
              );
              let spaces = parts[1] || "";
              let number = parts[2] || "";
              let spacesAfter = parts[3] || " ";
              number = number.replace(/\d+/, (match) => Number(match) + 1);
              let textBefore = div.innerText;
              div.innerText = spaces + number + spacesAfter;
              div.innerHTML = div.innerHTML.replace(/\s/g, "&nbsp;");
              let newCursorPosition = div.innerText.length;
              div.innerText += textBefore;
              setTimeout(() => {
                Cursor.setCurrentCursorPosition(newCursorPosition, div);
              }, 1);
            } else if (/^\s{2,}/.test(activeElement.innerText)) {
              let textBefore = div.innerText;
              div.innerText = activeElement.innerText.match(/^\s{2,}/)[0];
              div.innerHTML = div.innerHTML.replace(/\s/g, "&nbsp;");
              let newCursorPosition = div.innerText.length;
              div.innerText += textBefore;
              setTimeout(() => {
                Cursor.setCurrentCursorPosition(newCursorPosition, div);
              }, 1);
            }
          }
        }, 0);
        // return;
      }
      if (ev.code === "Backspace") {
        if (
          refContentHolder.current.querySelectorAll(":scope > div").length ===
            1 &&
          refContentHolder.current.querySelector(":scope > div").innerHTML ===
            "<br>"
        ) {
          // prevents deleting the contenteditable container
          ev.preventDefault();
          return;
        }
      }
      if (ev.code === "Enter" && ev.shiftKey) {
        // prevent adding <br> which would break the markdown approach
        // TODO: fix this by creating a new div after instead of <br>
        ev.preventDefault();
      }

      if (
        /^(Alt|Shift|Arrow|Meta)/.test(ev.code) ||
        ev.altKey ||
        ev.ctrlKey ||
        ev.code === "Backspace" ||
        ev.metaKey ||
        ev.code === "Enter" ||
        ev.code === "Tab"
      ) {
        createBRIfIsEmpty(
          removeStyleClassesOfNotMatchingMarkdownSyntaxOfActiveElement()
        );

        /*
         * e.g. if you delete all text, the new active empty div
         * may contain previos class (e.g. heading).
         * If that's the case, clean up classes on active element
         * to garantue a fresh start
         */

        if (
          ev.code === "Backspace" ||
          ev.code === "Tab" ||
          ev.altKey ||
          ev.ctrlKey ||
          ev.metaKey
        ) {
          setTimeout(() => {
            let activeElement = currentElementInsideContentHolderWithCaret(
              getContentEditableHolderReference()
            );

            if (!activeElement) return;

            if (activeElement.tagName === "FOCUS-EDITOR") {
              console.warn("activeElement is focus-editor");
              return;
            }
            if (activeElement.classList.contains("editor")) {
              console.warn("activeElement is editor");
              return;
            }
            if (activeElement && !activeElement.innerText.trim()) {
              activeElement.removeAttribute("class");
              activeElement.classList.add("active");
            }
          }, 0);
          // return;
        }
      } else {
        if (
          maxTextLength > 0 &&
          getContentEditableHolderReference().innerText.replace(/\s/g, "")
            .length > maxTextLength
        ) {
          setMaxContentLengthReached(true);
          // TODO: make a proper check if text length. Currentlt there is a mismatch
          ev.preventDefault();
          // return;
        }
      }
    }

    if (
      ev.code === "Backspace" ||
      /^(Arrow)/.test(ev.code) /* enter is handled below */
    ) {
      let activeElement = currentElementInsideContentHolderWithCaret(
        getContentEditableHolderReference()
      );
      rtrimSourroundindElements(activeElement);
    }

    if (ev.code === "Enter") {
      return;
    }

    if (ev.ctrlKey || ev.metaKey) {
      if (ev.code === keyboardShortcuts.focus) {
        setFocus(!focus);
      }
      if (ev.code === "KeyA") {
        // prevents deselecting when editable was changed; 500ms/10ms is just a wild guess…
        let checkStartedAt = new Date().getTime();
        let intervalOfCheckAllIsSelected = setInterval(() => {
          if (checkStartedAt + 500 >= new Date().getTime()) {
            document.execCommand("selectAll", false, null);
          } else {
            clearInterval(intervalOfCheckAllIsSelected);
          }
        }, 5);
      }

      // TODO: replace activeElementInsideContentHolderWithCursorInside/activeDivWithCursorInside with
      if (ev.code === "KeyX" && !someTextIsHighlighted()) {
        let activeElement = currentElementInsideContentHolderWithCaret(
          getContentEditableHolderReference()
        );
        if (activeElement) {
          // copy to clipbaord
          navigator.clipboard.writeText(activeElement.innerText);
          if (activeElement.nextElementSibling) {
            putCursorIntoElement(
              activeElement.nextElementSibling,
              getContentEditableHolderReference()
            );
          }
          activeElement.remove();
        }
      }
    }
  }

  function rtrimmedTextOfContentEditable() {
    let editor = getContentEditableHolderReference();
    let text = isSafari()
      ? editor.innerText
      : editor.innerText.replace(/\n\n/g, "\n");

    // trim trailing whitespace
    return text.split("\n").map(rtrim).join("\n");
  }

  function handleKeyUp(ev = null) {
    if (onKeyUp && onKeyUp(ev, { text: "" }) === "preventEditorDefault") {
      return;
    }
    if (ev) {
      setMetaOrAltKeyPressed(ev.metaKey || ev.altKey);
    }
    if (readOnly) {
      return;
    }
    if (ev?.key === "Dead") {
      return;
    }

    if (guessNextListItemLine && ev.code === "Enter") {
      ev?.preventDefault();
      return;
    }

    let editor = ev ? ev.target : getContentEditableHolderReference();

    let newText = rtrimmedTextOfContentEditable();

    if (text !== newText) {
      onChange({
        text: newText,
        caretPosition: Cursor.getCurrentCursorPosition(
          getContentEditableHolderReference()
        )
      });
      triggerLastChangedAt();
    }

    let cursorPosition = Cursor.getCurrentCursorPosition(editor);

    if (ev?.code === "Backspace") {
      // IF ANY PROBLEM OCCURS WITH BACKSPACE BEHAVIOUR, UNCOMMENT THE LINE BELOW
      // ev.code === "Backspace" ||
      if (
        Cursor.getCurrentCursorPosition(
          currentElementInsideContentHolderWithCaret(
            getContentEditableHolderReference()
          )
        ) <= 0
      ) {
        // if the caret is at the beginning of line
        // while hitting backspace, the caret jumps to
        // previous element with text and leves out empty lines
        // because of the re-adjusting the caret…
        // so, just skip the re-adjusting in that case
        ev.preventDefault();
      }
      let activeElement = currentElementInsideContentHolderWithCaret(
        getContentEditableHolderReference()
      );
      if (activeElement) {
        let cursorPositionInElement =
          Cursor.getCurrentCursorPosition(activeElement);
        // prevent cursor jumping
        setTimeout(() => {
          Cursor.setCurrentCursorPosition(
            cursorPositionInElement,
            activeElement
          );
        }, 1);
      }
    }

    if (ev.code === "Enter") {
      // wait for the new div to be created by browser via contenteditable
      setTimeout(() => {
        let activeElement = currentElementInsideContentHolderWithCaret(
          getContentEditableHolderReference()
        );
        if (!activeElement.nextElementSibling) {
          return;
        }
        // clean up newly cretated nested element by browser, e.g. <div><code><br></code></div>
        activeElement.innerText = activeElement.innerText;
        if (
          activeElement.nextElementSibling.innerHTML === "<br>" &&
          [...activeElement.classList].sort().toString() ===
            [...activeElement.nextElementSibling.classList].sort().toString()
        ) {
          // cleanup active elements, remove all copied classes
          let newCreatedElementByPressingEnter =
            activeElement.nextElementSibling;
          refContentHolder.current
            .querySelectorAll(":scope > div.active")
            .forEach((el) => el.classList.remove("active"));

          let classList = [
            ...newCreatedElementByPressingEnter.classList
          ].filter((c) => {
            return ["active", "cursor-inside"].includes(c);
          });
          newCreatedElementByPressingEnter.setAttribute(
            "class",
            classList.join(" ")
          );
          rtrimSourroundindElements(newCreatedElementByPressingEnter);
          return;
        }
      }, 1);
      return;
    }

    setTimeout(() => {
      removeStyleClassesOfNotMatchingMarkdownSyntaxOfActiveElement();
    }, 10);

    addCursorInsideClassForActiveElement();

    if (!someTextIsHighlighted() && !isTouchDevice()) {
      setTimeout(() => {
        if (someTextIsHighlighted()) {
          return;
        }
        if (scrollWindowToCenterCaret) {
          scrollCaretToCenter();
        }
      }, 50);
    }

    // dont change layout of control keys are pressed
    if (ev) {
      if (newText !== text && !/^(Alt|Shift|Arrow|Meta)/.test(ev.code)) {
        onChange({
          text: newText,
          caretPosition: Cursor.getCurrentCursorPosition(
            getContentEditableHolderReference()
          )
        });
      }
      if (
        /^(Alt|Shift|Arrow|Meta)/.test(ev.code) ||
        ev.altKey ||
        ev.ctrlKey ||
        ev.metaKey
      ) {
        // set to new navigated element to active
        setTimeout(() => {
          let activeElement = currentElementInsideContentHolderWithCaret(
            getContentEditableHolderReference()
          );
          // TODO: remove all getContentEditableHolderReference() and replace with refContentHolder.current
          if (activeElement) {
            refContentHolder.current
              .querySelectorAll(
                ":scope > div.active, :scope > div.cursor-inside, :scope > div.having-cursor-inside"
              )
              .forEach((el) => {
                if (el !== activeElement) {
                  return;
                }
                el.classList.remove("active");
                el.classList.remove("cursor-inside");
                el.classList.remove("having-cursor-inside");
              });
            activeElement.classList.add("active");
            activeElement.classList.add("cursor-inside");
          }
        }, 1);

        // dont to any styling on cursor movement
        return;
      }
    }

    if (ev?.code === "Tab" && ev.shiftKey) {
      let text = currentElementInsideContentHolderWithCaret(
        getContentEditableHolderReference()
      ).innerText;
      if (text.trim() === "" || text.match(/^\s{2,}$/)) {
        // do nothing, it just makes things worse :D
        return;
      }
    }

    if (newText !== text) {
      // only if text has changed and not enter was pressed
      if (ev?.code === "Enter") {
        editor = markFencedCodeBlocks(
          refContentHolder.current.querySelectorAll(":scope > div")
        );
      } else {
        // dont adjust caret if tab was pressed on empty content (causes s.t. deleting editable divs)
        let tabKeyWasPressedOnEmptyContent =
          ev?.code === "Tab" &&
          getContentEditableHolderReference().innerText.trim() === "";
        let { adjustCursorPositionAfter } = styleMarkdown(editor, {
          changeCaretPosition: !tabKeyWasPressedOnEmptyContent
        });
        setTimeout(() => {
          let el = currentElementInsideContentHolderWithCaret(
            getContentEditableHolderReference()
          );
          if (
            currentElementInsideContentHolderWithCaret(
              getContentEditableHolderReference()
            )?.classList?.contains("new")
          ) {
            currentElementInsideContentHolderWithCaret(
              getContentEditableHolderReference()
            ).classList.remove("new");
            cursorPosition = Cursor.getCurrentCursorPosition(editor);
            el.innerHTML += "&nbsp;";
            if (!guessNextListItemLine) {
              // the cursor is set in creating new list item element, so don't do it when ev.altKey
              Cursor.setCurrentCursorPosition(cursorPosition, editor);
            }
          }
        }, 1);
        // restore cursor position
        if (!tabKeyWasPressedOnEmptyContent && adjustCursorPositionAfter) {
          Cursor.setCurrentCursorPosition(cursorPosition, editor);
        }
      }
      setText(newText);
    }
  }

  function styleMarkdown(
    el,
    {
      changeCaretPosition,
      styleAllVisible,
      styleAll,
      onlyStyleGivenElements,
      preIndentation
    } = {}
  ) {
    function styleMarkdownInElement(el) {
      if (el.classList.contains("fenced-code-block")) {
        // no further styling for code blocks
        return;
      }

      /**
       * Not recommended to use :D
       */
      if (preIndentation) {
        preIndentElement(el);
      }
      blockquotes(el);
    }

    let currentText = el.innerText;
    let adjustCursorPositionAfter = true;
    let currentCursorPosition = Cursor.getCurrentCursorPosition(el);

    // only check active/changing divs
    let activeDivWithCursorInside = currentElementInsideContentHolderWithCaret(
      getContentEditableHolderReference()
    );
    if (activeDivWithCursorInside) {
      refContentHolder.current
        .querySelectorAll(":scope > div.active")
        .forEach((el) => el.classList.remove("active"));
      activeDivWithCursorInside.classList.add("active");
    }

    const allSections =
      refContentHolder.current.querySelectorAll(":scope > div");

    markFencedCodeBlocks(allSections);

    // makes caerts jumping in firefox -_- so we have to skip text cleanup on firefox browser…
    const reassignInnerText = !isFirefox();

    if (styleAll) {
      allSections.forEach((child) => {
        if (reassignInnerText) {
          child.innerText = child.innerText;
        }
        styleMarkdownInElement(child);
        styleText([child]);
        styleLinks(child, { showPictureOnImageHover });
      });
      // return { adjustCursorPositionAfter };
    } else if (styleAllVisible) {
      allSections.forEach((child) => {
        elementToAppearOrDisappear(document, child, (res) => {
          // TODO: check and set cursor position
          if (res.isIntersecting) {
            // becomes visible
            let el = res.target;
            if (reassignInnerText) {
              el.innerText = el.innerText;
            }
            styleMarkdownInElement(el);
            styleText([el]);
            /**
             * Links, should come at last because of event listener
             */
            styleLinks(el, { showPictureOnImageHover });
          }
        });
      });
      return { adjustCursorPositionAfter };
    }

    let activeElements = refContentHolder.current.querySelectorAll(
      ":scope > div.active"
    );

    if (onlyStyleGivenElements) {
      activeElements = el;
    }

    if (!styleAllVisible && !styleAll) {
      // clean up nested elements
      if (isFirefox()) {
        // makes cursor jump in firefox -_-
        // so we have to skip cleanup here
      } else {
        activeElements.forEach((el) => {
          el.innerText = el.innerText;
        });
      }
    }

    styleText(activeElements, getContentEditableHolderReference());

    activeElements.forEach(styleMarkdownInElement);
    activeElements.forEach((el) => {
      styleLinks(el, { showPictureOnImageHover });
    });

    if (changeCaretPosition) {
      let offset = el.innerText.length - currentText.length;
      Cursor.setCurrentCursorPosition(currentCursorPosition + offset, el);
    }

    return { adjustCursorPositionAfter };
  }

  function handleClick(ev) {
    addCursorInsideClassForActiveElement(ev.target);
  }

  function handlePaste(ev) {
    triggerLastChangedAt();
    let wasEmpty = getContentEditableHolderReference().innerText.trim() === "";
    const clipboardData = ev.clipboardData || window.clipboardData;

    let plainText = clipboardData.getData("text");
    let htmlText = clipboardData.getData("text/html");

    if (typeof onPaste === "function") {
      ({ plainText } = onPaste(ev, { clipboardData }));
    } else if (!shiftKeyPressed && htmlText) {
      // convert html to markdown
      // shiftkey mimics behaviour of chrome, when hitting shift+ctrl+v insert plain text
      ev.preventDefault();
      let turndownService = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
        hr: "---"
      });
      try {
        plainText = turndownService.turndown(
          htmlText
        );
        
      } catch (e) {
        console.error(e);
      }
      forcePlainText = true;
    } else if (maxTextLength > 0 && plainText.length > maxTextLength) {
      ev.preventDefault();
      plainText =
        plainText.slice(0, maxTextLength + plainText.match(/\s/g).length) + "…";
      forcePlainText = true;
      setMaxContentLengthReached(true);
    }

    setIsProcessing(true);

    let allTextIsSelected = window.getSelection()
      ? window.getSelection().toString().trim() === text
      : null;

    if (forcePlainText && plainText && !wasEmpty) {
      ev.preventDefault();
      document.execCommand("insertText", false, plainText);
    }

    if (wasEmpty || allTextIsSelected) {
      // paste all new content
      setTimeout(() => {
        if (!plainText) {
          return;
        }
        let previousText = plainText.trim();
        let editableContent = getContentEditableHolderReference();
        previousText = initializeText(previousText);
        setTimeout(() => {
          styleMarkdown(editableContent, {
            styleAllVisible: true
          });
          setIsProcessing(false);
          // set caret to end
          Cursor.setCurrentCursorPosition(
            editableContent.innerText.length - 1,
            editableContent
          );
        }, 10);
        setText(previousText);
      }, 100);
    } else {
      setIsProcessing(false);
    }

    // make this async, to ensure that the text is already pasted
    setTimeout(() => {
      let newText = rtrimmedTextOfContentEditable();
      if (text !== newText) {
        onChange({
          text: newText,
          caretPosition: Cursor.getCurrentCursorPosition(
            getContentEditableHolderReference()
          )
        });
        triggerLastChangedAt();
      }
    }, 1);

    return;
  }

  useEffect(() => {
    let hasContent = ref.current?.innerText && ref.current.innerText !== "\n";
    setHasContent(hasContent);
    if (hasContent) {
      setTimeout(() => {
        getContentEditableHolderReference()
          .parentElement?.closest("focus-editor")
          ?.classList?.remove("hide-placeholder");
      }, 100);
    }
  }, [ref.current, text, initialText, lastChangedAt]);

  return (
    <div
      className={[
        "editor",
        "resizeable",
        maxContentLengthReached ? "max-content-length-reached" : null,
        isProcessing ? "processing" : null,
        focus && !tempDisableFocus ? "focus" : null,
        lastChangedAt > 0 && hasContent ? "has-content" : null,
        indentHeadings ? "indent-headings" : null,
        metaOrAltKeyPressed ? "meta-or-alt-key-pressed" : null
      ]
        .filter((v) => !!v)
        .join(" ")}
      data-identifier={identifier}
      ref={forwardRef}
    >
      <div
        className="content-editable-holder"
        contentEditable={readOnly ? undefined : true}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        ref={ref}
        onPaste={handlePaste}
        onClick={handleClick}
        data-placeholder={placeholder}
        suppressContentEditableWarning={true}
      >
        <div
          className={[
            "content-holder",
            showNumberOfParagraphs ? "show-section-counter" : null
          ]
            .filter((v) => !!v)
            .join(" ")}
          ref={refContentHolder}
        ></div>
      </div>
    </div>
  );
}
