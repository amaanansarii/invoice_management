'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Plus, Trash2, Download, Share2, Settings as SettingsIcon, History, LayoutDashboard, Wrench, Search, Eye, Pencil, RotateCcw, AlertCircle, CheckCircle2, Bike, RefreshCw, FileSpreadsheet, CircleDollarSign, ClipboardList, Menu, X } from 'lucide-react';
import { cleanupExpired, deleteInvoice, getInvoices, getSettings, nextInvoiceNumber, saveInvoice, saveSettings } from '@/lib/db';
import { DEFAULT_SETTINGS, type CompanySettings, type Invoice, type InvoiceItem } from '@/lib/types';
import { WORKSHOP_CONFIG } from '@/lib/config';
import { makeInvoicePdf } from '@/lib/pdf';
import { deleteWorkshopJob, getWorkshopJobs, replaceWorkshopJobs, saveWorkshopJob, type BikeStatus, type WorkshopJob } from '@/lib/workshop';
import { deleteRemoteJob, getRemoteJobs, postRemoteJob } from '@/lib/sheets-sync';

type Page = 'dashboard' | 'create' | 'history' | 'settings' | 'workshop';
const money = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
};
const id = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const emptyItem = (): InvoiceItem => ({ id: id(), description: '', quantity: '1', rate: '' });
function fileToData(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error('Could not read image')); r.readAsDataURL(file);
    });
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function Home() {
    const [page, setPage] = useState<Page>('dashboard');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<Invoice | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [jobs, setJobs] = useState<WorkshopJob[]>([]);
    const [jobQuery, setJobQuery] = useState('');
    const [showPaid, setShowPaid] = useState(false);
    const [jobEditingId, setJobEditingId] = useState<string | null>(null);
    const [jobBikeName, setJobBikeName] = useState('');
    const [jobBikeNumber, setJobBikeNumber] = useState('');
    const [jobCustomerName, setJobCustomerName] = useState('');
    const [jobCustomerPhone, setJobCustomerPhone] = useState('');
    const [jobStatus, setJobStatus] = useState<BikeStatus>('servicing');
    const [jobAmount, setJobAmount] = useState('');
    const [jobNotes, setJobNotes] = useState('');
    const [sheetUrl, setSheetUrl] = useState(WORKSHOP_CONFIG.spreadsheetUrl.startsWith('https://') ? WORKSHOP_CONFIG.spreadsheetUrl : '');
    const [sheetKey, setSheetKey] = useState(WORKSHOP_CONFIG.accessKey.startsWith('REPLACE_') ? '' : WORKSHOP_CONFIG.accessKey);
    const [syncBusy, setSyncBusy] = useState(false);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(today());
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);
    const [discount, setDiscount] = useState('0'); const [taxPercent, setTaxPercent] = useState('0');
    const subtotalPaise = useMemo(() => items.reduce((s, i) => s + Math.round(Math.max(0, Number(i.quantity) || 0) * Math.max(0, Number(i.rate) || 0) * 100), 0), [items]);
    const discountPaise = useMemo(() => Math.min(subtotalPaise, Math.round(subtotalPaise * Math.max(0, Number(discount) || 0) / 100)), [subtotalPaise, discount]);
    const taxPaise = useMemo(() => Math.round((subtotalPaise - discountPaise) * Math.max(0, Number(taxPercent) || 0) / 100), [subtotalPaise, discountPaise, taxPercent]);
    const totalPaise = subtotalPaise - discountPaise + taxPaise;
    const refresh = useCallback(async () => {
        try {
            const s = await getSettings();
            const active: CompanySettings = { ...DEFAULT_SETTINGS, ...(s || {}), logo: s?.logo || DEFAULT_SETTINGS.logo, signature: s?.signature || DEFAULT_SETTINGS.signature };
            setSettings(active);
            await cleanupExpired(active.retentionDays);
            setInvoices(await getInvoices());
            setJobs(await getWorkshopJobs());
            if (typeof window !== 'undefined') {
                setSheetUrl(localStorage.getItem('nsc-sheet-url') || (WORKSHOP_CONFIG.spreadsheetUrl.startsWith('https://') ? WORKSHOP_CONFIG.spreadsheetUrl : ''));
                setSheetKey(localStorage.getItem('nsc-sheet-key') || (WORKSHOP_CONFIG.accessKey.startsWith('REPLACE_') ? '' : WORKSHOP_CONFIG.accessKey));
            }
        }

        catch (e) {
            setMessage(e instanceof Error ? e.message : 'Could not load local data. Please enable browser storage.');
        }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);
    const notify = (text: string) => { setMessage(text); window.setTimeout(() => setMessage(''), 4500) };
    const resetForm = () => {
        setCustomerName('');
        setCustomerPhone('');
        setCustomerAddress('');
        setInvoiceDate(today());
        setNotes('');
        setItems([emptyItem()]);
        setDiscount('0');
        setTaxPercent('0');
        setEditingId(null);
    };
    const startEdit = (inv: Invoice) => { setEditingId(inv.id); setCustomerName(inv.customerName); setCustomerPhone(inv.customerPhone); setCustomerAddress(inv.customerAddress); setInvoiceDate(inv.date); setNotes(inv.notes); setItems(inv.items.map(i => ({ ...i }))); setDiscount(inv.discount || '0'); setTaxPercent(inv.taxPercent || '0'); setSelected(inv); setPage('create'); };
    const createInvoice = async () => {
        if (!settings.name.trim()) { setPage('settings'); notify('Please configure your company details first.'); return; }
        if (!customerName.trim()) { notify('Enter the customer name.'); return; }
        const validItems = items.filter(i => i.description.trim() && Number(i.quantity) > 0 && Number(i.rate) >= 0 && i.rate.trim() !== '');
        if (!validItems.length) { notify('Add at least one item with a description, quantity and rate.'); return; }
        setBusy(true); try {
            const old = editingId ? invoices.find(i => i.id === editingId) : undefined;
            const number = old?.number ?? await nextInvoiceNumber(settings.invoicePrefix || 'INV');
            const inv: Invoice = { id: old?.id ?? id(), number, date: invoiceDate, createdAt: old?.createdAt ?? Date.now(), updatedAt: Date.now(), customerName: customerName.trim(), customerPhone: customerPhone.trim(), customerAddress: customerAddress.trim(), notes: notes.trim(), items: validItems.map(i => ({ ...i, quantity: String(Number(i.quantity)), rate: String(Number(i.rate)) })), discount, taxPercent, subtotalPaise, discountPaise, taxPaise, totalPaise };
            const pdf = await makeInvoicePdf(inv, settings); inv.pdf = pdf; await saveInvoice(inv); await refresh(); setSelected(inv); setPage('history'); notify(editingId ? 'Invoice updated successfully.' : 'Invoice generated and saved.'); setEditingId(null);
        } catch (e) { notify(`Could not save invoice: ${e instanceof Error ? e.message : 'Unknown error'}. Download or back up important records.`); } finally { setBusy(false); }
    };
    const getPdf = async (inv: Invoice) => inv.pdf ?? await makeInvoicePdf(inv, settings);
    const download = async (inv: Invoice) => { try { const blob = await getPdf(inv); downloadBlob(blob, `${inv.number}.pdf`); } catch { notify('Could not generate the PDF.'); } };
    const share = async (inv: Invoice) => { try { const blob = await getPdf(inv); const file = new File([blob], `${inv.number}.pdf`, { type: 'application/pdf' }); if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) { await navigator.share({ files: [file], title: `Invoice ${inv.number}`, text: `Invoice from ${settings.name}` }); } else { downloadBlob(blob, `${inv.number}.pdf`); notify('PDF downloaded. Attach it to your WhatsApp chat manually.'); } } catch (e) { if (e instanceof Error && e.name === 'AbortError') return; notify('Sharing is unavailable here. Download the PDF and attach it in WhatsApp.'); } };
    const deleteOne = async (inv: Invoice) => { if (!window.confirm(`Delete invoice ${inv.number}? This cannot be undone.`)) return; try { await deleteInvoice(inv.id); if (selected?.id === inv.id) setSelected(null); await refresh(); notify('Invoice deleted.'); } catch { notify('Could not delete invoice.'); } };
    const saveCompany = async () => { setBusy(true); try { await saveSettings(settings); await refresh(); notify('Company settings saved on this device.'); setPage('dashboard'); } catch { notify('Could not save settings. Check browser storage space.'); } finally { setBusy(false); } };
    const uploadImage = async (field: 'logo' | 'signature', file?: File) => { if (!file) return; if (!['image/png', 'image/jpeg'].includes(file.type)) { notify('Please upload a PNG or JPEG image.'); return; } if (file.size > 2 * 1024 * 1024) { notify('Please choose an image smaller than 2 MB.'); return; } try { const data = await fileToData(file); setSettings(s => ({ ...s, [field]: data })); } catch { notify('Could not read the image.'); } };
    const resetJobForm = () => { setJobEditingId(null); setJobBikeName(''); setJobBikeNumber(''); setJobCustomerName(''); setJobCustomerPhone(''); setJobStatus('servicing'); setJobAmount(''); setJobNotes(''); };
    const editJob = (job: WorkshopJob) => { setJobEditingId(job.id); setJobBikeName(job.bikeName || ''); setJobBikeNumber(job.bikeNumber || ''); setJobCustomerName(job.customerName || ''); setJobCustomerPhone(job.customerPhone || ''); setJobStatus(job.status); setJobAmount(job.amount || ''); setJobNotes(job.notes || ''); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const saveJob = async () => { const now = Date.now(); const old = jobs.find(j => j.id === jobEditingId); const job: WorkshopJob = { id: old?.id ?? id(), bikeName: jobBikeName.trim(), bikeNumber: jobBikeNumber.trim(), customerName: jobCustomerName.trim(), customerPhone: jobCustomerPhone.trim(), status: jobStatus, amount: jobAmount.trim(), notes: jobNotes.trim(), createdAt: old?.createdAt ?? now, updatedAt: now }; try { await saveWorkshopJob(job); setJobs(await getWorkshopJobs()); resetJobForm(); notify('Workshop record saved.'); if (sheetUrl && sheetKey) { void postRemoteJob(sheetUrl, sheetKey, job).then(() => notify('Record saved locally and queued for Google Sheets sync.')).catch(() => notify('Saved locally. Google Sheets sync may need retrying.')); } } catch (e) { notify(e instanceof Error ? e.message : 'Could not save workshop record.'); } };
    const removeJob = async (job: WorkshopJob) => { if (!window.confirm(`Delete the workshop record for ${job.bikeNumber || job.bikeName || job.customerName || 'this bike'}?`)) return; try { await deleteWorkshopJob(job.id); setJobs(await getWorkshopJobs()); if (sheetUrl && sheetKey) void deleteRemoteJob(sheetUrl, sheetKey, job.id); if (jobEditingId === job.id) resetJobForm(); notify('Workshop record deleted.'); } catch { notify('Could not delete workshop record.'); } };
    const changeJobStatus = async (job: WorkshopJob, status: BikeStatus) => { const updated = { ...job, status, updatedAt: Date.now() }; try { await saveWorkshopJob(updated); setJobs(await getWorkshopJobs()); if (sheetUrl && sheetKey) void postRemoteJob(sheetUrl, sheetKey, updated); notify(status === 'paid' ? 'Marked paid. It is hidden from the active list.' : 'Bike status updated.'); } catch { notify('Could not update status.'); } };
    const syncSheet = async () => { if (!sheetUrl.trim() || !sheetKey.trim()) { notify('Enter the Google Apps Script web app URL and access key first.'); return; } setSyncBusy(true); localStorage.setItem('nsc-sheet-url', sheetUrl.trim()); localStorage.setItem('nsc-sheet-key', sheetKey.trim()); try { const remote = await getRemoteJobs(sheetUrl.trim(), sheetKey.trim()); const local = await getWorkshopJobs(); const map = new Map<string, WorkshopJob>(); for (const j of [...remote, ...local]) { const prev = map.get(j.id); if (!prev || j.updatedAt >= prev.updatedAt) map.set(j.id, j); } const merged = [...map.values()]; await replaceWorkshopJobs(merged); for (const job of merged) await postRemoteJob(sheetUrl.trim(), sheetKey.trim(), job); setJobs(await getWorkshopJobs()); notify(`Sync complete. ${merged.length} workshop records available on this device.`); } catch (e) { notify(e instanceof Error ? e.message : 'Google Sheets sync failed.'); } finally { setSyncBusy(false); } };
    const pullSheetOnly = async () => { if (!sheetUrl.trim() || !sheetKey.trim()) { notify('Enter the Google Apps Script web app URL and access key first.'); return; } setSyncBusy(true); localStorage.setItem('nsc-sheet-url', sheetUrl.trim()); localStorage.setItem('nsc-sheet-key', sheetKey.trim()); try { const remote = await getRemoteJobs(sheetUrl.trim(), sheetKey.trim()); await replaceWorkshopJobs(remote); setJobs(await getWorkshopJobs()); notify(`Loaded ${remote.length} records from the sheet. The sheet is now the source of truth on this device.`); } catch (e) { notify(e instanceof Error ? e.message : 'Could not load the sheet.'); } finally { setSyncBusy(false); } };
    const exportJobsCsv = () => { const headers = ['id', 'bikeName', 'bikeNumber', 'customerName', 'customerPhone', 'status', 'amount', 'notes', 'createdAt', 'updatedAt']; const rows = jobs.map(j => headers.map(h => String((j as unknown as Record<string, unknown>)[h] ?? '').replaceAll('"', '""'))); const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\r\n'); const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }); downloadBlob(blob, `naeem-workshop-${today()}.csv`); };
    const importJobsCsv = async (file?: File) => { if (!file) return; try { const text = await file.text(); const lines = text.replace(/^\ufeff/, '').split(/\r?\n/).filter(Boolean); if (lines.length < 2) throw new Error('CSV has no workshop records.'); const parse = (line: string) => { const out: string[] = []; let cur = '', quoted = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === '"' && line[i + 1] === '"' && quoted) { cur += '"'; i++; } else if (c === '"') quoted = !quoted; else if (c === ',' && !quoted) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; }; const heads = parse(lines[0]); const imported: WorkshopJob[] = lines.slice(1).map(line => { const vals = parse(line); const obj = Object.fromEntries(heads.map((h, i) => [h, vals[i] || ''])); const status = (['servicing', 'serviced', 'delivered', 'paid'].includes(obj.status) ? obj.status : 'servicing') as BikeStatus; return { id: obj.id || id(), bikeName: obj.bikeName || '', bikeNumber: obj.bikeNumber || '', customerName: obj.customerName || '', customerPhone: obj.customerPhone || '', status, amount: obj.amount || '', notes: obj.notes || '', createdAt: Number(obj.createdAt) || Date.now(), updatedAt: Number(obj.updatedAt) || Date.now() }; }); for (const job of imported) await saveWorkshopJob(job); setJobs(await getWorkshopJobs()); notify(`Imported ${imported.length} workshop records.`); } catch (e) { notify(e instanceof Error ? e.message : 'Could not import CSV.'); } };
    const filteredJobs = jobs.filter(j => (showPaid || j.status !== 'paid') && `${j.bikeName} ${j.bikeNumber} ${j.customerName} ${j.customerPhone} ${j.status}`.toLowerCase().includes(jobQuery.toLowerCase()));
    const filtered = invoices.filter(i => `${i.number} ${i.customerName} ${i.customerPhone}`.toLowerCase().includes(query.toLowerCase()));
    const todayInvoices = invoices.filter(i => i.date === today()); const billedToday = todayInvoices.reduce((s, i) => s + i.totalPaise, 0);
    const navItems: [Page, string, any][] = [['dashboard', 'Dashboard', LayoutDashboard], ['create', 'Create invoice', Plus], ['workshop', 'Workshop tracker', Bike], ['history', 'Invoice history', History], ['settings', 'Settings', SettingsIcon]];
    return <main className="app-shell">
        <aside className="sidebar"><div className="brand"><div className="brand-icon"><Wrench size={22} /></div><div><strong>Naeem Service Centre</strong><span>Invoice & workshop</span></div></div><nav>{navItems.map(([key, label, Icon]) => <button key={key} className={`nav-button ${page === key ? 'active' : ''}`} onClick={() => { setPage(key); if (key === 'create' && !editingId) resetForm(); }}><Icon size={18} />{label}</button>)}</nav><div className="sidebar-foot">Local-first billing<br /><span>Your records stay on this device.</span></div></aside>
        <section className="main-area">
            <header className="topbar">
                <div className="mobile-brand">
                    <Wrench size={19} />
                    <strong>Naeem Invoice</strong>
                </div>

                <button
                    type="button"
                    className="mobile-menu-button"
                    aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
                    aria-expanded={mobileMenuOpen}
                    onClick={() => setMobileMenuOpen((open) => !open)}
                >
                    {mobileMenuOpen ? <X size={23} /> : <Menu size={23} />}
                </button>

                <div className="topbar-right">
                    <span className="local-pill">
                        <span className="status-dot" />
                        Saved locally
                    </span>

                    <button
                        className="icon-button"
                        aria-label="Open settings"
                        onClick={() => {
                            setPage('settings');
                            setMobileMenuOpen(false);
                        }}
                    >
                        <SettingsIcon size={19} />
                    </button>
                </div>
            </header>

            {mobileMenuOpen && (
                <div
                    className="mobile-menu-backdrop"
                    onClick={() => setMobileMenuOpen(false)}
                >
                    <nav
                        className="mobile-menu"
                        aria-label="Mobile navigation"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <p className="mobile-menu-title">MENU</p>

                        {navItems.map(([key, label, Icon]) => (
                            <button
                                type="button"
                                key={key}
                                className={`nav-button ${page === key ? 'active' : ''}`}
                                onClick={() => {
                                    if (key === 'create' && !editingId) {
                                        resetForm();
                                    }

                                    setPage(key);
                                    setMobileMenuOpen(false);
                                }}
                            >
                                <Icon size={19} />
                                <span>{label}</span>
                            </button>
                        ))}

                        <div className="mobile-menu-foot">
                            Naeem Service Centre
                            <span>Invoice & workshop management</span>
                        </div>
                    </nav>
                </div>
            )}

            {message && <div className="toast" role="status"><AlertCircle size={17} />{message}<button onClick={() => setMessage('')} aria-label="Dismiss">×</button></div>}
            <div className="content">
                {page === 'dashboard' && <><div className="page-heading"><div><p className="eyebrow">OVERVIEW</p><h1>Good day 👋</h1><p className="muted">Create a professional invoice in a few steps.</p></div><button className="primary-button" onClick={() => { resetForm(); setPage('create') }}><Plus size={18} /> Create invoice</button></div><div className="stats-grid"><Stat label="Invoices today" value={String(todayInvoices.length)} icon={<FileText />} /><Stat label="Billed today" value={money(billedToday)} icon={<CheckCircle2 />} /><Stat label="Saved invoices" value={String(invoices.length)} icon={<History />} /></div><section className="panel"><div className="panel-heading"><div><h2>Recent invoices</h2><p className="muted">Your latest saved bills</p></div><button className="text-button" onClick={() => setPage('history')}>View history <span>→</span></button></div>{invoices.length === 0 ? <Empty title="No invoices yet" text="Your generated invoices will appear here." action={() => { resetForm(); setPage('create') }} /> : <div className="invoice-list">{invoices.slice(0, 5).map(inv => <InvoiceRow key={inv.id} inv={inv} onView={() => { setSelected(inv); setPage('history') }} onDownload={() => void download(inv)} />)}</div>}</section><div className="notice"><AlertCircle size={18} /><p><strong>Storage reminder</strong><br />Invoices are stored in this browser on this device and are automatically removed after {settings.retentionDays} days. Download important PDFs to keep a separate copy.</p></div></>}
                {page === 'create' && <><div className="page-heading"><div><p className="eyebrow">BILLING</p><h1>{editingId ? 'Edit invoice' : 'Create invoice'}</h1><p className="muted">Enter customer details and add the services or parts.</p></div><button className="secondary-button" onClick={() => setPage('dashboard')}>Cancel</button></div><div className="form-layout"><div className="form-main"><section className="panel"><PanelTitle number="01" title="Customer details" subtitle="Who is this invoice for?" /><div className="field-grid"><Field label="Customer name *"><input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="e.g. Rahul Sharma" /></Field><Field label="Contact number"><input type="tel" inputMode="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Customer phone" /></Field><Field label="Invoice date"><input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></Field><Field label="Address (optional)" wide><input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Customer address" /></Field></div></section><section className="panel"><PanelTitle number="02" title="Items & services" subtitle="Enter the item, quantity and rate. Amounts update automatically." /><div className="items-head"><span>ITEM / SERVICE</span><span>QTY</span><span>RATE (₹)</span><span>AMOUNT</span><span /></div>{items.map((item, index) => <div className="item-row" key={item.id}><div className="item-mobile-label">Item {index + 1}</div><input aria-label="Item or service description" value={item.description} onChange={e => setItems(prev => prev.map(x => x.id === item.id ? { ...x, description: e.target.value } : x))} placeholder="e.g. Engine oil" /><input aria-label="Quantity" type="number" min="0.01" step="any" value={item.quantity} onChange={e => setItems(prev => prev.map(x => x.id === item.id ? { ...x, quantity: e.target.value } : x))} /><input aria-label="Rate in rupees" type="number" min="0" step="0.01" value={item.rate} onChange={e => setItems(prev => prev.map(x => x.id === item.id ? { ...x, rate: e.target.value } : x))} placeholder="0.00" /><strong className="line-total">{money(Math.round(Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.rate) || 0) * 100))}</strong><button className="remove-button" aria-label="Remove item" onClick={() => setItems(prev => prev.length === 1 ? [emptyItem()] : prev.filter(x => x.id !== item.id))}><Trash2 size={16} /></button></div>)}<button className="add-item" onClick={() => setItems(prev => [...prev, emptyItem()])}><Plus size={16} /> Add another item</button></section><section className="panel"><PanelTitle number="03" title="Additional details" subtitle="Optional adjustments and notes." /><div className="field-grid"><Field label="Discount (%)"><input type="number" min="0" max="100" value={discount} onChange={e => setDiscount(e.target.value)} /></Field><Field label="Tax (%)"><input type="number" min="0" max="100" value={taxPercent} onChange={e => setTaxPercent(e.target.value)} /></Field><Field label="Notes (optional)" wide><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Warranty, payment notes or other details" rows={3} /></Field></div></section></div><aside className="summary-card"><div className="summary-brand"><div className="summary-logo">{settings.logo ? <img src={settings.logo} alt="Company logo" /> : <img src="/images/naeem-logo.png" alt="Naeem Service Centre logo" />}</div><div><strong>{settings.name}</strong><span>{settings.subtitle}</span></div></div><div className="summary-divider" /><div className="summary-line"><span>Items</span><strong>{items.filter(i => i.description.trim()).length}</strong></div><div className="summary-line"><span>Subtotal</span><strong>{money(subtotalPaise)}</strong></div>{discountPaise > 0 && <div className="summary-line"><span>Discount</span><strong>−{money(discountPaise)}</strong></div>}{taxPaise > 0 && <div className="summary-line"><span>Tax</span><strong>{money(taxPaise)}</strong></div>}<div className="grand-total"><span>Grand total</span><strong>{money(totalPaise)}</strong></div><button className="primary-button full-button" disabled={busy} onClick={() => void createInvoice()}><FileText size={17} />{busy ? 'Generating…' : editingId ? 'Update invoice & PDF' : 'Generate invoice PDF'}</button><p className="summary-hint">Your logo, company details and signature will be included from Settings.</p></aside></div></>}
                {page === 'workshop' && <><div className="page-heading"><div><p className="eyebrow">SERVICE WORKFLOW</p><h1>Workshop tracker</h1><p className="muted">Track every bike from arrival to service, delivery and payment.</p></div><button className="secondary-button" onClick={exportJobsCsv}><Download size={16} /> Export CSV</button></div><div className="stats-grid"><Stat label="In servicing" value={String(jobs.filter(j => j.status === 'servicing').length)} icon={<Wrench />} /><Stat label="Ready / serviced" value={String(jobs.filter(j => j.status === 'serviced').length)} icon={<CheckCircle2 />} /><Stat label="Delivered, unpaid" value={String(jobs.filter(j => j.status === 'delivered').length)} icon={<CircleDollarSign />} /></div><section className="panel settings-panel"><PanelTitle number="01" title={jobEditingId ? 'Edit workshop record' : 'Add bike / scooter'} subtitle="All fields are optional. Add only the details you have." /><div className="field-grid"><Field label="Bike / scooter name"><input value={jobBikeName} onChange={e => setJobBikeName(e.target.value)} placeholder="e.g. Honda Activa" /></Field><Field label="Vehicle number"><input value={jobBikeNumber} onChange={e => setJobBikeNumber(e.target.value.toUpperCase())} placeholder="e.g. UK04AB1234" /></Field><Field label="Customer name"><input value={jobCustomerName} onChange={e => setJobCustomerName(e.target.value)} placeholder="Customer name" /></Field><Field label="Mobile number"><input type="tel" value={jobCustomerPhone} onChange={e => setJobCustomerPhone(e.target.value)} placeholder="Phone number" /></Field><Field label="Bike status"><select value={jobStatus} onChange={e => setJobStatus(e.target.value as BikeStatus)}><option value="servicing">In servicing — bike at shop</option><option value="serviced">Serviced — ready for pickup</option><option value="delivered">Delivered — payment pending</option><option value="paid">Paid — completed</option></select></Field><Field label="Amount (₹)"><input type="number" min="0" step="0.01" value={jobAmount} onChange={e => setJobAmount(e.target.value)} placeholder="Optional bill amount" /></Field><Field label="Notes (optional)" wide><textarea rows={2} value={jobNotes} onChange={e => setJobNotes(e.target.value)} placeholder="Complaint, parts needed, key details…" /></Field></div><div className="button-row workshop-form-actions"><button className="primary-button" onClick={() => void saveJob()}><Plus size={16} />{jobEditingId ? 'Update record' : 'Save bike record'}</button>{jobEditingId && <button className="secondary-button" onClick={resetJobForm}>Cancel edit</button>}</div></section><section className="panel settings-panel"><div className="panel-heading"><div><h2>Current bikes & payment status</h2><p className="muted">Paid records are hidden from the active list, but remain in history and in the sheet.</p></div><label className="checkbox-label"><input type="checkbox" checked={showPaid} onChange={e => setShowPaid(e.target.checked)} /> Show paid</label></div><div className="search-box"><Search size={18} /><input value={jobQuery} onChange={e => setJobQuery(e.target.value)} placeholder="Search bike number, bike, customer or status" /></div>{filteredJobs.length === 0 ? <div className="empty-state"><div className="empty-icon"><Bike size={23} /></div><h3>No workshop records</h3><p>Add a bike above or change the search filter.</p></div> : <div className="workshop-list">{filteredJobs.map(job => <article className="workshop-row" key={job.id}><div className="workshop-main"><div className="workshop-icon"><Bike size={20} /></div><div className="workshop-ident"><strong>{job.bikeName || 'Bike / scooter not specified'}</strong><span>{job.bikeNumber || 'No vehicle number'}{job.customerName ? ` · ${job.customerName}` : ''}</span><small>{job.customerPhone || 'No phone'}{job.amount ? ` · ₹${Number(job.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}</small>{job.notes && <small className="workshop-notes">{job.notes}</small>}</div></div><div className="workshop-controls"><span className={`job-status status-${job.status}`}>{job.status === 'servicing' ? 'In servicing' : job.status === 'serviced' ? 'Serviced / ready' : job.status === 'delivered' ? 'Delivered · unpaid' : 'Paid'}</span><select aria-label="Change bike status" value={job.status} onChange={e => void changeJobStatus(job, e.target.value as BikeStatus)}><option value="servicing">In servicing</option><option value="serviced">Serviced / ready</option><option value="delivered">Delivered · unpaid</option><option value="paid">Paid</option></select><div className="row-actions"><button title="Edit record" aria-label="Edit record" onClick={() => editJob(job)}><Pencil size={16} /></button><button title="Delete record" aria-label="Delete record" onClick={() => void removeJob(job)}><Trash2 size={16} /></button></div></div></article>)}</div>}</section><section className="panel settings-panel"><PanelTitle number="02" title="Excel / Google Sheets sync" subtitle="For the same list on your laptop and phone, connect a shared Google Sheet. CSV export also opens in Excel." /><div className="field-grid"><Field label="Google Apps Script web app URL" wide><input value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec" /></Field><Field label="Access key" wide><input value={sheetKey} onChange={e => setSheetKey(e.target.value)} placeholder="Your Apps Script access key" /></Field></div><div className="button-row workshop-form-actions"><button className="primary-button" disabled={syncBusy} onClick={() => void syncSheet()}><RefreshCw size={16} />{syncBusy ? 'Syncing…' : 'Sync with Google Sheets'}</button><button className="secondary-button" disabled={syncBusy} onClick={() => void pullSheetOnly()}><RefreshCw size={16} /> Load sheet only</button><label className="secondary-button import-csv-label"><FileSpreadsheet size={16} /> Import CSV from Excel<input type="file" accept=".csv,text/csv" hidden onChange={e => { void importJobsCsv(e.target.files?.[0]); e.currentTarget.value = ''; }} /></label></div><div className="notice"><AlertCircle size={17} /><p><strong>Setup guide</strong><br />Open the project folder's <code>google-apps-script/Code.gs</code>, paste it into Extensions → Apps Script in a Google Sheet, set the access key, and deploy as a web app. Then enter the deployment URL and the same key here on each device. See README for details. This is a lightweight shared tracker; do not store highly sensitive information in it. Anyone with both the URL and key can access these records.</p></div></section></>}
                {page === 'history' && <><div className="page-heading"><div><p className="eyebrow">RECORDS</p><h1>Invoice history</h1><p className="muted">Search, download, share or manage saved invoices.</p></div><button className="primary-button" onClick={() => { resetForm(); setPage('create') }}><Plus size={18} /> New invoice</button></div><div className="search-box"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search invoice number, customer or phone" /></div>{filtered.length === 0 ? <section className="panel"><Empty title="No matching invoices" text={invoices.length ? 'Try a different search.' : 'Create your first invoice to see it here.'} action={() => { resetForm(); setPage('create') }} /></section> : <section className="panel history-panel"><div className="history-header"><span>INVOICE / CUSTOMER</span><span>DATE</span><span>AMOUNT</span><span>ACTIONS</span></div>{filtered.map(inv => <div className="history-row" key={inv.id}><button className="invoice-identity" onClick={() => setSelected(inv)}><span className="file-icon"><FileText size={18} /></span><span><strong>{inv.number}</strong><small>{inv.customerName}{inv.customerPhone ? ` · ${inv.customerPhone}` : ''}</small></span></button><span className="history-date">{inv.date}</span><strong className="history-amount">{money(inv.totalPaise)}</strong><div className="row-actions"><button title="Download PDF" aria-label="Download PDF" onClick={() => void download(inv)}><Download size={17} /></button><button title="Share PDF" aria-label="Share PDF" onClick={() => void share(inv)}><Share2 size={17} /></button><button title="Edit invoice" aria-label="Edit invoice" onClick={() => startEdit(inv)}><Pencil size={17} /></button><button title="Delete invoice" aria-label="Delete invoice" onClick={() => void deleteOne(inv)}><Trash2 size={17} /></button></div></div>)}</section>}{selected && <section className="panel selected-panel"><div className="panel-heading"><div><p className="eyebrow">SELECTED INVOICE</p><h2>{selected.number}</h2><p className="muted">{selected.customerName} · {selected.date}</p></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close invoice details">×</button></div><div className="selected-total"><span>Invoice total</span><strong>{money(selected.totalPaise)}</strong></div><div className="button-row"><button className="secondary-button" onClick={() => void download(selected!)}><Download size={16} /> Download PDF</button><button className="primary-button" onClick={() => void share(selected!)}><Share2 size={16} /> Share PDF</button><button className="secondary-button" onClick={() => startEdit(selected!)}><Pencil size={16} /> Edit</button></div></section>}</>}
                {page === 'settings' && <><div className="page-heading"><div><p className="eyebrow">PERSONALIZATION</p><h1>Company settings</h1><p className="muted">These details are reused on every invoice.</p></div></div><section className="panel settings-panel"><PanelTitle number="01" title="Business identity" subtitle="Your company name and contact details." /><div className="field-grid"><Field label="Company / shop name *" wide><input value={settings.name} onChange={e => setSettings(s => ({ ...s, name: e.target.value }))} /></Field><Field label="Subtitle" wide><input value={settings.subtitle} onChange={e => setSettings(s => ({ ...s, subtitle: e.target.value }))} /></Field><Field label="Address" wide><input value={settings.address} onChange={e => setSettings(s => ({ ...s, address: e.target.value }))} placeholder="Shop address" /></Field><Field label="City"><input value={settings.city} onChange={e => setSettings(s => ({ ...s, city: e.target.value }))} /></Field><Field label="State"><input value={settings.state} onChange={e => setSettings(s => ({ ...s, state: e.target.value }))} /></Field><Field label="PIN code"><input value={settings.pin} onChange={e => setSettings(s => ({ ...s, pin: e.target.value }))} /></Field><Field label="Business phone"><input type="tel" value={settings.phone} onChange={e => setSettings(s => ({ ...s, phone: e.target.value }))} /></Field><Field label="Email (optional)"><input type="email" value={settings.email} onChange={e => setSettings(s => ({ ...s, email: e.target.value }))} /></Field><Field label="GSTIN (optional)"><input value={settings.gstin} onChange={e => setSettings(s => ({ ...s, gstin: e.target.value }))} /></Field></div></section><section className="panel settings-panel"><PanelTitle number="02" title="Logo & signature" subtitle="Upload the images that should appear on your PDF." /><div className="upload-grid"><UploadBox title="Company logo" image={settings.logo} onUpload={f => void uploadImage('logo', f)} onRemove={() => setSettings(s => ({ ...s, logo: undefined }))} /><UploadBox title="Authorized signature" image={settings.signature} onUpload={f => void uploadImage('signature', f)} onRemove={() => setSettings(s => ({ ...s, signature: undefined }))} /></div><div className="field-grid settings-lower"><Field label="Signature label"><input value={settings.signatory} onChange={e => setSettings(s => ({ ...s, signatory: e.target.value }))} /></Field><Field label="Invoice number prefix"><input value={settings.invoicePrefix} onChange={e => setSettings(s => ({ ...s, invoicePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) }))} /></Field><Field label="Keep invoices for"><select value={settings.retentionDays} onChange={e => setSettings(s => ({ ...s, retentionDays: Number(e.target.value) as 15 | 30 }))}><option value={15}>15 days</option><option value={30}>30 days</option></select></Field><Field label="Thank-you message" wide><textarea rows={3} value={settings.thankYou} onChange={e => setSettings(s => ({ ...s, thankYou: e.target.value }))} /></Field></div></section><div className="settings-actions"><div className="muted small-note"><AlertCircle size={16} /> Stored only in this browser. Export PDFs to back up important records.</div><button className="primary-button" disabled={busy || !settings.name.trim()} onClick={() => void saveCompany()}>{busy ? 'Saving…' : 'Save settings'}</button></div></>}
            </div><footer className="footer">Made for simple, professional billing <span>·</span> Local-first storage</footer></section>
    </main>
}
function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="stat-card"><div className="stat-icon">{icon}</div><span>{label}</span><strong>{value}</strong></div> }
function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <label className={`field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label> }
function PanelTitle({ number, title, subtitle }: { number: string; title: string; subtitle: string }) { return <div className="panel-title"><span>{number}</span><div><h2>{title}</h2><p className="muted">{subtitle}</p></div></div> }
function Empty({ title, text, action }: { title: string; text: string; action: () => void }) { return <div className="empty-state"><div className="empty-icon"><FileText size={23} /></div><h3>{title}</h3><p>{text}</p><button className="secondary-button" onClick={action}><Plus size={16} /> Create invoice</button></div> }
function InvoiceRow({ inv, onView, onDownload }: { inv: Invoice; onView: () => void; onDownload: () => void }) { return <div className="recent-row"><button className="invoice-identity" onClick={onView}><span className="file-icon"><FileText size={18} /></span><span><strong>{inv.number}</strong><small>{inv.customerName}</small></span></button><div className="recent-meta"><span>{inv.date}</span><strong>{money(inv.totalPaise)}</strong></div><button className="icon-button" onClick={onDownload} title="Download PDF" aria-label="Download PDF"><Download size={17} /></button></div> }
function UploadBox({ title, image, onUpload, onRemove }: { title: string; image?: string; onUpload: (file?: File) => void; onRemove: () => void }) { return <div className="upload-box"><div className="upload-preview">{image ? <img src={image} alt={title} /> : <FileText size={25} />}</div><div className="upload-info"><strong>{title}</strong><span>PNG or JPEG · max 2 MB</span><div className="upload-actions"><label className="secondary-button upload-label">Choose image<input type="file" accept="image/png,image/jpeg" onChange={e => { onUpload(e.target.files?.[0]); e.currentTarget.value = ''; }} hidden /></label>{image && <button className="text-button danger-text" onClick={onRemove}>Remove</button>}</div></div></div> }
