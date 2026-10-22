import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CompanySettings, Invoice } from './types';
const money = (paise:number) => `Rs. ${(paise/100).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
async function resolveImageData(source: string): Promise<string> {
  if (source.startsWith('data:image/')) return source;
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Could not load image: ${source}`);
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not convert image for PDF.'));
    reader.readAsDataURL(blob);
  });
}
async function addImage(doc: jsPDF, source: string | undefined, x:number,y:number,w:number,h:number) {
  if (!source) return;
  try {
    const data = await resolveImageData(source);
    const format=data.startsWith('data:image/png')?'PNG':'JPEG';
    doc.addImage(data,format,x,y,w,h,undefined,'FAST');
  } catch { /* keep the invoice usable if an optional image is missing */ }
}
export async function makeInvoicePdf(invoice: Invoice, settings: CompanySettings): Promise<Blob> {
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const pageW=210; const margin=14; let y=15;
  await addImage(doc,settings.logo,margin,y,25,22);
  const textX=settings.logo?margin+31:margin;
  doc.setTextColor(23,37,84); doc.setFont('helvetica','bold'); doc.setFontSize(17); doc.text(settings.name || 'Your Company',textX,y+7);
  doc.setTextColor(70,80,95); doc.setFont('helvetica','normal'); doc.setFontSize(9);
  const address=[settings.address,settings.city,settings.state,settings.pin].filter(Boolean).join(', ');
  let infoY=y+12; if(settings.subtitle){doc.text(settings.subtitle,textX,infoY);infoY+=4.5;}
  if(address){doc.text(doc.splitTextToSize(address, pageW-textX-margin),textX,infoY);infoY+=4.5;}
  const contacts=[settings.phone?`Phone: ${settings.phone}`:'',settings.email?`Email: ${settings.email}`:'',settings.gstin?`GSTIN: ${settings.gstin}`:''].filter(Boolean).join('  |  ');
  if(contacts) doc.text(doc.splitTextToSize(contacts,pageW-textX-margin),textX,infoY);
  y=43; doc.setDrawColor(210,216,226); doc.line(margin,y,pageW-margin,y); y+=9;
  doc.setTextColor(23,37,84); doc.setFont('helvetica','bold'); doc.setFontSize(19); doc.text('INVOICE',margin,y);
  doc.setFontSize(9); doc.setTextColor(65,75,90); doc.setFont('helvetica','normal');
  doc.text(`Invoice No: ${invoice.number}`,pageW-margin,y-5,{align:'right'}); doc.text(`Date: ${invoice.date}`,pageW-margin,y,{align:'right'}); y+=9;
  doc.setFillColor(245,247,250); doc.roundedRect(margin,y,pageW-2*margin,23,2,2,'F');
  doc.setTextColor(90,100,115); doc.setFontSize(8); doc.text('BILL TO',margin+4,y+6);
  doc.setTextColor(25,32,45); doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.text(invoice.customerName||'Customer',margin+4,y+12);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); let customerLine=[invoice.customerPhone,invoice.customerAddress].filter(Boolean).join('  |  '); if(customerLine)doc.text(doc.splitTextToSize(customerLine,pageW-2*margin-8),margin+4,y+18);
  y+=30;
  autoTable(doc, { startY:y, margin:{left:margin,right:margin}, head:[['Item / Service','Qty','Rate (Rs.)','Amount (Rs.)']],
    body:invoice.items.map(i=>[i.description, String(Number(i.quantity)||0), money(Math.round((Number(i.rate)||0)*100)), money(Math.round((Number(i.quantity)||0)*(Number(i.rate)||0)*100))]),
    theme:'grid', styles:{font:'helvetica',fontSize:9,cellPadding:3.2,textColor:[40,48,60],lineColor:[220,225,232],lineWidth:0.15},
    headStyles:{fillColor:[23,37,84],textColor:[255,255,255],fontStyle:'bold'}, columnStyles:{1:{halign:'right',cellWidth:18},2:{halign:'right',cellWidth:32},3:{halign:'right',cellWidth:34}},
    didDrawPage:()=>{doc.setFontSize(8);doc.setTextColor(130,138,150);doc.text('Naeem Service Centre',margin,290);doc.text(`Page ${doc.getNumberOfPages()}`,pageW-margin,290,{align:'right'});}
  });
  let finalY=(doc as any).lastAutoTable?.finalY ?? y+20; finalY+=8;
  if(finalY>240){doc.addPage();finalY=20;}
  const right=pageW-margin; doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(65,75,90);
  doc.text('Subtotal',right-55,finalY,{align:'right'}); doc.text(money(invoice.subtotalPaise),right,finalY,{align:'right'}); finalY+=6;
  if(invoice.discountPaise>0){doc.text('Discount',right-55,finalY,{align:'right'});doc.text(`-${money(invoice.discountPaise)}`,right,finalY,{align:'right'});finalY+=6;}
  if(invoice.taxPaise>0){doc.text('Tax',right-55,finalY,{align:'right'});doc.text(money(invoice.taxPaise),right,finalY,{align:'right'});finalY+=6;}
  doc.setDrawColor(23,37,84);doc.line(right-75,finalY-2,right,finalY-2);doc.setTextColor(23,37,84);doc.setFont('helvetica','bold');doc.setFontSize(13);
  doc.text('GRAND TOTAL',right-45,finalY+5,{align:'right'});doc.text(money(invoice.totalPaise),right,finalY+5,{align:'right'});finalY+=20;
  if(invoice.notes){doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(65,75,90);doc.text('Notes',margin,finalY);doc.setFont('helvetica','normal');doc.text(doc.splitTextToSize(invoice.notes,pageW-2*margin),margin,finalY+5);finalY+=14;}
  const sigY=Math.min(Math.max(finalY,235),265); doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(65,75,90);
  doc.text(doc.splitTextToSize(settings.thankYou||'Thank you for your business!',100),margin,sigY);
  await addImage(doc,settings.signature,pageW-margin-43,sigY-17,38,15);
  doc.setDrawColor(100,110,125);doc.line(pageW-margin-48,sigY+1,pageW-margin,sigY+1);doc.setFontSize(8);doc.text(settings.signatory||'Authorized Signatory',pageW-margin-24,sigY+6,{align:'center'});
  return doc.output('blob');
}
