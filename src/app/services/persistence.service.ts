import { Injectable, signal } from '@angular/core';

export interface Book {
  hash: string;
  file: Uint8Array;
  title: string;
  numPages: number;
}

export interface Progress {
  bookHash: string;
  currentPage: number;
  currentTextItem: number;
}

@Injectable({
  providedIn: 'root'
})
export class PersistenceService {

  db?: IDBDatabase;
  books = signal<Book[]>([]);

  private DB_NAME = 'library';
  private BOOKS_OBJECT_STORE = 'books';
  private PROGRESS_OBJECT_STORE = 'progress';

  constructor() {
    const dBOpenRequest = window.indexedDB.open(this.DB_NAME, 4);

    dBOpenRequest.onerror = (event) => {
      console.error('Error loading database.');
    };

    dBOpenRequest.onsuccess = (event) => {
      console.log('Database initialised.');

      // Store the result of opening the database in the db variable. This is used a lot below
      this.db = dBOpenRequest.result;

      this.getAllBooks().then(books => {
        this.books.set(books);
      });
    };

    // This event handles the event whereby a new version of the database needs to be created
    // Either one has not been created before, or a new version number has been submitted via the
    // window.indexedDB.open line above
    //it is only implemented in recent browsers
    dBOpenRequest.onupgradeneeded = (event) => {
      this.db = dBOpenRequest.result;

      this.db.onerror = (event) => {
        console.error('Error loading database.');
      };

      // Create an objectStore for this database
      const bookObjectStore = this.db!.createObjectStore(this.BOOKS_OBJECT_STORE, { keyPath: 'hash' });
      const progressObjectStore = this.db!.createObjectStore(this.PROGRESS_OBJECT_STORE, { keyPath: 'bookHash' });

      // Define what data items the objectStore will contain
      bookObjectStore.createIndex('file', 'file', { unique: false });
      bookObjectStore.createIndex('numPages', 'numPages', { unique: false });
      bookObjectStore.createIndex('currentPage', 'currentPage', { unique: false });
      console.log('Object stores created.');
    };
  }

  async addBook(book: Book) {
    return await new Promise<void>((resolve, reject) => {
      if (!this.db) throw Error('DB not initialised.');
      const transaction = this.db.transaction([this.BOOKS_OBJECT_STORE, this.PROGRESS_OBJECT_STORE], 'readwrite');
      const bookObjectStore = transaction.objectStore(this.BOOKS_OBJECT_STORE);
      const progressObjectStore = transaction.objectStore(this.PROGRESS_OBJECT_STORE);
      const progress = { bookHash: book.hash, currentPage: 0, currentTextItem: 0 } as Progress;
      bookObjectStore.add(book);
      progressObjectStore.add(progress);
      transaction.oncomplete = () => resolve();
    });
  }

  async deleteBook(book: Book) {
    return await this.singleOperationOnObjectStore(this.BOOKS_OBJECT_STORE, 'readwrite', (objectStore) =>
      objectStore.delete(book.title)
    );
  };

  async updateBook(book: Book) {
    return await this.singleOperationOnObjectStore(this.BOOKS_OBJECT_STORE, 'readwrite', (objectStore) =>
      objectStore.put(book)
    );
  }

  async updateProgress(progress: Progress) {
    return await this.singleOperationOnObjectStore(this.PROGRESS_OBJECT_STORE, 'readwrite', (objectStore) =>
      objectStore.put(progress)
    );
  }

  async getProgress(hash: string): Promise<Progress> {
    return await this.singleOperationOnObjectStore(this.PROGRESS_OBJECT_STORE, 'readonly', (objectStore) =>
      objectStore.get(hash)
    );
  }

  async getAllBooks() {
    const result = [] as Book[];
    await this.cursorOperationOnObjectStore(this.BOOKS_OBJECT_STORE, "readonly", (value) => {
      result.push(value);
    });
    return result;
  }

  private singleOperationOnObjectStore<T = any>(name: string, mode: IDBTransactionMode, operation: (objectStore: IDBObjectStore) => IDBRequest<T | null> | IDBRequest<T> | IDBRequest<undefined>) {
    return new Promise<T>((resolve, reject) => {
      if (!this.db) throw Error('DB not initialised.');
      const transaction = this.db.transaction(name, mode);
      const objectStore = transaction.objectStore(name);
      const request = operation(objectStore);

      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
      request.onsuccess = () => resolve(request.result!);
    });
  }

  private multiOperationOnObjectStore(name: string, mode: IDBTransactionMode, operations: Array<(objectStore: IDBObjectStore) => IDBRequest<any>>) {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) throw Error('DB not initialised.');
      const transaction = this.db.transaction(name, mode);
      const objectStore = transaction.objectStore(name);
      operations.forEach(operation => {
        const request = operation(objectStore);
        request.onerror = () => reject(request.error);
      });

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  }

  private cursorOperationOnObjectStore<T = any>(name: string, mode: IDBTransactionMode, operation: (value: T) => void) {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) throw Error('DB not initialised.');
      const transaction = this.db.transaction(name, mode);
      const objectStore = transaction.objectStore(name);
      const request = objectStore.openCursor();

      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
      request.onsuccess = () => {
        const cursor = request.result!;
        if (cursor) {
          operation(cursor.value);
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }
}
