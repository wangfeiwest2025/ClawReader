const DB_NAME = 'ClawReaderDB';
const STORE_NAME = 'books';
const DB_VERSION = 4; // Version 4: Force recreate object store to fix any schema/key issues

let dbInstance: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      console.log(`[DB] Upgrading database to version ${DB_VERSION} - Resetting Store`);
      const db = request.result;
      
      // Critical fix: Delete old store to remove any corrupted data or schema mismatches
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      
      // Create fresh store with correct keyPath
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };

    request.onsuccess = () => {
      console.log("[DB] Database opened successfully");
      dbInstance = request.result;
      
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      
      dbInstance.onclose = () => {
        dbInstance = null;
      };

      resolve(dbInstance);
    };
    
    request.onerror = (event) => {
      console.error("[DB] Database open failed", request.error);
      reject(request.error);
    };
  });
};

export const saveBookToDB = async (book: any) => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(book);
      
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error("Save book error:", error);
    throw error;
  }
};

export const getAllBooksFromDB = async (): Promise<any[]> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Get all books error:", error);
    return [];
  }
};

export const deleteBookFromDB = async (id: string): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      console.log(`[DB] Deleting book: ${id}`);
      
      store.delete(id);

      transaction.oncomplete = () => {
        console.log(`[DB] Successfully deleted book: ${id}`);
        resolve();
      };
      
      transaction.onerror = (event) => {
        console.error(`[DB] Delete failed:`, transaction.error);
        reject(transaction.error);
      };
      
      transaction.onabort = () => {
        reject(new Error("Transaction aborted"));
      };
    });
  } catch (error) {
    console.error("Delete book error:", error);
    throw error;
  }
};