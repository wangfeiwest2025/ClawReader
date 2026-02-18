
import React, { useState, useEffect, useRef } from 'react';
import { Book } from '../types';
import { X, Send, Bot, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { getBookInsights, chatWithBook } from '../services/gemini';

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  contextBook: Book | null;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose, contextBook }) => {
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<{summary: string, keyInsights: string[], suggestedQuestions: string[]} | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && contextBook && !insights) {
      loadInitialInsights();
    }
  }, [isOpen, contextBook]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const loadInitialInsights = async () => {
    if (!contextBook) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getBookInsights(contextBook.title, contextBook.author);
      if (data) {
        const jsonMatch = data.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : data;
        setInsights(JSON.parse(jsonStr));
      }
    } catch (e) {
      setError("AI service unavailable. Check connection.");
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
      const response = await chatWithBook(contextBook.title, [...messages, userMsg]);
      setMessages(prev => [...prev, { role: 'model', text: response || 'No response.' }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: 'Connection failed.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed md:absolute inset-0 md:inset-y-0 md:right-0 md:left-auto w-full md:w-96 bg-white border-l border-gray-200 shadow-2xl z-[100] flex flex-col animate-in slide-in-from-right duration-300 pt-safe">
      <div className="p-4 border-b flex items-center justify-between bg-indigo-600 text-white shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={18} />
          <span className="font-bold">AI Reading Partner</span>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar" ref={scrollRef}>
        {!contextBook ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40 p-8">
            <Bot size={56} className="mb-4 text-indigo-300" />
            <p className="text-sm font-bold uppercase tracking-widest">Select a book to activate AI</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-start gap-3 text-xs border border-red-100">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {insights && messages.length === 0 && (
              <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100 space-y-4">
                <h4 className="font-bold text-indigo-800 text-xs flex items-center gap-2">
                   <Sparkles size={14} /> Book Insight
                </h4>
                <p className="text-sm text-indigo-700 leading-relaxed">{insights.summary}</p>
                {insights.keyInsights.length > 0 && (
                  <ul className="space-y-2">
                    {insights.keyInsights.map((insight, idx) => (
                      <li key={idx} className="text-[11px] text-indigo-500 flex gap-2">
                        <span className="font-bold">•</span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-2xl p-4 text-sm ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-100' 
                    : 'bg-gray-100 text-gray-800 rounded-tl-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-50 rounded-2xl px-4 py-3 flex gap-3 border border-gray-100">
                  <RefreshCw size={14} className="animate-spin text-indigo-600 self-center" />
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Thinking...</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {contextBook && (
        <div className="p-4 border-t bg-white pb-safe">
          {insights && messages.length === 0 && !isLoading && (
            <div className="flex overflow-x-auto gap-2 pb-3 no-scrollbar">
              {insights.suggestedQuestions.map((q, idx) => (
                <button 
                  key={idx}
                  onClick={() => setInputValue(q)}
                  className="whitespace-nowrap text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-600 px-3 py-2 rounded-full font-bold hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          <div className="relative">
            <input 
              type="text" 
              placeholder="Ask anything..." 
              className="w-full pl-5 pr-12 py-4 rounded-2xl border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button 
              onClick={handleSend}
              disabled={isLoading || !inputValue.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-indigo-600 text-white disabled:bg-gray-200 transition-all shadow-md active:scale-90"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
