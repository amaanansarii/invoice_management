import { COMPANY_CONFIG } from './config';

export type CompanySettings = {
  name: string; subtitle: string; address: string; city: string; state: string; pin: string;
  phone: string; email: string; gstin: string; thankYou: string; invoicePrefix: string;
  retentionDays: 15 | 30; logo?: string; signature?: string; signatory: string;
};
export type InvoiceItem = { id: string; description: string; quantity: string; rate: string };
export type Invoice = {
  id: string; number: string; date: string; createdAt: number; updatedAt: number;
  customerName: string; customerPhone: string; customerAddress: string; notes: string;
  items: InvoiceItem[]; discount: string; taxPercent: string; subtotalPaise: number;
  discountPaise: number; taxPaise: number; totalPaise: number; pdf?: Blob;
};
export const DEFAULT_SETTINGS: CompanySettings = {
  name: COMPANY_CONFIG.name,
  subtitle: COMPANY_CONFIG.subtitle,
  address: COMPANY_CONFIG.address,
  city: COMPANY_CONFIG.city,
  state: COMPANY_CONFIG.state,
  pin: COMPANY_CONFIG.pin,
  phone: COMPANY_CONFIG.phone,
  email: COMPANY_CONFIG.email,
  gstin: COMPANY_CONFIG.gstin,
  thankYou: COMPANY_CONFIG.thankYou,
  invoicePrefix: COMPANY_CONFIG.invoicePrefix,
  retentionDays: COMPANY_CONFIG.retentionDays,
  logo: COMPANY_CONFIG.logo,
  signature: COMPANY_CONFIG.signature,
  signatory: COMPANY_CONFIG.signatory,
};
