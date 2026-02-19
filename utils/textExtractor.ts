
import { Book } from '../types';
import { parseMobi } from './mobiParser';

/**
 * Extracts raw text content from a Book object.
 * Used for AI analysis and format conversion.
 */
export const extractBookText = async (book: Book, limit?: number): Promise<string> => {
  let fullText = "";

  try {
    switch (book.format) {
      case 'epub':
        fullText = await extractFromEpub(book.content);
        break;
      case 'pdf':
        fullText = await extractFromPdf(book.content);
        break;
      case 'fb2':
        fullText = extractFromFb2(book.content);
        break;
      case 'rtf':
        fullText = extractFromRtf(book.content);
        break;
      case 'txt':
        fullText = typeof book.content === 'string' 
          ? book.content 
          : new TextDecoder().decode(book.content as ArrayBuffer);
        break;
      case 'mobi':
      case 'azw3':
        const buffer = book.content instanceof ArrayBuffer 
             ? book.content 
             : new TextEncoder().encode(book.content as string).buffer;
        const mobiHtml = await parseMobi(buffer);
        fullText = mobiHtml.replace(/<[^>]+>/g, "\n").replace(/\n\s*\n/g, "\n\n").trim();
        break;
      default:
        throw new Error("Unsupported format for text extraction");
    }
  } catch (e) {
    console.error("Text extraction failed", e);
    return "";
  }

  // If a limit is set (e.g. for AI context window), truncate
  if (limit && fullText.length > limit) {
    return fullText.substring(0, limit) + "... [Content Truncated]";
  }

  return fullText;
};

// --- Internal Helpers ---

const extractFromEpub = async (content: ArrayBuffer | string): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      const bookData = typeof content === 'string' 
        ? (new TextEncoder().encode(content)).buffer 
        : content.slice(0);

      // @ts-ignore
      const book = window.ePub(bookData);
      await book.ready;

      let textAccumulator = "";
      
      // @ts-ignore
      const spineItems = book.spine.items;
      
      // Limit processing to first 20 chapters to prevent browser freeze on huge books if not converting
      const limit = Math.min(spineItems.length, 50);

      for (let i = 0; i < limit; i++) {
        const item = spineItems[i];
        if (item && item.href) {
           try {
               const doc = await book.load(item.href);
               if (doc) {
                 let text = "";
                 if (typeof doc === 'string') {
                     const parser = new DOMParser();
                     const htmlDoc = parser.parseFromString(doc, "text/html");
                     text = htmlDoc.body.innerText || "";
                 } else if (doc.body) {
                     text = doc.body.innerText || "";
                 }
                 textAccumulator += text.trim() + "\n\n";
               }
           } catch (err) {
               console.warn(`Skipping chapter ${i}`, err);
           }
        }
        if (item.unload) item.unload();
      }
      resolve(textAccumulator);
    } catch (e) {
      reject(e);
    }
  });
};

const extractFromPdf = async (content: ArrayBuffer | string): Promise<string> => {
  // @ts-ignore
  const pdfjsLib = window.pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/build/pdf.worker.min.js';

  const data = typeof content === 'string' 
    ? (new TextEncoder().encode(content)).buffer 
    : content.slice(0);

  const loadingTask = pdfjsLib.getDocument({ data });
  const doc = await loadingTask.promise;
  
  let fullText = "";
  // For AI context, usually the first 50 pages are enough to get style/plot/characters
  // Reading 500 pages of PDF synchronously freezes the UI too much
  const maxPages = Math.min(doc.numPages, 50); 

  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    // @ts-ignore
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + "\n\n";
  }
  return fullText;
};

const extractFromFb2 = (content: string | ArrayBuffer): string => {
  let text = typeof content === 'string' ? content : new TextDecoder("utf-8").decode(content);
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");
    const body = xmlDoc.getElementsByTagName("body")[0] || xmlDoc.getElementsByTagName("FictionBook")[0];
    return body ? (body.textContent || "") : text.replace(/<[^>]+>/g, '\n');
  } catch (e) {
     return text.replace(/<[^>]+>/g, '\n');
  }
};

const extractFromRtf = (content: string | ArrayBuffer): string => {
   let text = typeof content === 'string' ? content : new TextDecoder("utf-8").decode(content);
   text = text.replace(/(\{[^{}]*\})/g, "");
   text = text.replace(/\\par[d]?\s*/g, "\n");
   text = text.replace(/\\line\s*/g, "\n");
   text = text.replace(/\\[a-z0-9]+\s?/g, "");
   text = text.replace(/[{}]/g, "");
   return text.trim();
};
