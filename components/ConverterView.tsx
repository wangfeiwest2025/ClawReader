
import React, { useState } from 'react';
import { Book, BookFormat } from '../types';
import { Download, CheckCircle2, Loader2, RefreshCw, FileText, AlertTriangle } from 'lucide-react';
import { parseMobi } from '../utils/mobiParser';
import { jsPDF } from "jspdf";

interface ConverterViewProps {
  books: Book[];
}

const ConverterView: React.FC<ConverterViewProps> = ({ books }) => {
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [targetFormat, setTargetFormat] = useState<BookFormat>('txt');
  const [isConverting, setIsConverting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [result, setResult] = useState<{ url: string; name: string } | null>(null);

  // Added 'pdf' to supported formats
  const formats: BookFormat[] = ['txt', 'pdf']; 

  // --- Helper: Extract Text from EPUB ---
  const extractFromEpub = async (content: ArrayBuffer | string): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        setStatusMessage("Initializing EPUB engine...");
        const bookData = typeof content === 'string' 
          ? (new TextEncoder().encode(content)).buffer 
          : content.slice(0); // Clone buffer

        // @ts-ignore - ePub is global
        const book = window.ePub(bookData);
        await book.ready;

        setStatusMessage("Parsing chapters...");
        let fullText = "";
        
        // Iterate through the spine (reading order)
        // @ts-ignore
        const spineItems = book.spine.items;
        const total = spineItems.length;

        for (let i = 0; i < spineItems.length; i++) {
          const item = spineItems[i];
          setStatusMessage(`Extracting chapter ${i + 1} of ${total}...`);
          
          if (item && item.href) {
             try {
                 const doc = await book.load(item.href);
                 if (doc) {
                   let text = "";
                   if (typeof doc === 'string') {
                       const parser = new DOMParser();
                       const htmlDoc = parser.parseFromString(doc, "text/html");
                       text = htmlDoc.body.innerText || htmlDoc.body.textContent || "";
                   } else if (doc.body) {
                       text = doc.body.innerText || doc.body.textContent || "";
                   } else if (doc.documentElement) {
                       text = doc.documentElement.textContent || "";
                   }
                   fullText += text.trim() + "\n\n";
                 }
             } catch (err) {
                 console.warn(`Skipping chapter ${i} due to load error`, err);
             }
          }
          
          if (item.unload && typeof item.unload === 'function') {
             item.unload();
          }
        }
        resolve(fullText);
      } catch (e) {
        console.error("EPUB Extraction Error:", e);
        reject(e);
      }
    });
  };

  // --- Helper: Extract Text from PDF ---
  const extractFromPdf = async (content: ArrayBuffer | string): Promise<string> => {
    try {
      setStatusMessage("Loading PDF document...");
      // @ts-ignore
      const pdfjsLib = window.pdfjsLib;
      // FIX: Use jsdelivr for worker to match the script tag and ensure accessibility
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/build/pdf.worker.min.js';

      const data = typeof content === 'string' 
        ? (new TextEncoder().encode(content)).buffer 
        : content.slice(0);

      const loadingTask = pdfjsLib.getDocument({ data });
      const doc = await loadingTask.promise;
      
      let fullText = "";
      const total = doc.numPages;

      for (let i = 1; i <= total; i++) {
        setStatusMessage(`Reading page ${i} of ${total}...`);
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        // @ts-ignore
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + "\n\n";
      }

      return fullText;
    } catch (e) {
      console.error(e);
      throw new Error("PDF extraction failed.");
    }
  };

  // --- Helper: Extract from FB2 (XML) ---
  const extractFromFb2 = (content: string | ArrayBuffer): string => {
    setStatusMessage("Parsing FB2 structure...");
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

  // --- Helper: RTF Stripper ---
  const extractFromRtf = (content: string | ArrayBuffer): string => {
     setStatusMessage("Processing RTF...");
     let text = typeof content === 'string' ? content : new TextDecoder("utf-8").decode(content);
     text = text.replace(/(\{[^{}]*\})/g, "");
     text = text.replace(/\\par[d]?\s*/g, "\n");
     text = text.replace(/\\line\s*/g, "\n");
     text = text.replace(/\\[a-z0-9]+\s?/g, "");
     text = text.replace(/[{}]/g, "");
     return text.trim();
  };

  /**
   * Optimized PDF Generator
   * Uses Async/Await pattern to yield control to UI thread.
   * Uses Binary Search for fast text wrapping.
   */
  const createPdfWithCanvas = async (title: string, text: string, onProgress: (msg: string) => void): Promise<Blob> => {
    // 1. Setup Constants
    const pageWidth = 595.28; // A4 pt
    const pageHeight = 841.89; 
    const margin = 40;
    const printableWidth = pageWidth - (margin * 2);
    const lineHeight = 18; 
    const fontSize = 11;
    
    // Scale 1.5 is a sweet spot: good text quality, significantly less memory than 2.0
    const scale = 1.5; 
    const canvasWidth = pageWidth * scale;
    const canvasHeight = pageHeight * scale;

    const doc = new jsPDF('p', 'pt', 'a4');
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for no alpha

    if (!ctx) throw new Error("Canvas init failed");

    // Init Context
    ctx.scale(scale, scale);
    ctx.textBaseline = 'top';
    const fontStack = '"Microsoft YaHei", "SimHei", "Heiti SC", "PingFang SC", sans-serif';
    
    // Helper: Clear Canvas
    const clearCanvas = () => {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset scale for clearing
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.restore();
        ctx.fillStyle = '#000000';
    };

    // Helper: Flush Page to PDF
    let pageIndex = 1;
    const flushPage = async (isLast = false) => {
         // Compress as JPEG 0.75 to save massive amounts of memory
         const imgData = canvas.toDataURL('image/jpeg', 0.75); 
         if (pageIndex > 1) doc.addPage();
         doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
         
         if (!isLast) {
             clearCanvas();
             pageIndex++;
             onProgress(`Rendering PDF Page ${pageIndex}...`);
             // Critical: Yield to event loop to prevent crash/freeze
             await new Promise(r => setTimeout(r, 0));
         }
    };

    // Helper: Binary Search for fitting text
    // Much faster than linear scan for long lines
    const getFitIndex = (textStr: string, maxWidth: number): number => {
        if (ctx.measureText(textStr).width <= maxWidth) return textStr.length;
        
        let min = 0;
        let max = textStr.length;
        let result = 0;
        
        while (min <= max) {
            const mid = Math.floor((min + max) / 2);
            if (mid === 0) { min = 1; continue; }
            const sub = textStr.substring(0, mid);
            if (ctx.measureText(sub).width <= maxWidth) {
                result = mid;
                min = mid + 1;
            } else {
                max = mid - 1;
            }
        }
        return result;
    };

    // --- Start Rendering ---
    clearCanvas();
    let cursorY = margin;

    // Draw Title
    ctx.font = `bold 18pt ${fontStack}`;
    ctx.fillText(title, margin, cursorY);
    cursorY += 50;

    // Draw Body
    ctx.font = `${fontSize}pt ${fontStack}`;
    
    // Pre-split paragraphs
    const paragraphs = text.split(/\r?\n/);
    
    for (let i = 0; i < paragraphs.length; i++) {
        let p = paragraphs[i].trim();
        if (!p) {
            // Empty line
            cursorY += lineHeight;
            if (cursorY > pageHeight - margin) {
                await flushPage();
                cursorY = margin;
            }
            continue;
        }

        // Indent
        p = "    " + p;

        while (p.length > 0) {
            // Find how many chars fit
            const fitIdx = getFitIndex(p, printableWidth);
            const lineToDraw = p.substring(0, fitIdx);
            
            ctx.fillText(lineToDraw, margin, cursorY);
            cursorY += lineHeight;
            
            p = p.substring(fitIdx); // Remaining text

            // Check page break
            if (cursorY > pageHeight - margin) {
                await flushPage();
                cursorY = margin;
            }
        }
        
        // Paragraph spacing
        cursorY += lineHeight * 0.5;
        if (cursorY > pageHeight - margin) {
            await flushPage();
            cursorY = margin;
        }

        // Yield periodically to keep browser responsive
        if (i % 20 === 0) {
             onProgress(`Processing paragraph ${i} / ${paragraphs.length}...`);
             await new Promise(r => setTimeout(r, 0));
        }
    }

    // Final Flush
    await flushPage(true);
    
    return doc.output('blob');
  };

  const handleConvert = async () => {
    if (!selectedBookId) return;
    const book = books.find(b => b.id === selectedBookId);
    if (!book) return;

    setIsConverting(true);
    setResult(null);
    setStatusMessage("Starting conversion engine...");

    try {
      let resultText = "";

      // 1. Extract Text
      switch (book.format) {
        case 'epub':
          resultText = await extractFromEpub(book.content);
          break;
        case 'pdf':
          resultText = await extractFromPdf(book.content);
          break;
        case 'fb2':
          resultText = extractFromFb2(book.content);
          break;
        case 'rtf':
          resultText = extractFromRtf(book.content);
          break;
        case 'txt':
          resultText = typeof book.content === 'string' ? book.content : new TextDecoder().decode(book.content);
          break;
        case 'mobi':
        case 'azw3':
          setStatusMessage(`Parsing ${book.format.toUpperCase()} binary...`);
          const buffer = book.content instanceof ArrayBuffer 
               ? book.content 
               : new TextEncoder().encode(book.content).buffer;
          const mobiHtml = await parseMobi(buffer);
          setStatusMessage("Cleaning text content...");
          resultText = mobiHtml.replace(/<[^>]+>/g, "\n").replace(/\n\s*\n/g, "\n\n").trim();
          break;
        default:
          throw new Error("Unsupported format");
      }

      setStatusMessage(`Initializing ${targetFormat.toUpperCase()} Generator...`);
      
      // 2. Generate File
      let blob: Blob;
      let filename = `${book.title}`;

      if (targetFormat === 'pdf') {
         blob = await createPdfWithCanvas(book.title, resultText, (msg) => setStatusMessage(msg));
         filename += ".pdf";
      } else {
         blob = new Blob([resultText], { type: 'text/plain;charset=utf-8' });
         filename += ".txt";
      }

      const downloadUrl = URL.createObjectURL(blob);
      setResult({ url: downloadUrl, name: filename });

    } catch (error: any) {
      console.error("Conversion failed:", error);
      alert(`转换失败: ${error.message || "未知错误"}`);
    } finally {
      setIsConverting(false);
      setStatusMessage("");
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-12 h-full flex flex-col overflow-y-auto">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h3 className="text-3xl md:text-4xl font-black text-gray-900 mb-2 tracking-tight">格式转换器</h3>
          <p className="text-gray-500 font-medium text-sm md:text-base">将您的电子书库转换为通用文本格式或 PDF，以便在任何设备上阅读。</p>
        </div>
        <div className="hidden md:flex w-16 h-16 bg-indigo-50 rounded-2xl items-center justify-center text-indigo-600 shadow-sm">
           <RefreshCw size={32} className={isConverting ? "animate-spin" : ""} />
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
        <div className="lg:col-span-2 space-y-8">
           {/* Step 1: Source */}
           <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50">
             <div className="flex justify-between items-center mb-6">
                <label className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">第一步：选择书籍</label>
                <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-md">{books.length} 本可用</span>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {books.length === 0 ? (
                  <div className="col-span-2 py-12 text-center border-2 border-dashed border-gray-100 rounded-2xl text-gray-400 flex flex-col items-center gap-2">
                    <FileText size={32} className="opacity-20" />
                    <span>您的书库是空的，请先添加书籍</span>
                  </div>
                ) : (
                  books.map(book => (
                    <button
                      key={book.id}
                      onClick={() => setSelectedBookId(book.id)}
                      className={`flex items-center gap-4 p-3 rounded-2xl border-2 transition-all text-left group ${
                        selectedBookId === book.id 
                        ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-200 ring-offset-2' 
                        : 'border-gray-50 bg-gray-50 hover:border-gray-200 hover:bg-white'
                      }`}
                    >
                      <div className="w-12 h-16 shrink-0 rounded-lg shadow-sm overflow-hidden bg-gray-200 relative">
                        <img src={book.cover} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" alt="" />
                        {selectedBookId === book.id && (
                          <div className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center">
                            <CheckCircle2 className="text-white drop-shadow-md" size={20} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate text-gray-800">{book.title}</div>
                        <div className="text-xs text-gray-500 truncate mb-1">{book.author}</div>
                        <div className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-white border border-gray-200 uppercase tracking-wide text-gray-400">
                          {book.format}
                        </div>
                      </div>
                    </button>
                  ))
                )}
             </div>
           </div>

           {/* Step 2: Target */}
           <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50">
             <label className="block text-[10px] font-black text-indigo-600 mb-6 uppercase tracking-[0.2em]">第二步：目标格式</label>
             <div className="flex flex-wrap gap-3">
               {formats.map(f => (
                 <button
                    key={f}
                    onClick={() => setTargetFormat(f)}
                    className={`px-8 py-4 rounded-2xl font-black transition-all border-2 flex items-center gap-2 ${
                      targetFormat === f 
                      ? 'border-indigo-600 bg-indigo-600 text-white shadow-xl shadow-indigo-200 scale-105' 
                      : 'border-gray-100 text-gray-400 bg-white hover:border-indigo-200 hover:text-indigo-600'
                    }`}
                 >
                   <FileText size={18} />
                   {f.toUpperCase()}
                 </button>
               ))}
               <div className="flex items-center px-4 text-xs text-gray-400 italic">
                  * 目前支持导出为纯文本 (TXT) 和 PDF
               </div>
             </div>
           </div>
        </div>

        {/* Action Panel */}
        <div className="bg-indigo-900 rounded-[2rem] p-8 text-white flex flex-col relative overflow-hidden shadow-2xl shadow-indigo-900/30 min-h-[400px]">
          <div className="relative z-10 flex flex-col h-full">
            <div className="mb-auto">
              <h4 className="text-2xl font-bold mb-4 tracking-tight">处理中心</h4>
              <p className="text-indigo-200 text-sm leading-relaxed mb-6 font-medium opacity-80">
                我们的转换引擎会解析原始文件结构，提取核心文本内容，并重新编码为通用的 UTF-8 格式。
              </p>
              
              {bookDetails(books, selectedBookId)}
            </div>
            
            <div className="mt-8">
              {result ? (
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 animate-in zoom-in-95 duration-500">
                  <div className="flex items-center gap-3 text-green-400 font-bold mb-4">
                    <CheckCircle2 size={24} />
                    <span>转换成功!</span>
                  </div>
                  <div className="text-sm text-indigo-100 truncate mb-6 font-mono bg-black/20 p-2 rounded-lg">{result.name}</div>
                  <a 
                    href={result.url} 
                    download={result.name}
                    className="w-full bg-white text-indigo-900 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors shadow-xl active:scale-95"
                  >
                    <Download size={20} />
                    下载文件
                  </a>
                  <button onClick={() => setResult(null)} className="w-full mt-4 text-xs font-bold text-indigo-300 hover:text-white transition-colors">
                    转换另一本
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {statusMessage && (
                     <div className="text-xs font-mono text-indigo-300 animate-pulse text-center">
                       {statusMessage}
                     </div>
                  )}
                  <button
                    disabled={!selectedBookId || isConverting}
                    onClick={handleConvert}
                    className={`w-full py-5 rounded-2xl font-black text-lg shadow-xl transition-all flex items-center justify-center gap-3 ${
                      !selectedBookId || isConverting 
                      ? 'bg-indigo-800 text-indigo-500 cursor-not-allowed' 
                      : 'bg-indigo-500 hover:bg-indigo-400 text-white active:scale-95 shadow-indigo-500/25'
                    }`}
                  >
                    {isConverting ? <Loader2 className="animate-spin" /> : "开始转换"}
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Decorative Background Elements */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/30 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-12 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl" />
          <div className="absolute bottom-0 right-0 w-full h-32 bg-gradient-to-t from-indigo-950 to-transparent opacity-60" />
        </div>
      </div>
    </div>
  );
};

const bookDetails = (books: Book[], id: string) => {
  if (!id) return null;
  const book = books.find(b => b.id === id);
  if (!book) return null;

  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-start gap-3">
         <div className="w-10 h-14 bg-indigo-950 rounded shadow-sm overflow-hidden shrink-0">
            <img src={book.cover} className="w-full h-full object-cover opacity-80" alt="" />
         </div>
         <div className="min-w-0">
            <div className="text-white font-bold text-sm truncate">{book.title}</div>
            <div className="text-indigo-300 text-xs truncate">{book.author}</div>
            <div className="text-[10px] text-indigo-400 mt-1 uppercase font-mono">{book.format} format</div>
         </div>
      </div>
    </div>
  )
}

export default ConverterView;
