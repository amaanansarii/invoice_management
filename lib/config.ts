/**
 * Static business and workshop configuration.
 * Edit this file before deployment. Anything in this file is public in the browser bundle.
 */
export const COMPANY_CONFIG = {
  name: 'Naeem Service Centre',
  subtitle: 'Bike & Scooty Repair and Servicing',
  address: 'Near abduallah building front of himalayan farm bareily road', // Enter the full shop address here.
  city: 'Haldwani',
  state: 'Uttarakhand',
  pin: '263139', // Enter PIN code here.
  phone: '9837408015, 7906500472',
  email: 'amaanansari864@gmail.com',
  gstin: '',
  thankYou: 'Thank you! We appreciate your trust in our service.',
  invoicePrefix: 'NSC',
  retentionDays: 30 as 15 | 30,
  logo: '/images/naeem-service-log.jpg',
  signature: '', // Replace this file with your real signature image.
  signatory: 'Authorized Signatory',
} as const;

export const WORKSHOP_CONFIG = {
  // Paste your deployed Google Apps Script Web App URL ending in /exec.
  spreadsheetUrl: 'https://script.google.com/macros/s/AKfycbyPOSUTUSp-Jy_4hVEkJDATDS4e-KRs_xmFKySZ2SZpKBcMk7UsYz0ahg4JZsAl8UMS/exec',
  // Must match ACCESS_KEY in google-apps-script/Code.gs. This value is visible to website visitors.
  accessKey: 'naeemservicehaldwani',
  hidePaidFromActiveList: true,
} as const;