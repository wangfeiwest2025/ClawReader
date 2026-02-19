
import React, { useState } from 'react';
import { Book, BookFormat } from '../types';
import { Download, CheckCircle2, Loader2, RefreshCw, FileText } from 'lucide-react';
import { jsPDF } from "jspdf";
import { extractBookText } from '../utils/textExtractor';

interface ConverterViewProps {
  books: Book[];
}

const ConverterView: React.FC<ConverterViewProps> = ({ books }) => {
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [targetFormat, setTargetFormat] = useState<BookFormat>('txt');
  const [isConverting, setIsConverting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [result, setResult] = useState<{ url: string; name: string } | null>(null);

  const formats: BookFormat[] = ['txt', 'pdf']; 

  /**
   * Optimized PDF Generator
   * Uses Async/Await pattern to yield control to UI thread.
   */
  const createPdfWithCanvas = async (title: string, text: string, onProgress: (msg: string) => void): Promise<Blob> => {
    // 1. Setup Constants
    const pageWidth = 595.28; // A4 pt
    const pageHeight = 841.89; 
    const margin = 40;
    const printableWidth = pageWidth - (margin * 2);
    const lineHeight = 18; 
    const fontSize = 11;
    
    // Scale 1.5 is a sweet spot
    const scale = 1.5; 
    const canvasWidth = pageWidth * scale;
    const canvasHeight = pageHeight * scale;

    const doc = new jsPDF('p', 'pt', 'a4');
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d', { alpha: false }); 

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
         const imgData = canvas.toDataURL('image/jpeg', 0.75); 
         if (pageIndex > 1) doc.addPage();
         doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
         
         if (!isLast) {
             clearCanvas();
             pageIndex++;
             onProgress(`Rendering PDF Page ${pageIndex}...`);
             await new Promise(r => setTimeout(r, 0));
         }
    };

    // Helper: Binary Search for fitting text
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

    ctx.font = `bold 18pt ${fontStack}`;
    ctx.fillText(title, margin, cursorY);
    cursorY += 50;

    ctx.font = `${fontSize}pt ${fontStack}`;
    
    const paragraphs = text.split(/\r?\n/);
    
    for (let i = 0; i < paragraphs.length; i++) {
        let p = paragraphs[i].trim();
        if (!p) {
            cursorY += lineHeight;
            if (cursorY > pageHeight - margin) {
                await flushPage();
                cursorY = margin;
            }
            continue;
        }

        p = "    " + p;

        while (p.length > 0) {
            const fitIdx = getFitIndex(p, printableWidth);
            const lineToDraw = p.substring(0, fitIdx);
            
            ctx.fillText(lineToDraw, margin, cursorY);
            cursorY += lineHeight;
            
            p = p.substring(fitIdx);

            if (cursorY > pageHeight - margin) {
                await flushPage();
                cursorY = margin;
            }
        }
        
        cursorY += lineHeight * 0.5;
        if (cursorY > pageHeight - margin) {
            await flushPage();
            cursorY = margin;
        }

        if (i % 20 === 0) {
             onProgress(`Processing paragraph ${i} / ${paragraphs.length}...`);
             await new Promise(r => setTimeout(r, 0));
        }
    }

    await flushPage(true);
    return doc.output('blob');
  };

  const handleConvert = async () => {
    if (!selectedBookId) return;
    const book = books.find(b => b.id === selectedBookId);
    if (!book) return;

    setIsConverting(true);
    setResult(null);
    setStatusMessage("Extracting text content...");

    try {
      // Use the shared utility
      // Pass a very large limit for conversion (e.g., 10 million chars)
      const resultText = await extractBookText(book, 10000000); 

      setStatusMessage(`Generating ${targetFormat.toUpperCase()} file...`);
      
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
