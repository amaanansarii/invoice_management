# Naeem Service Centre Invoice Maker

A local-first invoice generator built with Next.js, TypeScript, jsPDF, jspdf-autotable and IndexedDB. Invoice records, logos, signatures and generated PDFs are stored in the current browser on the current device. Nothing is uploaded to a server by this app.

## Requirements
- Node.js 20.9+ (Node 22 LTS recommended)
- npm

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Static business details are defined in `lib/config.ts`. Replace `public/images/naeem-logo.png` with your actual logo and `public/images/naeem-signature.png` with your actual authorized signature image. Set your full address and PIN in `lib/config.ts`. Then create an invoice. The Settings page can still override the static defaults on a device if you save changes there.

## Production build

```bash
npm run build
npm start
```

## Features
- Responsive dashboard, invoice form, history and company settings
- Dynamic line amounts, subtotal, percentage discount, tax and grand total
- PDF with business details, customer information, items table, total, thank-you message and signature
- Download and native PDF sharing on compatible browsers (choose WhatsApp from the share sheet)
- IndexedDB invoice storage with configurable 15- or 30-day retention
- Static code-based company defaults in `lib/config.ts`, plus optional local logo/signature overrides (PNG/JPEG, up to 2 MB each)
- Logo and signature assets in `public/images/`; replace these files with your real images before deployment

## Notes and limitations
- Storage is browser/device-specific. Clearing browser data or losing the device can remove invoices. Download or separately back up important PDFs.
- Browser file-sharing support varies. If unsupported, the app downloads the PDF so you can attach it manually in WhatsApp.
- The PDF uses jsPDF's built-in Helvetica font, so the currency is written as `Rs.` to ensure consistent rendering. For a true `₹` symbol and Hindi text, bundle and embed a Unicode TTF font in `lib/pdf.ts`.
- This starter is intended for local invoice creation, not as a replacement for a tax-compliant accounting system. Configure taxes and business identifiers only as appropriate for your business.
- The PWA manifest is included. For full offline support after installation, add and test a service worker using a PWA strategy compatible with your deployment. Offline caching is not enabled by this starter by default.
- Google Fonts are referenced in CSS for typography. If you require fully offline operation or zero third-party requests, remove the `@import` and use system fonts.

## Deploy
Push this folder to a GitHub repository and import it into Vercel or another Next.js host. No environment variables are required. Hosting free-tier availability and limits depend on the provider.

## Workshop tracker (new)

The Workshop Tracker manages bike/scooter jobs separately from invoices. Fields are optional: bike name, registration number, customer name, phone, status, amount, and notes. Statuses are:

- `In servicing` — bike is still at the shop.
- `Serviced / ready` — service is complete and the customer can collect it.
- `Delivered · unpaid` — bike has left, but payment is pending.
- `Paid` — completed; hidden from the active list by default. Use **Show paid** to view old paid records.

Workshop records are saved locally in IndexedDB first. They do not expire with invoice history. CSV export can be opened in Excel; CSV import merges records into the local list.

## Sync workshop records across devices using Google Sheets

A local browser database is not shared across devices. To have the same workshop list on your phone and laptop without running your own paid database, use the included Google Apps Script bridge. A Google Sheet acts as the shared spreadsheet; invoice PDFs continue to be generated and stored locally as before.

1. Create a Google Sheet in the Google account you control.
2. In the sheet, open **Extensions → Apps Script**.
3. Replace the editor contents with `google-apps-script/Code.gs` from this project.
4. In both `lib/config.ts` and `google-apps-script/Code.gs`, replace `REPLACE_WITH_YOUR_WORKSHOP_ACCESS_KEY` with the exact same long random value. Keep the key private. The value in frontend code is visible to visitors, so this simple shared-key setup is suitable only for a small private-use tool, not a public website with sensitive customer data.
5. Save the script. Choose **Deploy → New deployment → Web app**.
6. Set **Execute as** to your account. Set access to **Anyone** so the web app can receive requests. The script checks the access key, but this is lightweight protection, not strong authentication.
7. Deploy, authorize it, and copy the web app URL ending in `/exec`.
8. In the website, open **Workshop tracker → Excel / Google Sheets sync**. Paste the URL and the same access key, then choose **Sync with Google Sheets**.
9. In `lib/config.ts`, set `spreadsheetUrl` to the deployed URL and `accessKey` to the same key. Rebuild and redeploy the site; the workshop sync fields will be prefilled from code on each device. You can still change them in the UI, which saves them locally on that device.

When a job is created or its status changes while connected, the app sends that record to the sheet. Use **Sync with Google Sheets** to merge local and shared records. If you manually delete paid rows directly in the spreadsheet and want that deletion to be reflected on the current device, use **Load sheet only**; this makes the sheet the source of truth and replaces the local workshop list with its current rows.

**Security note:** The app and Apps Script use a shared key in the browser. Anyone who obtains both the web app URL and key could read or change workshop records. Store only the minimum customer data needed, keep the key private, and do not use this lightweight setup for highly sensitive information. For stronger access control, use an authenticated database/backend.

## Run

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`. For a public deployment, use your normal Next.js hosting workflow. The Google Sheet sync works only after the Apps Script web app is deployed and configured.

## Static configuration quick reference

Edit `lib/config.ts` to set company details and the Google Apps Script URL/key in code. Replace `public/images/naeem-logo.png` and `public/images/naeem-signature.png` with your real image files, keeping the same filenames. The bundled logo is a generated starter mark, not an official supplied logo. The signature asset is intentionally transparent because your real signature was not provided; replace it before using invoices that require a signature. The PDF embeds these local image assets.
