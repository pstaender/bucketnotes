import * as pdfjsLib from "pdfjs-dist/build/pdf.min.mjs";


export function convertPDFToText({ dataTransferItem }, cb) {
  const f = dataTransferItem.getAsFile();
  const reader = new FileReader();

  reader.onload = async (event) => {
    const arrayBuffer = event.target.result;
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    let fullText = "";

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const textItems = textContent.items.map((item) => item.str);
      const pageText = textItems.join(" ");
      fullText += pageText + "\n";
    }

    cb(fullText);
  };

  reader.readAsArrayBuffer(f);
}
