import { Injectable, signal } from '@angular/core';

export interface Book {
  hash: string;
  file: Uint8Array;
  title: string;
  numPages: number;
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
    const dBOpenRequest = window.indexedDB.open(this.DB_NAME, 3);

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
      const objectStore = this.db!.createObjectStore(this.BOOKS_OBJECT_STORE, { keyPath: 'title' });

      // Define what data items the objectStore will contain
      objectStore.createIndex('file', 'file', { unique: false });
      objectStore.createIndex('numPages', 'numPages', { unique: false });
      objectStore.createIndex('currentPage', 'currentPage', { unique: false });
      console.log('Object store created.');
    };
  }

  async addBook(data: Book) {
    return await this.singleOperationOnObjectStore(this.BOOKS_OBJECT_STORE, 'readwrite', (objectStore) =>
      objectStore.add(data)
    );
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
