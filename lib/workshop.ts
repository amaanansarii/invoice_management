export type BikeStatus = 'servicing' | 'serviced' | 'delivered' | 'paid';
export type WorkshopJob = {
  id: string;
  bikeName: string;
  bikeNumber: string;
  customerName: string;
  customerPhone: string;
  status: BikeStatus;
  amount: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
};

const DB_NAME = 'naeem-invoice-db';
const DB_VERSION = 2;
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Browser storage is unavailable.'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('invoices')) {
        const store = db.createObjectStore('invoices', { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt'); store.createIndex('number', 'number', { unique: true });
      }
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('workshopJobs')) {
        const store = db.createObjectStore('workshopJobs', { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open local database.'));
  });
}
export async function getWorkshopJobs(): Promise<WorkshopJob[]> {
  const db = await openDB();
  const jobs = await new Promise<WorkshopJob[]>((resolve, reject) => {
    const req = db.transaction('workshopJobs', 'readonly').objectStore('workshopJobs').getAll();
    req.onsuccess = () => resolve(req.result as WorkshopJob[]); req.onerror = () => reject(req.error);
  });
  db.close(); return jobs.sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function saveWorkshopJob(job: WorkshopJob): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('workshopJobs', 'readwrite'); tx.objectStore('workshopJobs').put(job);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  }); db.close();
}
export async function deleteWorkshopJob(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('workshopJobs', 'readwrite'); tx.objectStore('workshopJobs').delete(id);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  }); db.close();
}
export async function replaceWorkshopJobs(jobs: WorkshopJob[]): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('workshopJobs', 'readwrite'); const store = tx.objectStore('workshopJobs');
    store.clear(); jobs.forEach(job => store.put(job));
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  }); db.close();
}
