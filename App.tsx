
import React, { useState, useEffect } from 'react';
import { Book, BookFormat } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LibraryView from './components/LibraryView';
import ReaderView from './components/ReaderView';
import ConverterView from './components/ConverterView';
import AIAssistant from './components/AIAssistant';
import InfoModal, { InfoType } from './components/InfoModal';
import { getAllBooksFromDB, saveBookToDB, deleteBookFromDB } from './services/storage';
import { AlertTriangle } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'library' | 'reader' | 'converter'>('library');
  const [books, setBooks] = useState<Book[]>([]);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal State
  const [bookToDelete, setBookToDelete] = useState<string | null>(null);
  const [infoModalType, setInfoModalType] = useState<InfoType>(null);

  useEffect(() => {
    const loadBooks = async () => {
      try {
        const storedBooks = await getAllBooksFromDB();
        setBooks(storedBooks);
      } catch (e) {
        console.error("Load failed", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadBooks();
  }, []);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const format = file.name.split('.').pop()?.toLowerCase() as BookFormat;
      if (!['epub', 'pdf', 'mobi', 'fb2', 'txt', 'rtf', 'azw3'].includes(format)) return;

      const reader = new FileReader();
      reader.onload = async () => {
        const result = reader.result;
        if (!result) return;

        let content: string | ArrayBuffer = result;
        if (['txt', 'fb2', 'rtf'].includes(format) && result instanceof ArrayBuffer) {
          const decoder = new TextDecoder('utf-8', { fatal: true });
          try { content = decoder.decode(new Uint8Array(result)); } 
          catch (e) { content = new TextDecoder('gbk').decode(new Uint8Array(result)); }
        }

        const newBook: Book = {
          id: 'book-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
          title: file.name.replace(/\.[^/.]+$/, ""),
          author: 'Unknown Author',
          format,
          content: content,
          addedAt: Date.now(),
          cover: `https://picsum.photos/seed/${Math.random()}/400/600`
        };
        
        try {
          await saveBookToDB(newBook);
          setBooks(prev => [newBook, ...prev]);
        } catch (err) { console.error(err); }
      };
      reader.readAsArrayBuffer(file);
    });
    e.target.value = '';
  };

  const openReader = (book: Book) => {
    setCurrentBook(book);
    setActiveTab('reader');
  };

  const confirmDelete = async () => {
    if (!bookToDelete) return;
    const id = bookToDelete;
    setBookToDelete(null);
    const originalBooks = [...books];
    if (currentBook?.id === id) {
      setCurrentBook(null);
      if (activeTab === 'reader') setActiveTab('library');
    }
    setBooks(prev => prev.filter(b => b.id !== id));
    try {
      await deleteBookFromDB(id);
    } catch (e) {
      setBooks(originalBooks);
      alert("Delete failed.");
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-white text-gray-900 overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onImport={handleFileImport} />
      
      <main className="flex-1 flex flex-col relative overflow-hidden bg-white">
        {activeTab !== 'reader' && (
          <Header 
            activeTab={activeTab}
            currentBook={currentBook}
            toggleAI={() => setIsAiOpen(!isAiOpen)}
            isAiOpen={isAiOpen}
          />
        )}
        
        <div className={`flex-1 ${activeTab === 'reader' ? 'overflow-hidden' : 'overflow-auto no-scrollbar'} bg-[#fafafa]`}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
              <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Waking Up Engine...</p>
            </div>
          ) : (
            <>
              {activeTab === 'library' && (
                <LibraryView 
                  books={books} 
                  onOpen={openReader} 
                  onDelete={setBookToDelete} 
                  onOpenInfo={setInfoModalType}
                />
              )}
              {activeTab === 'reader' && currentBook && (
                <ReaderView book={currentBook} onBack={() => setActiveTab('library')} />
              )}
              {activeTab === 'converter' && (
                <ConverterView books={books} />
              )}
            </>
          )}
        </div>

        {/* AI Side Drawer (Desktop) / Full Screen (Mobile) */}
        <AIAssistant 
          isOpen={isAiOpen} 
          onClose={() => setIsAiOpen(false)} 
          contextBook={currentBook}
        />

        {/* Legal Info Modal */}
        <InfoModal type={infoModalType} onClose={() => setInfoModalType(null)} />

        {/* Delete Modal */}
        {bookToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-gray-100 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 text-red-600 mb-4">
                <AlertTriangle size={24} />
                <h3 className="text-lg font-bold text-gray-900">Confirm Deletion</h3>
              </div>
              <p className="text-gray-500 mb-6 text-sm">
                Permanently remove this book from your local storage? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setBookToDelete(null)} className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm">Cancel</button>
                <button onClick={confirmDelete} className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-bold text-sm shadow-lg shadow-red-100">Delete</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
