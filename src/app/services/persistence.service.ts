import { Injectable, signal } from '@angular/core';

export interface Book {
  file: Uint8Array;
  title: string;
  numPages: number;
  currentPage: number;
}

@Injectable({
  providedIn: 'root'
})
export class PersistenceService {

  db?: IDBDatabase;
  books = signal<Book[]>([]);

  private DB_NAME = 'library';
  private OBJECT_STORE_NAME = 'books';

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
      this.db = (event.target as any).result;

      this.db!.onerror = (event) => {
        console.error('Error loading database.');
      };

      // Create an objectStore for this database
      const objectStore = this.db!.createObjectStore(this.OBJECT_STORE_NAME, { keyPath: 'title' });

      // Define what data items the objectStore will contain
      objectStore.createIndex('file', 'file', { unique: false });
      objectStore.createIndex('numPages', 'numPages', { unique: false });
      objectStore.createIndex('currentPage', 'currentPage', { unique: false });
      console.log('Object store created.');
    };
  }

  addBook(data: Book) {
    if (!this.db) throw Error('DB not initialised.');

    // Open a read/write DB transaction, ready for adding the data
    const transaction = this.db.transaction(this.OBJECT_STORE_NAME, 'readwrite');

    // Report on the success of the transaction completing, when everything is done
    transaction.oncomplete = (event) => {
      console.log(event);
    };

    // Handler for any unexpected error
    transaction.onerror = () => {
      console.error(`Transaction not opened due to error: ${transaction.error}`);
    };

    // Call an object store that's already been added to the database
    const objectStore = transaction.objectStore(this.OBJECT_STORE_NAME);

    // Make a request to add our newItem object to the object store
    const objectStoreRequest = objectStore.add(data);

    objectStoreRequest.onsuccess = (event) => {
      console.log('Request successful.', event);
    };
  }

  deleteBook(book: Book) {
    if (!this.db) throw Error('DB not initialised.');

    // Open a database transaction and delete the task, finding it by the name we retrieved above
    const transaction = this.db.transaction([this.OBJECT_STORE_NAME], 'readwrite');
    transaction.objectStore(this.OBJECT_STORE_NAME).delete(book.title);

    // Report that the data item has been deleted
    transaction.oncomplete = () => {
      console.log(`Book "${book.title}" deleted.`);
    };
  };

  getAllBooks() {
    if (!this.db) throw Error('DB not initialised.');
    const result = [] as Book[];
    const transaction = this.db.transaction([this.OBJECT_STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(this.OBJECT_STORE_NAME);
    const request = objectStore.openCursor();

    return new Promise<Book[]>((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as any).result;

        // Check if there are no (more) cursor items to iterate through
        if (!cursor) {
          // No more items to iterate through, we quit.
          resolve(result);
          return;
        }

        result.push(cursor.value);

        // continue on to the next item in the cursor
        cursor.continue();
      }
    });
  }

}
