
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Book, ReadingSettings } from '../types';
import { ChevronLeft, ChevronRight, Settings, ArrowLeft, Loader2, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';
import { parseMobi } from '../utils/mobiParser';

interface ReaderViewProps {
  book: Book;
  onBack: () => void;
}

const ReaderView: React.FC<ReaderViewProps> = ({ book, onBack }) => {
  const [settings, setSettings] = useState<ReadingSettings>({
    fontSize: 18,
    lineHeight: 1.6,
    theme: 'sepia',
    fontFamily: 'serif'
  });

  const [showSettings, setShowSettings] = useState(false);
  const [engineLoading, setEngineLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState({ current: 1, total: 1, label: '准备中...' });
  const [parsedElements, setParsedElements] = useState<React.ReactNode[]>([]);
  
  const [textPage, setTextPage] = useState(0);
  const [textTotalPages, setTextTotalPages] = useState(1);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const [columnWidth, setColumnWidth] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const pageNumRef = useRef(1); 

  const renditionRef = useRef<any>(null);
  const bookInstanceRef = useRef<any>(null);
  const viewerRef = useRef<HTMLDivElement>(null); 
  const resizeTimeoutRef = useRef<any>(null);

  // --- 触摸滑动状态 ---
  const touchStartRef = useRef<{ x: number, y: number } | null>(null);
  const minSwipeDistance = 50; // 最小滑动距离触发翻页

  useEffect(() => { pageNumRef.current = pageNum; }, [pageNum]);

  const themeConfig = {
    dark: { bg: '#121212', text: '#d1d5db', paper: '#1e1e1e', border: '#333' },
    sepia: { bg: '#f4ecd8', text: '#5b4636', paper: '#fbf7ed', border: '#e0d5ba' },
    light: { bg: '#f3f4f6', text: '#111827', paper: '#ffffff', border: '#e5e7eb' }
  }[settings.theme];

  const prevPage = useCallback(() => {
    if (book.format === 'epub' && renditionRef.current) {
      renditionRef.current.prev();
    } else if (book.format === 'pdf' && pdfDoc) {
      setPageNum(prev => Math.max(1, prev - 1));
    } else if (['txt', 'fb2', 'rtf', 'mobi', 'azw3'].includes(book.format)) {
       setTextPage(prev => Math.max(0, prev - 1));
    }
  }, [book.format, pdfDoc]);

  const nextPage = useCallback(() => {
    if (book.format === 'epub' && renditionRef.current) {
      renditionRef.current.next();
    } else if (book.format === 'pdf' && pdfDoc) {
      setPageNum(prev => Math.min(pdfDoc.numPages, prev + 1));
    } else if (['txt', 'fb2', 'rtf', 'mobi', 'azw3'].includes(book.format)) {
       setTextPage(prev => Math.min(textTotalPages - 1, prev + 1));
    }
  }, [book.format, pdfDoc, textTotalPages]);

  // --- 触摸处理逻辑 (React 容器) ---
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    
    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    };

    const diffX = touchStartRef.current.x - touchEnd.x;
    const diffY = touchStartRef.current.y - touchEnd.y;

    // 确保是水平滑动 (X轴位移 > Y轴位移) 且距离足够
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > minSwipeDistance) {
       if (diffX > 0) {
         nextPage(); // 向左滑 -> 下一页
       } else {
         prevPage(); // 向右滑 -> 上一页
       }
    }
    
    touchStartRef.current = null;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevPage();
      if (e.key === 'ArrowRight' || e.key === ' ') nextPage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevPage, nextPage]);

  // Content rendering effects...
  useEffect(() => {
     if (['txt', 'fb2', 'rtf', 'mobi', 'azw3'].includes(book.format) && textContainerRef.current) {
       const gap = 40;
       const width = textContainerRef.current.clientWidth;
       textContainerRef.current.scrollTo({
         left: textPage * (width + gap),
         behavior: 'smooth'
       });
       setCurrentPage({ current: textPage + 1, total: textTotalPages, label: `${textPage + 1} / ${textTotalPages}` });
    }
  }, [textPage, textTotalPages, book.format]);

  useEffect(() => {
    if (!['txt', 'fb2', 'rtf', 'mobi', 'azw3'].includes(book.format)) return;
    if (!textContainerRef.current) return;
    const calc = () => {
        if (!textContainerRef.current) return;
        const gap = 40;
        const clientW = textContainerRef.current.clientWidth;
        const scrollW = textContainerRef.current.scrollWidth;
        setColumnWidth(clientW);
        const total = Math.max(1, Math.ceil(scrollW / (clientW + gap)));
        if (total !== textTotalPages) { setTextTotalPages(total); if (textPage >= total) setTextPage(total - 1); }
    };
    const observer = new ResizeObserver(() => window.requestAnimationFrame(() => calc()));
    observer.observe(textContainerRef.current);
    return () => observer.disconnect();
  }, [book.format, parsedElements, settings.fontSize, settings.lineHeight]);

  // --- PDF RENDERER IMPROVED ---
  const renderPdfPage = useCallback(async (num: number, doc: any) => {
    if (!doc || !pdfCanvasRef.current) return;
    try {
      const page = await doc.getPage(num);
      const canvas = pdfCanvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      // Get accurate container width
      const container = canvas.parentElement || document.body;
      const containerWidth = container.clientWidth;
      
      // Calculate logical target width (responsive, max 1000px)
      const targetWidth = Math.min(containerWidth - 24, 1000); 
      
      const unscaledViewport = page.getViewport({ scale: 1 });
      const scaleFactor = targetWidth / unscaledViewport.width;

      // High DPI (Retina) Support
      // Force at least 2.0 scale for sharp text on standard screens too
      const dpr = window.devicePixelRatio || 1;
      const renderScale = Math.max(dpr, 2.0); 

      // Create viewport at High Res
      const viewport = page.getViewport({ scale: scaleFactor * renderScale });

      // Set physical dimensions (High Res)
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      // Set CSS dimensions (Logical Size)
      canvas.style.width = `${Math.floor(viewport.width / renderScale)}px`;
      canvas.style.height = `${Math.floor(viewport.height / renderScale)}px`;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      
      await page.render(renderContext).promise;
      setCurrentPage({ current: num, total: doc.numPages, label: `${num} / ${doc.numPages}` });
    } catch (err) { console.error(err); }
  }, []);

  // Trigger PDF Render on Page Change
  useEffect(() => {
    if (book.format === 'pdf' && pdfDoc) renderPdfPage(pageNum, pdfDoc);
  }, [pageNum, pdfDoc, renderPdfPage, book.format]);

  // Trigger PDF Render on Window Resize
  useEffect(() => {
    if (book.format !== 'pdf' || !pdfDoc) return;
    const handleResize = () => {
       if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
       resizeTimeoutRef.current = setTimeout(() => {
          renderPdfPage(pageNumRef.current, pdfDoc);
       }, 200);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [book.format, pdfDoc, renderPdfPage]);


  // Init Engine Effect
  useEffect(() => {
    let isMounted = true;
    const initReader = async () => {
      setEngineLoading(true); setError(null);
      try {
        // Safe clone to prevent "detached ArrayBuffer" when libraries transfer ownership
        const contentData = book.content instanceof ArrayBuffer 
          ? book.content.slice(0) 
          : book.content;

        if (book.format === 'epub') {
          if (bookInstanceRef.current) await bookInstanceRef.current.destroy();
          while (!(window as any).ePub) { await new Promise(r => setTimeout(r, 100)); }
          const epub = (window as any).ePub(contentData);
          bookInstanceRef.current = epub;
          await new Promise(r => setTimeout(r, 100));
          if (!viewerRef.current) throw new Error("Container missing");
          const rendition = epub.renderTo(viewerRef.current, { width: '100%', height: '100%', flow: 'paginated', manager: 'default' });
          renditionRef.current = rendition;
          
          // --- EPUB 内部触摸事件绑定 ---
          rendition.on('touchstart', (e: any) => {
             touchStartRef.current = { 
               x: e.changedTouches[0].clientX, 
               y: e.changedTouches[0].clientY 
             };
          });

          rendition.on('touchend', (e: any) => {
             if (!touchStartRef.current) return;
             const touchEnd = {
               x: e.changedTouches[0].clientX,
               y: e.changedTouches[0].clientY
             };
             const diffX = touchStartRef.current.x - touchEnd.x;
             const diffY = touchStartRef.current.y - touchEnd.y;
             
             // 逻辑同外层：水平位移 > 垂直位移 且 > 阈值
             if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
               if (diffX > 0) rendition.next();
               else rendition.prev();
             }
             touchStartRef.current = null;
          });

          await rendition.display();
          if (isMounted) setEngineLoading(false);
          rendition.on('relocated', (location: any) => {
             if (isMounted && location?.start) {
               const percent = epub.locations.percentageFromCfi(location.start.cfi);
               const p = typeof percent === 'number' ? Math.round(percent * 100) : 0;
               setCurrentPage(prev => ({ ...prev, current: p, label: `${p}%` }));
             }
          });
          epub.ready.then(() => epub.locations.generate(1000));
        } else if (book.format === 'pdf') {
          const pdfjsLib = (window as any).pdfjsLib;
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/build/pdf.worker.min.js';
          const loadingTask = pdfjsLib.getDocument({ data: contentData });
          const doc = await loadingTask.promise;
          if (isMounted) { setPdfDoc(doc); setEngineLoading(false); setPageNum(1); }
        } else {
          // MOBI/TXT/FB2 etc...
          const text = (book.format === 'mobi' || book.format === 'azw3') 
            ? await parseMobi(contentData as ArrayBuffer)
            : typeof contentData === 'string' ? contentData : new TextDecoder().decode(contentData as ArrayBuffer);
          
          if (!isMounted) return;
          const parser = new DOMParser();
          const elements: React.ReactNode[] = [];
          text.split(/\r?\n/).forEach((l, i) => {
            if (l.trim()) elements.push(<p key={i} className="mb-4 indent-8 text-justify">{l.trim()}</p>);
          });
          setParsedElements(elements);
          setEngineLoading(false);
        }
      } catch (err: any) { console.error(err); if (isMounted) { setError(err.message); setEngineLoading(false); } }
    };
    initReader();
    return () => { isMounted = false; };
  }, [book.id]);

  useEffect(() => {
    if (renditionRef.current && book.format === 'epub') {
      renditionRef.current.themes.default({
        'body': {
          'font-family': settings.fontFamily === 'serif' ? 'Merriweather, serif' : 'Inter, sans-serif',
          'font-size': `${settings.fontSize}px`,
          'line-height': `${settings.lineHeight}`,
          'color': themeConfig.text,
          'padding': '20px',
        }
      });
    }
  }, [settings, themeConfig, book.format]);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden relative" style={{ backgroundColor: themeConfig.bg }}>
      
      {/* Top Header - Responsive */}
      <div className="absolute top-0 left-0 right-0 h-14 md:h-16 flex items-center justify-between px-4 z-50 pt-safe bg-gradient-to-b from-black/20 to-transparent md:from-transparent">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-full bg-white/10 backdrop-blur-md text-white md:text-inherit transition-all">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xs md:text-sm font-bold truncate max-w-[120px] md:max-w-md text-white md:text-inherit">{book.title}</h2>
        </div>
        <div className="flex items-center gap-2">
           {!engineLoading && (
             <div className="px-2.5 py-1 rounded-full bg-black/20 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-widest">
               {currentPage.label}
             </div>
           )}
          <button 
            onClick={() => setShowSettings(!showSettings)} 
            className={`p-2 rounded-full transition-all ${showSettings ? 'bg-indigo-600 text-white' : 'bg-black/20 md:bg-black/5 text-white md:text-inherit hover:bg-black/10'}`}
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Reader Content - 绑定外层触摸事件 */}
      <div 
        className="flex-1 relative overflow-hidden pt-14 md:pt-16 pb-safe"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {engineLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-40 bg-inherit">
            <Loader2 size={32} className="animate-spin text-indigo-600 mb-2" />
            <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Loading content...</p>
          </div>
        )}

        {/* Navigation Layers (视觉上隐藏，保留点击功能) */}
        {!engineLoading && !error && (
          <>
            <div onClick={prevPage} className="absolute left-0 top-0 bottom-0 w-[20%] z-30 cursor-pointer active:bg-black/5 group/left flex items-center justify-center">
              <ChevronLeft className="opacity-0 md:group-hover/left:opacity-30 transition-opacity" size={40} style={{ color: themeConfig.text }} />
            </div>
            <div onClick={nextPage} className="absolute right-0 top-0 bottom-0 w-[20%] z-30 cursor-pointer active:bg-black/5 group/right flex items-center justify-center">
              <ChevronRight className="opacity-0 md:group-hover/right:opacity-30 transition-opacity" size={40} style={{ color: themeConfig.text }} />
            </div>
          </>
        )}

        <div className="h-full w-full flex justify-center">
          {book.format === 'epub' && (
             <div ref={viewerRef} className="w-full max-w-5xl h-full shadow-sm md:shadow-2xl md:rounded-2xl overflow-hidden" style={{ backgroundColor: themeConfig.paper }} />
          )}

          {book.format === 'pdf' && (
             <div className="w-full h-full overflow-y-auto no-scrollbar flex justify-center bg-gray-200/50">
                <canvas ref={pdfCanvasRef} className="shadow-lg md:shadow-2xl self-start md:my-8" />
             </div>
          )}

          {['fb2', 'txt', 'rtf', 'mobi', 'azw3'].includes(book.format) && !engineLoading && (
            <div className="w-full h-full px-4 md:px-20 py-4 md:py-16 overflow-hidden">
                <div ref={textContainerRef} className="w-full h-full overflow-hidden">
                  <div 
                     style={{
                       columnWidth: `${columnWidth > 0 ? columnWidth : 'auto'}px`,
                       columnGap: '40px',
                       columnFill: 'auto',
                       height: '100%',
                       fontSize: `${settings.fontSize}px`, 
                       lineHeight: settings.lineHeight,
                       fontFamily: settings.fontFamily === 'serif' ? 'Merriweather, serif' : 'Inter, sans-serif',
                       color: themeConfig.text
                     }}
                     className="prose max-w-none"
                  >
                     {parsedElements}
                  </div>
                </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/40 z-[55] animate-in fade-in" onClick={() => setShowSettings(false)} />
          
          <div className="fixed md:absolute bottom-0 md:bottom-auto md:top-16 right-0 md:right-6 left-0 md:left-auto w-full md:w-80 bg-white md:bg-white/95 backdrop-blur-2xl shadow-2xl rounded-t-3xl md:rounded-2xl p-6 md:p-8 z-[60] border-t md:border border-gray-100 animate-in slide-in-from-bottom md:slide-in-from-top-4 duration-300">
            <div className="md:hidden w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
            
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 mb-6">Reading Settings</h4>
            
            <div className="space-y-8">
              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-3 uppercase">Theme Appearance</label>
                <div className="flex gap-3">
                  {(['light', 'dark', 'sepia'] as const).map(t => (
                    <button 
                      key={t} 
                      onClick={() => setSettings(s => ({...s, theme: t}))} 
                      className={`flex-1 h-12 rounded-xl border-2 transition-all ${
                        t === 'light' ? 'bg-white border-gray-100' : 
                        t === 'dark' ? 'bg-gray-900 border-gray-800' : 
                        'bg-[#f4ecd8] border-[#e0d5ba]'
                      } ${settings.theme === t ? 'ring-2 ring-indigo-500 ring-offset-2 scale-105' : 'opacity-60'}`}
                    />
                  ))}
                </div>
              </div>
              
              {book.format !== 'pdf' && (
                <>
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Font Size</label>
                      <span className="text-xs font-black text-indigo-600">{settings.fontSize}px</span>
                    </div>
                    <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-2xl">
                      <button onClick={() => setSettings(s => ({...s, fontSize: Math.max(12, s.fontSize - 2)}))} className="w-10 h-10 bg-white rounded-xl shadow-sm font-black text-gray-600">-</button>
                      <input type="range" min="12" max="40" step="2" value={settings.fontSize} onChange={(e) => setSettings(s => ({...s, fontSize: parseInt(e.target.value)}))} className="flex-1 accent-indigo-600 h-1 bg-gray-200 rounded-full appearance-none cursor-pointer" />
                      <button onClick={() => setSettings(s => ({...s, fontSize: Math.min(48, s.fontSize + 2)}))} className="w-10 h-10 bg-white rounded-xl shadow-sm font-black text-gray-600">+</button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
                    <button onClick={() => setSettings(s => ({...s, fontFamily: 'serif'}))} className={`py-3 rounded-lg text-xs font-bold transition-all ${settings.fontFamily === 'serif' ? 'bg-white shadow text-indigo-600' : 'text-gray-400'}`}>Serif</button>
                    <button onClick={() => setSettings(s => ({...s, fontFamily: 'sans'}))} className={`py-3 rounded-lg text-xs font-bold transition-all ${settings.fontFamily === 'sans' ? 'bg-white shadow text-indigo-600' : 'text-gray-400'}`}>Sans-Serif</button>
                  </div>
                </>
              )}
            </div>

            <button 
              onClick={() => setShowSettings(false)}
              className="md:hidden w-full mt-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100"
            >
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ReaderView;
