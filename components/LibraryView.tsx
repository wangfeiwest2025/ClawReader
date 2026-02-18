import React from 'react';
import { Book } from '../types';
import { Trash2, Play, Book as BookIcon } from 'lucide-react';
import { InfoType } from './InfoModal';

interface LibraryViewProps {
  books: Book[];
  onOpen: (book: Book) => void;
  onDelete: (id: string) => void;
  onOpenInfo: (type: InfoType) => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({ books, onOpen, onDelete, onOpenInfo }) => {
  return (
    <div className="flex flex-col min-h-full">
      <div className="p-4 md:p-8 flex-1">
        <div className="flex justify-between items-center mb-6 md:mb-10">
          <div>
            <h3 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">我的藏书</h3>
            <div className="flex items-center gap-2 text-gray-400 font-bold text-[10px] md:text-xs uppercase mt-1 md:mt-2 tracking-widest">
              <BookIcon size={12} className="md:w-[14px] md:h-[14px]" />
              <span>LIBRARY • {books.length} ITEMS</span>
            </div>
          </div>
        </div>

        {books.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 md:py-48 border-2 border-dashed border-gray-200 rounded-[2rem] md:rounded-[3rem] bg-gray-50/30">
             <p className="text-gray-400 font-black text-base md:text-lg">书库目前是空的</p>
             <p className="text-gray-400 text-xs md:text-sm mt-2">点击底部的 + 号添加书籍</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-12">
            {books.map((book) => (
              <div key={book.id} className="relative group animate-in fade-in slide-in-from-bottom-2 duration-300">
                
                <div className="flex flex-col h-full">
                  <div className="relative aspect-[3/4.2] rounded-xl md:rounded-2xl shadow-sm md:shadow-md transition-all duration-500 group-hover:shadow-2xl group-hover:-translate-y-2 bg-gray-100 border border-gray-100 overflow-hidden">
                    
                    {/* Book Cover Action */}
                    <div 
                      className="absolute inset-0 cursor-pointer z-0"
                      onClick={() => onOpen(book)}
                    >
                      <img 
                        src={book.cover} 
                        alt={book.title} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        loading="lazy"
                      />
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-40 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300" />

                      {/* Format Badge */}
                      <div className="absolute top-2 left-2 z-10 bg-black/40 backdrop-blur-md text-white/90 text-[8px] md:text-[9px] font-black px-1.5 py-0.5 md:px-2 md:py-1 rounded md:rounded-md uppercase tracking-wider border border-white/10">
                        {book.format}
                      </div>

                      {/* Play Button Overlay (Visible on hover or mobile always subtly) */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 z-10">
                          <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30 shadow-2xl">
                            <Play fill="currentColor" size={16} className="md:w-[20px] md:h-[20px] ml-1" />
                          </div>
                      </div>
                    </div>

                    {/* Mobile-Friendly Delete Button */}
                    <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2 z-20">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(book.id);
                        }}
                        className="w-8 h-8 md:w-9 md:h-9 bg-white/90 backdrop-blur text-gray-500 hover:text-white hover:bg-red-500 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg transition-all duration-200 active:scale-90"
                      >
                        <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Footer Info */}
                  <div className="mt-2.5 px-0.5">
                    <h4 
                      onClick={() => onOpen(book)}
                      className="font-bold text-gray-900 line-clamp-2 text-[12px] md:text-[13px] leading-snug hover:text-indigo-600 transition-colors cursor-pointer"
                    >
                      {book.title}
                    </h4>
                    <p className="text-[9px] md:text-[10px] text-gray-400 font-bold uppercase mt-0.5 md:mt-1 tracking-tight truncate">{book.author}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer for AdSense Compliance */}
      <footer className="w-full py-8 border-t border-gray-100 mt-auto bg-gray-50 mb-20 md:mb-0">
         <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-[10px] text-gray-400 font-medium">
               &copy; {new Date().getFullYear()} ClawReader. All rights reserved.
            </div>
            <div className="flex flex-wrap justify-center gap-6">
               <button onClick={() => onOpenInfo('about')} className="text-[10px] font-bold text-gray-500 hover:text-indigo-600 uppercase tracking-wider transition-colors">About Us</button>
               <button onClick={() => onOpenInfo('privacy')} className="text-[10px] font-bold text-gray-500 hover:text-indigo-600 uppercase tracking-wider transition-colors">Privacy Policy</button>
               <button onClick={() => onOpenInfo('terms')} className="text-[10px] font-bold text-gray-500 hover:text-indigo-600 uppercase tracking-wider transition-colors">Terms of Service</button>
               <button onClick={() => onOpenInfo('about')} className="text-[10px] font-bold text-gray-500 hover:text-indigo-600 uppercase tracking-wider transition-colors">Contact</button>
            </div>
         </div>
      </footer>
    </div>
  );
};

export default LibraryView;