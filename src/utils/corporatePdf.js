// Browser-generated A4 PDFs. Requires: npm install jspdf jspdf-autotable

import { jsPDF } from 'jspdf';

import autoTable from 'jspdf-autotable';

import logoData from '../assets/logo.png?inline';



export const COMPANY = {

  name: 'THETAVEGA TECH PRIVATE LIMITED',

  address: '#02, Sadafulli, Rana Nagar, Aurangabad - 431001',

  phone: '+91 9175109978',

  email: 'info@thetavega.tech',

  website: 'www.thetavega.tech',

  cin: 'U72900PN2020PTC193900'

};

const str = x => x == null ? '' : typeof x === 'object' ? (x.name || x.companyName || x.customerName || x.poNumber || x.invoiceNumber || x._id || '') : String(x);

const value = x => str(x) || '—';

const num = x => Number.isFinite(Number(x)) ? Number(x) : 0;

const amount = x => 'INR ' + num(x).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dateText = x => { if(!x) return '—'; const d=new Date(x); return Number.isNaN(d.getTime()) ? String(x) : d.toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'}); };

const reference = x => String(x?._id || x || '');

const customerText = x => value(x?.customerSnapshot?.name || x?.customer?.name || x?.customerName || x?.partyName || x?.customer);

const printable = x => { if (x == null) return ''; if(typeof x === 'boolean') return x?'Yes':'No'; if(Array.isArray(x)) return x.map(printable).join(', '); if(typeof x==='object') return str(x) || JSON.stringify(x); return String(x); };

const safe = x => printable(x).replace(/[^\x20-\x7E\n]/g, c => ({'₹':'INR ','–':'-','—':'-','’':"'"}[c] || ''));

const tidyFilename = s => String(s).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0,70);



// Letterhead styling shared by PO, invoice, payment and report PDFs.

// Corporate seal/signature are intentionally NOT generated or imitated.

const THEME = {
  orange: [196, 76, 25],
  black: [34, 34, 34],
  muted: [95, 100, 106],
  light: [249, 248, 246],
  border: [225, 225, 225]
};

// Matches the supplied Thetavega offer-letter stationery: centered logo,
// lots of white space, soft oversized emblem, orange identity and footer.
function paintWatermark(pdf) {
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  // The real brand emblem is used, not an invented logo or signature.
  // Extremely faint opacity leaves all table and document text readable.
  if (typeof pdf.GState === 'function' && typeof pdf.setGState === 'function') {
    pdf.saveGraphicsState();
    pdf.setGState(new pdf.GState({ opacity: 0.055 }));
    const size = Math.min(w * 0.63, h * 0.49);
    pdf.addImage(logoData, 'PNG', (w - size) / 2, (h - size) / 2 + 11, size, size);
    pdf.restoreGraphicsState();
  }
}

function paintLetterhead(pdf, title, pageWidth = pdf.internal.pageSize.getWidth()) {
  const center = pageWidth / 2;
  paintWatermark(pdf);
  // Brand lockup from the photographed reference letter.
  pdf.addImage(logoData, 'PNG', center - 12, 6, 24, 24);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(17);
  pdf.setTextColor(...THEME.orange);
  pdf.text('THETAVEGA', center, 37, { align: 'center' });
  // Document title centered below a deliberate letterhead gap.
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(...THEME.black);
  pdf.text(safe(title), center, 54, { align: 'center', maxWidth: pageWidth - 32 });
}

function paintFooter(pdf, pageNumber, pageWidth = pdf.internal.pageSize.getWidth()) {
  const bottom = pdf.internal.pageSize.getHeight();
  const center = pageWidth / 2;
  // White backing ensures the watermark never appears over footer writing.
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, bottom - 36, pageWidth, 36, 'F');
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...THEME.orange);
  pdf.setFontSize(13);
  pdf.text(COMPANY.name, center, bottom - 27, { align: 'center', maxWidth: pageWidth - 24 });
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...THEME.black);
  pdf.setFontSize(8);
  pdf.text(COMPANY.address, center, bottom - 21, { align: 'center', maxWidth: pageWidth - 22 });
  pdf.setFontSize(7.4);
  pdf.text(`${COMPANY.phone}   |   ${COMPANY.email}   |   ${COMPANY.website}`, center, bottom - 15.5, { align: 'center', maxWidth: pageWidth - 20 });
  pdf.text('CIN No.: ' + COMPANY.cin, center, bottom - 10.5, { align: 'center' });
  pdf.setFontSize(6.6);
  pdf.setTextColor(...THEME.muted);
  pdf.text(`Page ${pageNumber}`, pageWidth - 14, bottom - 6, { align: 'right' });
  // The pictured stationery has a slim orange/red edge at the foot.
  pdf.setFillColor(...THEME.orange);
  pdf.rect(0, bottom - 3, pageWidth, 3, 'F');
}

function create(title, meta = []) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const margin = 15;
  paintLetterhead(pdf, title);
  const pairs = meta.filter(pair => pair?.[1] !== undefined && pair?.[1] !== null && pair?.[1] !== '');
  pairs.forEach(([key, val], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = margin + col * 92;
    const yy = 66 + row * 13;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...THEME.muted);
    pdf.text(safe(key).slice(0, 40), x, yy);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...THEME.black);
    pdf.text(safe(val).slice(0, 70), x, yy + 5, { maxWidth: 85 });
  });
  const y = 66 + Math.ceil(pairs.length / 2) * 13 + 6;
  return { pdf, y, margin };
}

function addTable(pdf, head, body, startY, { totals = [], widths } = {}) {
  autoTable(pdf, {
    startY,
    margin: { left: 15, right: 15, bottom: 39, top: 62 },
    head: [head.map(safe)],
    body: body.map(row => row.map(safe)),
    ...(totals.length ? { foot: [totals.map(safe)] } : {}),
    theme: 'grid',
    styles: {
      font: 'helvetica', fontSize: 8, cellPadding: 3.2, overflow: 'linebreak',
      lineColor: THEME.border, lineWidth: 0.14, textColor: THEME.black,
      valign: 'middle'
    },
    headStyles: { fillColor: THEME.black, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: THEME.light },
    footStyles: { fillColor: [255, 242, 234], textColor: THEME.black, fontStyle: 'bold' },
    ...(widths ? { columnStyles: widths } : {}),
    didDrawPage: ({ pageNumber }) => {
      if (pageNumber > 1) paintLetterhead(pdf, 'DOCUMENT CONTINUED');
    }
  });
  return pdf.lastAutoTable?.finalY || startY;
}

function note(pdf, y, txt) {
  const lines = pdf.splitTextToSize(safe(txt), pdf.internal.pageSize.getWidth() - 32);
  const requiredHeight = lines.length * 4.5 + 8;
  if (y + requiredHeight > pdf.internal.pageSize.getHeight() - 37) {
    pdf.addPage();
    paintLetterhead(pdf, 'DOCUMENT CONTINUED');
    y = 63;
  }
  pdf.setTextColor(...THEME.muted);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.text(lines, 16, y + 7);
}

function download(pdf, filename) {
  const pages = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    paintFooter(pdf, i);
  }
  pdf.save(tidyFilename(filename) + '.pdf');
}

export function downloadReceiptPdf(p) {

  const meta=[['Receipt Date',dateText(p.paymentDate)],['Receipt Reference',p.receiptNumber || p.paymentReferenceUTR || reference(p._id)],['Customer',customerText(p)],['Payment Type',p.paymentType==='ADVANCE'?'Advance Receipt':'Invoice Settlement'],['UTR / Bank Reference',p.paymentReferenceUTR||'Not provided'],['TDS Financial Year',p.tdsFinancialYear||'Not applicable']];

  const {pdf,y}=create('PAYMENT RECEIPT',meta);

  const allocations=p.paymentAllocations?.length?p.paymentAllocations:(p.paymentType==='INVOICE_PAYMENT'?[{po:p.po,invoice:p.invoice,amount:p.amountReceived}]:[]);

  const tableRows=allocations.length?allocations.map((a,i)=>[String(i+1),value(a.po?.poNumber||a.po),value(a.invoice?.invoiceNumber||a.invoice),amount(a.amount)]):[['1',value(p.po?.poNumber||p.po),'Advance',amount(p.amountReceived)]];

  const end=addTable(pdf,['#','PO Number','Invoice Number','Gross Allocated'],tableRows,y,{totals:['','','Gross Receipt',amount(p.amountReceived)]});

  const summary=[['TDS Section',value(p.tdsRate?.section||'Not applicable')],['TDS Rate',num(p.tdsPercent)+'%'],['Taxable Base',amount(p.tdsBaseAmount)],['TDS Deducted',amount(p.tdsDeductions)],['Other Deductions',amount(p.otherDeductions)],['Net Bank Received',amount(p.netAmountReceived)]];

  const last=addTable(pdf,['Payment Summary','Value'],summary,end+9);

  if(p.remarks) note(pdf,last+5,'Remarks: '+p.remarks);

  download(pdf,'Payment_Receipt_'+(p.paymentReferenceUTR||reference(p._id)));

}



export function downloadPoPdf(p) {

  const {pdf,y}=create('PURCHASE ORDER SUMMARY', [['PO Number',p.poNumber],['PO Date',dateText(p.poDate||p.orderDate||p.createdAt)],['Customer',customerText(p)],['Status',p.overallStatus||p.executionStatus],['Project',p.project?.name||p.project?.projectName||p.projectName],['Expected Completion',dateText(p.expectedCompletionDate)]]);

  const items=p.items||p.poItems||p.lineItems||p.details||[];

  const body=items.length ? items.map((x,i)=>[i+1,value(x.description||x.item?.itemName||x.itemName||x.partName||x.name),value(x.hsnCode||x.hsn||''),value(x.quantity||x.qty||0),amount(x.rate||x.unitPrice||x.price),amount(x.amount||x.totalAmount||num(x.quantity||x.qty)*num(x.rate||x.unitPrice||x.price))]) : [['—','No line-item details provided by the PO API','—','—','—','—']];

  const end=addTable(pdf,['#','Item / Description','HSN','Qty','Rate','Amount'],body,y);

  const total=p.totalPOAmount??p.totalAmount??p.poAmount??p.grandTotal;

  const summaries=[['Basic Amount',amount(p.basicAmount||p.subTotal||p.subtotal||0)],['Tax / GST',amount(p.gstAmount||p.taxAmount||0)],['PO Total', total==null?'Not provided':amount(total)]];

  const last=addTable(pdf,['Summary','Value'],summaries,end+7);

  note(pdf,last+6,'Summary generated from the PO record. Refer to the uploaded customer PO for the original commercial document and terms.');

  download(pdf,'PO_'+(p.poNumber||reference(p._id)));

}



export function downloadInvoicePdf(inv,po) {

  const {pdf,y}=create('INVOICE SUMMARY',[['Invoice Number',inv.invoiceNumber],['Invoice Date',dateText(inv.invoiceDate||inv.date||inv.createdAt)],['Customer',customerText(po||inv)],['PO Number',value(po?.poNumber||inv.po?.poNumber||inv.po)],['Approval',inv.approvalStatus||'—'],['Payment Status',inv.paymentStatus||'—']]);

  const allocations=inv.poAllocations||[];

  const items=inv.items||inv.invoiceItems||inv.lineItems||[];

  const body=items.length?items.map((x,i)=>[i+1,value(x.description||x.itemName||x.item?.name||x.name),value(x.quantity||x.qty||0),amount(x.rate||x.price||0),amount(x.amount||x.totalAmount||0)]):allocations.length?allocations.map((x,i)=>[i+1,'PO '+value(x.po?.poNumber||x.po),'—','—',amount(x.allocatedAmount)]):[['1','Invoice settlement','—','—',amount(inv.totalInvoiceAmount||inv.invoiceAmount)]];

  const end=addTable(pdf,['#','Description / PO','Qty','Rate','Amount'],body,y);

  addTable(pdf,['Invoice Summary','Amount'],[['Taxable / Basic Value',amount(inv.invoiceAmount)],['Total Invoice Value',amount(inv.totalInvoiceAmount??inv.invoiceAmount)],['Paid Amount',amount(inv.paidAmount)],['Outstanding',amount(inv.outstandingAmount)]],end+8);

  download(pdf,'Invoice_'+(inv.invoiceNumber||reference(inv._id)));

}



export function downloadReportPdf(title,rows,filename){

  if(!Array.isArray(rows)||!rows.length)throw new Error('No report records available to export.');

  const cols=[...new Set(rows.flatMap(r=>Object.keys(r)))];

  const landscape=cols.length>6;

  const {pdf,y}=create(title,[['Report Date',dateText(new Date())],['Total Records',rows.length]]);

  if(landscape){ // wide tabular reports use landscape A4, with repeated headers

    const wide = new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});

    const pageW=wide.internal.pageSize.getWidth();

    paintLetterhead(wide,title,pageW);

    autoTable(wide,{startY:65,head:[cols.map(k=>safe(k.replace(/([A-Z])/g,' $1').replace(/_/g,' ')))],body:rows.map(x=>cols.map(k=>safe(x[k]))),styles:{fontSize:7,overflow:'linebreak',cellPadding:2},headStyles:{fillColor:THEME.black,textColor:255},theme:'grid',margin:{left:11,right:11,bottom:39,top:65},didDrawPage:({pageNumber})=>{if(pageNumber>1)paintLetterhead(wide,title,pageW);}});

    return download(wide,filename);

  }

  addTable(pdf,cols.map(k=>k.replace(/([A-Z])/g,' $1').replace(/_/g,' ')),rows.map(x=>cols.map(k=>printable(x[k]))),y);

  return download(pdf,filename);

}
