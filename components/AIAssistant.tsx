
import React, { useState, useEffect, useRef } from 'react';
import { Book } from '../types';
import { X, Send, Bot, Sparkles, RefreshCw, AlertCircle, FileText, Minus, Loader2 } from 'lucide-react';
import { getBookInsights, chatWithBook } from '../services/gemini';
import { extractBookText } from '../utils/textExtractor';

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  contextBook: Book | null;
}

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null;

const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose, contextBook }) => {
  // --- Chat Logic State ---
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [insights, setInsights] = useState<{summary: string, keyInsights: string[], suggestedQuestions: string[]} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- Window Management State ---
  const [isMinimized, setIsMinimized] = useState(false);
  // Default position
  const [position, setPosition] = useState({ x: window.innerWidth - 420, y: 80 });
  const [size, setSize] = useState({ width: 380, height: 600 });
  
  const [isDragging, setIsDragging] = useState(false);
  const [resizeDir, setResizeDir] = useState<ResizeDir>(null);
  
  const dragStartRef = useRef({ x: 0, y: 0 }); 
  const initialPosRef = useRef({ x: 0, y: 0 }); 
  const initialSizeRef = useRef({ width: 0, height: 0 }); 

  // --- Data Loading Effects ---
  useEffect(() => {
    if (isOpen && contextBook) {
      if (!isMinimized) {
         // Logic when opening
      }
      if (messages.length === 0 && !insights && !extractedText) {
         handleInitialLoad();
      }
    }
  }, [isOpen, contextBook?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, isExtracting, isMinimized]);

  // --- Window Interaction Handlers ---

  useEffect(() => {
    const handleResize = () => {
       setPosition(p => ({
         x: Math.min(p.x, window.innerWidth - 100),
         y: Math.min(p.y, window.innerHeight - 100)
       }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Global Mouse Move / Up listeners for Drag & Resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // 1. Moving Window
      if (isDragging) {
        e.preventDefault();
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        setPosition({
          x: initialPosRef.current.x + dx,
          y: initialPosRef.current.y + dy
        });
      }
      
      // 2. Resizing Window
      if (resizeDir) {
        e.preventDefault();
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        
        let newW = initialSizeRef.current.width;
        let newH = initialSizeRef.current.height;
        let newX = initialPosRef.current.x;
        let newY = initialPosRef.current.y;

        // Horizontal Resize
        if (resizeDir.includes('e')) { // Right edge
            newW = Math.max(300, initialSizeRef.current.width + dx);
        } else if (resizeDir.includes('w')) { // Left edge
            const w = Math.max(300, initialSizeRef.current.width - dx);
            // If we shrink/grow from left, we must also move X
            newX = initialPosRef.current.x + (initialSizeRef.current.width - w);
            newW = w;
        }

        // Vertical Resize
        if (resizeDir.includes('s')) { // Bottom edge
            newH = Math.max(400, initialSizeRef.current.height + dy);
        } else if (resizeDir.includes('n')) { // Top edge
            const h = Math.max(400, initialSizeRef.current.height - dy);
            // If we shrink/grow from top, we must also move Y
            newY = initialPosRef.current.y + (initialSizeRef.current.height - h);
            newH = h;
        }

        setSize({ width: newW, height: newH });
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setResizeDir(null);
    };

    if (isDragging || resizeDir) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      // Add a transparent overlay to capture events even if mouse goes over iframes or outside
      document.body.style.cursor = isDragging ? 'move' : resizeDir ? `${resizeDir}-resize` : 'default';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, resizeDir]);

  const startDrag = (e: React.MouseEvent) => {
    if (window.innerWidth >= 768) {
        // Prevent drag if clicking buttons
        if ((e.target as HTMLElement).closest('button')) return;
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        initialPosRef.current = { ...position };
    }
  };

  const startResize = (e: React.MouseEvent, dir: ResizeDir) => {
    e.stopPropagation();
    e.preventDefault();
    setResizeDir(dir);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPosRef.current = { ...position };
    initialSizeRef.current = { ...size };
  };

  // --- Core AI Logic ---

  const handleInitialLoad = async () => {
    if (!contextBook) return;
    setIsLoading(true);
    setIsExtracting(true);
    setError(null);

    try {
      const text = await extractBookText(contextBook, 60000);
      setExtractedText(text);
      setIsExtracting(false);

      const data = await getBookInsights(contextBook.title, contextBook.author, undefined, text);
      if (data) {
        const jsonMatch = data.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : data;
        setInsights(JSON.parse(jsonStr));
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || "AI service unavailable.");
      setIsExtracting(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !contextBook) return;
    const userMsg = { role: 'user' as const, text: inputValue };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);
    try {
      const response = await chatWithBook(contextBook.title, [...messages, userMsg], extractedText);
      setMessages(prev => [...prev, { role: 'model', text: response || 'No response.' }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'model', text: `⚠️ ${e.message || 'Connection failed.'}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  // --- Render: Minimized State ---
  if (isMinimized) {
    return (
      <div 
        className="fixed z-[100] cursor-pointer animate-in zoom-in duration-300 hover:scale-110 transition-transform shadow-2xl shadow-indigo-500/40 rounded-full"
        style={{ 
          left: window.innerWidth < 768 ? 'auto' : position.x, 
          top: window.innerWidth < 768 ? 'auto' : position.y,
          right: window.innerWidth < 768 ? '20px' : 'auto',
          bottom: window.innerWidth < 768 ? '100px' : 'auto' 
        }}
        onClick={() => setIsMinimized(false)}
      >
        <div className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center text-white border-4 border-white">
          <Bot size={28} />
          {isLoading && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-sky-500"></span>
            </span>
          )}
        </div>
      </div>
    );
  }

  // --- Render: Full/Windowed State ---
  return (
    <div 
      className={`fixed z-[100] bg-white shadow-2xl flex flex-col animate-in fade-in duration-200 overflow-hidden
        md:rounded-2xl md:border md:border-gray-200
        ${window.innerWidth < 768 ? 'inset-0 top-safe bottom-0 w-full h-full rounded-none' : ''}
      `}
      style={window.innerWidth >= 768 ? { 
        left: position.x, 
        top: position.y, 
        width: size.width, 
        height: size.height 
      } : {}}
    >
      {/* --- Resize Handles (Desktop Only) --- */}
      {window.innerWidth >= 768 && (
        <>
          {/* Edges */}
          <div className="absolute top-0 left-2 right-2 h-2 cursor-n-resize z-50 hover:bg-indigo-500/20 transition-colors" onMouseDown={(e) => startResize(e, 'n')} />
          <div className="absolute bottom-0 left-2 right-2 h-2 cursor-s-resize z-50 hover:bg-indigo-500/20 transition-colors" onMouseDown={(e) => startResize(e, 's')} />
          <div className="absolute left-0 top-2 bottom-2 w-2 cursor-w-resize z-50 hover:bg-indigo-500/20 transition-colors" onMouseDown={(e) => startResize(e, 'w')} />
          <div className="absolute right-0 top-2 bottom-2 w-2 cursor-e-resize z-50 hover:bg-indigo-500/20 transition-colors" onMouseDown={(e) => startResize(e, 'e')} />
          
          {/* Corners */}
          <div className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-50" onMouseDown={(e) => startResize(e, 'nw')} />
          <div className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-50" onMouseDown={(e) => startResize(e, 'ne')} />
          <div className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-50" onMouseDown={(e) => startResize(e, 'sw')} />
          <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-50" onMouseDown={(e) => startResize(e, 'se')} />
        </>
      )}

      {/* Header Bar */}
      <div 
        className={`p-3 border-b flex items-center justify-between bg-indigo-600 text-white shrink-0 select-none ${window.innerWidth >= 768 ? 'cursor-move' : ''}`}
        onMouseDown={startDrag}
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <Sparkles size={16} />
          <span className="font-bold text-sm">AI Assistant</span>
          {isExtracting && <Loader2 size={12} className="animate-spin opacity-70" />}
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }} 
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title="Minimize"
          >
            <Minus size={16} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }} 
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors hover:bg-red-500"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-gray-50/50 scrollbar-thin scrollbar-thumb-gray-200" ref={scrollRef}>
        {!contextBook ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40 p-8">
            <Bot size={56} className="mb-4 text-indigo-300" />
            <p className="text-sm font-bold uppercase tracking-widest">No Book Selected</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl flex items-start gap-2 text-xs border border-red-100">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            
            {extractedText && !isExtracting && messages.length === 0 && !insights && (
               <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400 uppercase font-bold tracking-wider opacity-60">
                 <FileText size={10} />
                 <span>Context Loaded ({Math.round(extractedText.length / 1024)}KB)</span>
               </div>
            )}

            {isExtracting && (
               <div className="flex flex-col items-center justify-center py-8 gap-3 animate-pulse">
                  <div className="relative">
                    <FileText size={32} className="text-indigo-200" />
                    <RefreshCw size={12} className="absolute -bottom-1 -right-1 text-indigo-500 animate-spin" />
                  </div>
                  <p className="text-xs text-indigo-400 font-medium">Analyzing content...</p>
               </div>
            )}

            {!isExtracting && insights && messages.length === 0 && (
              <div className="bg-white rounded-xl p-4 border border-indigo-100 shadow-sm space-y-3 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 mb-1">
                   <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600"><Sparkles size={14} /></div>
                   <h4 className="font-bold text-gray-800 text-xs">Quick Summary</h4>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{insights.summary}</p>
                {insights.keyInsights.length > 0 && (
                  <div className="pt-2 border-t border-gray-50">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Key Takeaways</span>
                    <ul className="space-y-2">
                      {insights.keyInsights.map((insight, idx) => (
                        <li key={idx} className="text-[11px] text-gray-600 flex gap-2 items-start">
                          <span className="text-indigo-500 font-bold mt-0.5">•</span>
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-sm' 
                    : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}

            {isLoading && !isExtracting && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl px-4 py-3 flex gap-2 border border-gray-100 items-center shadow-sm">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input Area */}
      {contextBook && (
        <div className="p-3 border-t bg-white pb-safe">
          {insights && messages.length === 0 && !isLoading && !isExtracting && (
            <div className="flex overflow-x-auto gap-2 pb-3 mb-1 no-scrollbar mask-fade-right">
              {insights.suggestedQuestions.map((q, idx) => (
                <button 
                  key={idx}
                  onClick={() => setInputValue(q)}
                  className="whitespace-nowrap text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full font-medium hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          
          <div className="relative flex items-center gap-2">
            <input 
              type="text" 
              placeholder={isExtracting ? "Analysing book..." : "Ask questions..."}
              className="flex-1 pl-4 pr-10 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isExtracting && handleSend()}
              disabled={isExtracting}
            />
            <button 
              onClick={handleSend}
              disabled={isLoading || isExtracting || !inputValue.trim()}
              className="absolute right-1.5 p-1.5 rounded-lg bg-indigo-600 text-white disabled:bg-gray-300 hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Simple visual indicator for bottom-right resize corner */}
      {window.innerWidth >= 768 && (
        <div className="absolute bottom-1 right-1 pointer-events-none">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-30">
            <path d="M8 8H0L8 0V8Z" fill="#94a3b8"/>
          </svg>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
