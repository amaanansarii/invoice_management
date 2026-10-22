import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Naeem Service Centre | Invoice Maker',
  description: 'Create, download and share professional service invoices.',
  applicationName: 'Naeem Invoice Maker',
  manifest: '/manifest.json'
};
export const viewport: Viewport = { themeColor: '#172554', width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
