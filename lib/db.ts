import type { CompanySettings, Invoice } from './types';
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
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('number', 'number', { unique: true });
      }
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('workshopJobs')) { const jobs = db.createObjectStore('workshopJobs', { keyPath: 'id' }); jobs.createIndex('updatedAt', 'updatedAt'); }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open local database.'));
  });
}
export async function saveInvoice(invoice: Invoice): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => { const tx = db.transaction('invoices', 'readwrite'); tx.objectStore('invoices').put(invoice); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
  db.close();
}
export async function getInvoices(): Promise<Invoice[]> {
  const db = await openDB();
  const values = await new Promise<Invoice[]>((resolve, reject) => { const req = db.transaction('invoices', 'readonly').objectStore('invoices').getAll(); req.onsuccess = () => resolve(req.result as Invoice[]); req.onerror = () => reject(req.error); });
  db.close(); return values.sort((a,b) => b.createdAt-a.createdAt);
}
export async function deleteInvoice(id: string): Promise<void> {
  const db = await openDB(); await new Promise<void>((resolve,reject) => { const tx=db.transaction('invoices','readwrite'); tx.objectStore('invoices').delete(id); tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); }); db.close();
}
export async function getSettings(): Promise<CompanySettings | null> {
  const db=await openDB(); const value=await new Promise<any>((resolve,reject)=>{const req=db.transaction('settings','readonly').objectStore('settings').get('company');req.onsuccess=()=>resolve(req.result?.value ?? null);req.onerror=()=>reject(req.error)});db.close();return value;
}
export async function saveSettings(settings: CompanySettings): Promise<void> {
  const db=await openDB(); await new Promise<void>((resolve,reject)=>{const tx=db.transaction('settings','readwrite');tx.objectStore('settings').put({key:'company',value:settings});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});db.close();
}
export async function cleanupExpired(retentionDays: number): Promise<number> {
  const invoices=await getInvoices(); const cutoff=Date.now()-retentionDays*86400000; const expired=invoices.filter(i=>i.createdAt<cutoff);
  for(const invoice of expired) await deleteInvoice(invoice.id); return expired.length;
}
export async function nextInvoiceNumber(prefix: string): Promise<string> {
  const invoices=await getInvoices(); const now=new Date(); const day=`${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const start=`${prefix}-${day}-`; const nums=invoices.filter(i=>i.number.startsWith(start)).map(i=>Number(i.number.slice(start.length))).filter(Number.isFinite);
  return `${start}${String(Math.max(0,...nums)+1).padStart(3,'0')}`;
}
