import { OCRClient } from "tesseract-wasm";


// const worker = new Worker(new URL('tesseract-wasm/dist/tesseract-worker.js', import.meta.url), {
//   //type: 'module',
// })
//
// Web Workers inlined as base64 strings at build time
// import InlineWorker from 'tesseract-wasm/dist/tesseract-worker.js?worker&inline'


export const tesseractLanguageCodes =
  `afr, amh, ara, asm, aze, aze_cyrl, bel, ben, bod, bos, bre, bul, cat, ceb, ces, chi_sim, chi_tra, chr, cos, cym, dan, dan_frak, deu, deu_frak, deu_latf, dzo, ell, eng, enm, epo, equ, est, eus, fao, fas, fil, fin, fra, frk, frm, fry, gla, gle, glg, grc, guj, hat, heb, hin, hrv, hun, hye, iku, ind, isl, ita, ita_old, jav, jpn, kan, kat, kat_old, kaz, khm, kir, kmr, kor, kor_vert, kur, lao, lat, lav, lit, ltz, mal, mar, mkd, mlt, mon, mri, msa, mya, nep, nld, nor, oci, ori, osd, pan, pol, por, pus, que, ron, rus, san, sin, slk, slk_frak, slv, snd, spa, spa_old, sqi, srp, srp_latn, sun, swa, swe, syr, tam, tat, tel, tgk, tgl, tha, tir, ton, tur, uig, ukr, urd, uzb, uzb_cyrl, vie, yid, yor`.split(
    ", "
  );

export async function OCRImage({ workerURL, file, lang }, cb) {
  const ocr = new OCRClient({
    workerURL
  });
  try {
    const image = await createImageBitmap(file);
    const modelUrl = `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/${lang}.traineddata`;
    console.debug(`Using model from url: ${modelUrl}`);
    await ocr.loadModel(modelUrl);
    await ocr.loadImage(image);
    cb(await ocr.getText());
  } catch (e) {
    ocr.destroy();
    throw e;
  } finally {
    // Once all OCR-ing has been done, shut down the Web Worker and free up
    // resources.
    ocr.destroy();
  }
}
