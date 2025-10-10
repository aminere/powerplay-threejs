
class IndexedDb {   
    
    private _database: IDBDatabase | null = null;

    initialize(dbName: string, version: number) {
        return new Promise<void>((resolve, reject) => {
            const dbFactory: IDBFactory = window.indexedDB;
            if (!dbFactory) {
                reject("IndexedDbCreationFailed");
                return;
            }
            const request = dbFactory.open(dbName, version);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (db.objectStoreNames.contains("files") === false) {
                    db.createObjectStore("files");
                }
            };
            request.onsuccess = () => {
                this._database = request.result;
                resolve();
            };
            request.onerror = () => reject("IndexedDbCreationFailed");
        });
    }

    read(store: string, key: string) {
        return new Promise<object>((resolve, reject) => {
            const transaction = this._database!.transaction([store], "readonly");
            const objectStore = transaction.objectStore(store);           
            const request = objectStore.get(key);
            request.onsuccess = () => {
                if (request.result) {                   
                    resolve(request.result);
                } else {                    
                    reject(request.result);
                }
            };
            request.onerror = () => reject(request.result);
        });
    }

    write(store: string, key: string, data: object) {
        return new Promise<void>((resolve, reject) => {
            const transaction = this._database!.transaction([store], "readwrite");
            const objectStore = transaction.objectStore(store);            
            const request = objectStore.put(data, key);
            request.onsuccess = () => {
                resolve();
            };
            request.onerror = () => {
                reject(request.result);
            };
        });
    }
}

export const indexedDb = new IndexedDb();

