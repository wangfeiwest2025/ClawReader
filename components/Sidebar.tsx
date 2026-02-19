
import React, { useRef } from 'react';
import { BookOpen, Library, RefreshCcw, Plus, Settings } from 'lucide-react';

interface SidebarProps {
  activeTab: 'library' | 'reader' | 'converter';
  setActiveTab: (tab: 'library' | 'reader' | 'converter') => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenSettings: () => void;
  isOpen: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onImport, onOpenSettings, isOpen }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const navItems = [
    { id: 'library', label: 'Library', icon: Library },
    { id: 'reader', label: 'Reader', icon: BookOpen },
    { id: 'converter', label: 'Converter', icon: RefreshCcw },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside 
        className={`hidden md:flex flex-col border-r border-gray-200 bg-gray-50 shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? 'w-64 p-4 opacity-100' : 'w-0 p-0 opacity-0 border-none'
        }`}
      >
        <div className="min-w-[14rem]"> {/* Inner wrapper to prevent content squashing during transition */}
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shrink-0">
              <BookOpen size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-gray-800 whitespace-nowrap">ClawReader</h1>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full mb-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 whitespace-nowrap"
          >
            <Plus size={20} />
            <span className="font-semibold">Add Book</span>
          </button>

          <nav className="space-y-1 flex-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium whitespace-nowrap ${
                  activeTab === item.id 
                    ? 'bg-indigo-50 text-indigo-600' 
                    : 'text-gray-500 hover:bg-gray-200'
                }`}
              >
                <item.icon size={20} className="shrink-0" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="border-t border-gray-200 pt-4">
            <button 
              onClick={onOpenSettings}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-gray-200 transition-colors font-medium whitespace-nowrap"
            >
              <Settings size={20} className="shrink-0" />
              Settings
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 flex items-center justify-around px-2 pb-safe z-[40]">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className={`flex flex-col items-center gap-1 py-3 px-4 transition-all ${
              activeTab === item.id ? 'text-indigo-600' : 'text-gray-400'
            }`}
          >
            <item.icon size={22} className={activeTab === item.id ? 'scale-110' : ''} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
          </button>
        ))}
        
        {/* Mobile FAB style import button inside Nav or as a separate FAB */}
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="bg-indigo-600 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg -translate-y-4 border-4 border-white active:scale-90 transition-transform"
        >
          <Plus size={24} />
        </button>
      </nav>

      {/* Hidden Global File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        multiple 
        accept=".epub,.pdf,.mobi,.fb2,.txt,.rtf,.azw3"
        onChange={onImport}
      />
    </>
  );
};

export default Sidebar;
