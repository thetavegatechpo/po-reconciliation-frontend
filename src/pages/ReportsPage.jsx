import {useEffect,useMemo,useState} from 'react';
import {Alert,Button,Card,Col,Form,Row,Spinner,Table} from 'react-bootstrap';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import {downloadReportPdf,downloadReceiptPdf,downloadPoPdf,downloadInvoicePdf} from '../utils/corporatePdf';

const options=[['po-register','PO Register'],['po-vs-invoice','PO vs Invoice Reconciliation'],['invoice-outstanding','Invoice Outstanding'],['party-outstanding','Party-wise Outstanding'],['payment-received','Payment Received'],['pending-overdue-po','Pending / Overdue PO']];
const docs=[['receipt','Payment Receipt'],['po','Purchase Order Summary'],['invoice','Invoice Summary']];
const findId = x => String(x?._id||x||'');
const getData = response => Array.isArray(response?.data?.data)?response.data.data:[];
const fmt = value => value == null ? '—' : typeof value === 'object' ? (value.name||value.poNumber||value.invoiceNumber||JSON.stringify(value)) : String(value);

export default function ReportsPage(){
  const [type,setType]=useState('po-register');
  const [rows,setRows]=useState([]),[err,setErr]=useState(''),[busy,setBusy]=useState(false);
  const [docType,setDocType]=useState('receipt'),[selected,setSelected]=useState('');
  const [payments,setPayments]=useState([]),[pos,setPos]=useState([]),[invoices,setInvoices]=useState([]);
  const [docsBusy,setDocsBusy]=useState(false);
  const docsRows=useMemo(()=>docType==='receipt'?payments:docType==='po'?pos:invoices,[docType,payments,pos,invoices]);
  useEffect(()=>{let alive=true;async function loadDocs(){try{setDocsBusy(true);const result=await Promise.allSettled([api.get('/payments'),api.get('/pos',{params:{limit:1000}}),api.get('/invoices')]);if(!alive)return;setPayments(result[0].status==='fulfilled'?getData(result[0].value):[]);setPos(result[1].status==='fulfilled'?getData(result[1].value):[]);setInvoices(result[2].status==='fulfilled'?getData(result[2].value):[]);}finally{if(alive)setDocsBusy(false);}}loadDocs();return()=>{alive=false};},[]);
  const nameForDoc = p => docType==='receipt'?`${p.paymentReferenceUTR||'No UTR'} | ${new Date(p.paymentDate||p.createdAt).toLocaleDateString('en-IN')} | INR ${Number(p.amountReceived||0).toLocaleString('en-IN')}`:docType==='po'?`${p.poNumber||findId(p)} | ${p.customerSnapshot?.name||p.customer?.name||'Customer'}`:`${p.invoiceNumber||findId(p)} | INR ${Number(p.totalInvoiceAmount||p.invoiceAmount||0).toLocaleString('en-IN')}`;
  async function preview(){try{setBusy(true);const response=await api.get(`/reports/${type}`);setRows(getData(response));setErr('');}catch(e){setErr(e.response?.data?.message||'Report preview failed');}finally{setBusy(false);}}
  async function download(format){try{setBusy(true);setErr('');if(format==='pdf'){const response=await api.get(`/reports/${type}`);const data=getData(response);setRows(data);const label=options.find(x=>x[0]===type)?.[1]||type;downloadReportPdf(label,data,type);return;}
    const response=await api.get(`/reports/${type}`,{params:{format:'xlsx'},responseType:'blob'});
    const url=URL.createObjectURL(response.data),a=document.createElement('a');a.href=url;a.download=`${type}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setErr(e.message||e.response?.data?.message||'Download failed');}finally{setBusy(false);}}
  async function downloadDocument(){const item=docsRows.find(x=>findId(x)===selected);if(!item){setErr('Select a record first.');return;}try{setBusy(true);setErr('');if(docType==='receipt')downloadReceiptPdf(item);else if(docType==='po'){const response=await api.get(`/pos/${findId(item)}`);downloadPoPdf(response.data?.data||item);}else {let po=pos.find(x=>findId(x)===findId(item.po));downloadInvoicePdf(item,po);}}catch(e){setErr(e.response?.data?.message||e.message||'Document PDF failed');}finally{setBusy(false);}}
  return <>
    <PageHeader title="Reports & PDF Documents" subtitle="Branded Thetavega reports, customer payment receipts, PO and invoice summaries."/>
    {err&&<Alert variant="danger" dismissible onClose={()=>setErr('')}>{err}</Alert>}
    <Card className="filter-card mb-3"><Card.Body>
      <h5 className="mb-3">Operational Reports</h5>
      <Row className="g-2 align-items-end"><Col md={6}><Form.Label>Report</Form.Label><Form.Select value={type} onChange={e=>{setType(e.target.value);setRows([])}}>{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</Form.Select></Col>
        <Col md={6} className="d-flex gap-2 flex-wrap"><Button className="primary-btn" disabled={busy} onClick={preview}>Preview</Button><Button variant="outline-success" disabled={busy} onClick={()=>download('xlsx')}>Excel</Button><Button variant="outline-danger" disabled={busy} onClick={()=>download('pdf')}>Formatted PDF</Button></Col>
      </Row><Form.Text>PDF is generated from live report records, with a company header, aligned tables and page numbering. Excel export remains unchanged.</Form.Text>
    </Card.Body></Card>
    <Card className="filter-card mb-3"><Card.Body>
      <h5 className="mb-3">Individual PDF Documents</h5>
      <Row className="g-2 align-items-end"><Col md={4}><Form.Label>Document Type</Form.Label><Form.Select value={docType} onChange={e=>{setDocType(e.target.value);setSelected('');}}>{docs.map(([k,label])=><option key={k} value={k}>{label}</option>)}</Form.Select></Col>
        <Col md={5}><Form.Label>Select Record</Form.Label><Form.Select value={selected} disabled={docsBusy} onChange={e=>setSelected(e.target.value)}><option value="">{docsBusy?'Loading records...':'Choose record'}</option>{docsRows.map(p=><option key={findId(p)} value={findId(p)}>{nameForDoc(p)}</option>)}</Form.Select></Col>
        <Col md={3}><Button className="w-100" variant="outline-danger" disabled={!selected||busy||docsBusy} onClick={downloadDocument}>Download PDF</Button></Col>
      </Row><Form.Text>PO and invoice PDFs are formatted summaries of database records. Original uploaded customer PO and Tally invoice documents are not modified.</Form.Text>
    </Card.Body></Card>
    {busy&&<div className="small text-muted mb-2"><Spinner size="sm"/> Preparing document...</div>}
    {rows.length>0&&<Card className="table-card"><div className="table-responsive"><Table hover size="sm" className="business-table mb-0"><thead><tr>{Object.keys(rows[0]).map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{Object.keys(rows[0]).map((k,j)=><td key={j}>{fmt(row[k])}</td>)}</tr>)}</tbody></Table></div></Card>}
  </>;
}
