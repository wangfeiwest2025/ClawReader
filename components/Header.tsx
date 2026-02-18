import React from 'react';
import { Book } from '../types';
import { Sparkles, Search, Bell, Menu } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  currentBook: Book | null;
  toggleAI: () => void;
  isAiOpen: boolean;
}

const Header: React.FC<HeaderProps> = ({ activeTab, currentBook, toggleAI, isAiOpen }) => {
  const getTitle = () => {
    switch (activeTab) {
      case 'library': return 'My Library';
      case 'reader': return 'Reader';
      case 'converter': return 'Converter';
      default: return 'ClawReader';
    }
  };

  return (
    <header className="h-14 md:h-20 border-b border-gray-100 bg-white px-4 md:px-8 flex items-center justify-between z-10 shrink-0 sticky top-0 pt-safe">
      <div className="flex items-center gap-3">
        <h2 className="text-lg md:text-2xl font-black text-gray-900 tracking-tight">
          {getTitle()}
        </h2>
        {activeTab === 'library' && (
          <div className="hidden sm:flex items-center gap-2 ml-4 px-3 py-1.5 bg-gray-50 rounded-full border border-gray-100">
            <Search size={14} className="text-gray-400" />
            <input 
              type="text" 
              placeholder="Search books..." 
              className="bg-transparent border-none outline-none text-xs font-medium w-32 md:w-48"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Only show AI button if we have a context or general assistant */}
        <button 
          onClick={toggleAI}
          className={`flex items-center gap-2 px-3 py-1.5 md:px-5 md:py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all shadow-sm ${
            isAiOpen 
              ? 'bg-indigo-600 text-white shadow-indigo-200' 
              : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
          }`}
        >
          <Sparkles size={16} className={isAiOpen ? "animate-pulse" : ""} />
          <span className="hidden sm:inline">{isAiOpen ? 'Close AI' : 'AI Assistant'}</span>
          <span className="sm:hidden">AI</span>
        </button>
        
        <div className="hidden md:flex items-center gap-2">
          <button className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
            <Bell size={20} />
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 border-2 border-white shadow-sm" />
        </div>
      </div>
    </header>
  );
};

export default Header;