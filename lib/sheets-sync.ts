import type { WorkshopJob } from './workshop';

type SheetResponse = { ok: boolean; jobs?: WorkshopJob[]; error?: string };
export function getRemoteJobs(url: string, key: string): Promise<WorkshopJob[]> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Sync is only available in the browser.'));
    const callback = `nscSheetCallback_${Date.now()}_${Math.floor(Math.random()*100000)}`;
    const w = window as unknown as Record<string, unknown>;
    const timer = window.setTimeout(() => { cleanup(); reject(new Error('Google Sheets sync timed out. Check the deployment URL and access key.')); }, 15000);
    const script = document.createElement('script');
    const cleanup = () => { window.clearTimeout(timer); script.remove(); delete w[callback]; };
    w[callback] = (response: SheetResponse) => {
      cleanup();
      if (!response?.ok) reject(new Error(response?.error || 'Google Sheets returned an error.'));
      else resolve((response.jobs || []).map(j => ({...j, createdAt:Number(j.createdAt)||Date.now(), updatedAt:Number(j.updatedAt)||Date.now(), amount:String(j.amount ?? '')})));
    };
    const separator = url.includes('?') ? '&' : '?';
    script.src = `${url}${separator}action=list&key=${encodeURIComponent(key)}&callback=${encodeURIComponent(callback)}`;
    script.onerror = () => { cleanup(); reject(new Error('Could not connect to Google Sheets. Check the web app URL and deployment access.')); };
    document.body.appendChild(script);
  });
}
export async function postRemoteJob(url: string, key: string, job: WorkshopJob): Promise<void> {
  await fetch(url, { method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action:'upsert',key,job}) });
}
export async function deleteRemoteJob(url: string, key: string, id: string): Promise<void> {
  await fetch(url, { method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action:'delete',key,id}) });
}
