import { useEffect, useState } from 'react';

import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';

import api from '../api/client';

import { date, money } from '../utils/format';

import PageHeader from '../components/PageHeader';
import { downloadReceiptPdf } from '../utils/corporatePdf';

import { useAuth } from '../context/AuthContext';



const n=x=>Number.isFinite(Number(x))?Number(x):0;

const r=x=>Math.round((x+Number.EPSILON)*100)/100;

const id=x=>String(x?._id||x||'');

const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};

const inputDate=x=>x?new Date(x).toISOString().slice(0,10):'';

// Indian financial year: April 1 through March 31.
const getFinancialYear=value=>{
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||'').slice(0,10));
  if(!match)return '';
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const checked=new Date(Date.UTC(year,month-1,day));
  if(checked.getUTCFullYear()!==year||checked.getUTCMonth()!==month-1||checked.getUTCDate()!==day)return '';
  const start=month>=4?year:year-1;
  return `${start}-${String((start+1)%100).padStart(2,'0')}`;
};

const blank=()=>({customer:'',paymentType:'INVOICE_PAYMENT',paymentDate:today(),rows:[],po:'',amountReceived:'',tdsPercent:'0',tdsFinancialYear:getFinancialYear(today()),tdsRate:'',tdsBaseAmount:'',otherDeductions:'0',paymentReferenceUTR:'',remarks:''});

const person=x=>typeof x==='object'&&x?(x.name||x.email||id(x)):x||'—';

const text=x=>x==null?'—':typeof x==='object'?JSON.stringify(x):String(x);

const poName=p=>p?.customerSnapshot?.name||p?.customer?.name||'—';

const historyFields={paymentAllocations:'PO / Invoice allocations',paymentDate:'Payment Date',amountReceived:'Gross Settlement',tdsPercent:'TDS %',tdsBaseAmount:'Taxable Base',tdsDeductions:'TDS Amount',otherDeductions:'Other Deductions',netAmountReceived:'Net Bank Received',paymentReferenceUTR:'UTR',remarks:'Remarks'};

const receiptRows=p=>p.paymentAllocations?.length?p.paymentAllocations.map(a=>({po:id(a.po),invoice:id(a.invoice),amount:String(a.amount)})):p.paymentType==='INVOICE_PAYMENT'?[{po:id(p.po),invoice:id(p.invoice),amount:String(p.amountReceived)}]:[];



export default function PaymentsPage(){

 const {can}=useAuth();const canManage=can('payment.create');const canEditPayment=can('payment.edit');

 const [payments,setPayments]=useState([]),[pos,setPos]=useState([]),[invoices,setInvoices]=useState([]);

 const [loading,setLoading]=useState(true),[error,setError]=useState('');

 const [show,setShow]=useState(false),[editing,setEditing]=useState(null),[form,setForm]=useState(blank),[formError,setFormError]=useState(''),[saving,setSaving]=useState(false);

 const [tdsYears,setTdsYears]=useState([]),[tdsOptions,setTdsOptions]=useState([]),[tdsLoading,setTdsLoading]=useState(false),[tdsYearLoading,setTdsYearLoading]=useState(false),[tdsYearError,setTdsYearError]=useState('');

 const [history,setHistory]=useState(null),[historyLoading,setHistoryLoading]=useState(false);

 const edit=!!editing?._id;

 const patch=(key,value)=>setForm(p=>({...p,[key]:value}));

 async function load(){try{setLoading(true);const [p,po,i]=await Promise.all([api.get('/payments'),api.get('/pos',{params:{limit:200}}),api.get('/invoices')]);setPayments(p.data?.data||[]);setPos(po.data?.data||[]);setInvoices(i.data?.data||[]);setError('');}catch(e){setError(e.response?.data?.message||'Could not load payments.');}finally{setLoading(false);}}

 useEffect(()=>{load();},[]);

  useEffect(()=>{
   let live=true;
   async function loadTdsYears(){
     setTdsYearLoading(true);
     setTdsYearError('');
     try {
       const response=await api.get('/payments/tds-years');
       const payload=response.data;
       // Support both {success:true,data:[...]} and a plain array.
       const list=Array.isArray(payload)?payload:Array.isArray(payload?.data)?payload.data:[];
       const years=[...new Set(list.map(y=>typeof y==='string'?y:y?.financialYear).filter(Boolean))].sort().reverse();
       if(live){
         setTdsYears(years);
         if(!years.length)setTdsYearError('No TDS financial years returned by /payments/tds-years. Check the API response and TDS Master records.');
       }
     }catch(err){
       if(live){
         setTdsYears([]);
         setTdsYearError(err.response?.data?.message||`Unable to load TDS years (HTTP ${err.response?.status||'network error'}). Check /payments/tds-years.`);
         console.error('TDS years request failed:',err);
       }
     }finally{if(live)setTdsYearLoading(false);}
   }
   loadTdsYears();
   return ()=>{live=false;};
 },[]);

  useEffect(()=>{

    let live=true;

    setTdsOptions([]);

    if(!form.tdsFinancialYear)return;

    setTdsLoading(true);

    api.get('/payments/tds-options',{params:{year:form.tdsFinancialYear}})

      .then(x=>{if(live)setTdsOptions(x.data?.data||[]);})

      .catch(err=>{if(live){setTdsOptions([]);setFormError(err.response?.data?.message||'Unable to load TDS rates for the selected financial year.');}})

      .finally(()=>{if(live)setTdsLoading(false);});

    return ()=>{live=false;};

  },[form.tdsFinancialYear,form.paymentType]);

  const paymentDay=String(form.paymentDate||'').slice(0,10);

  const effectiveTdsOptions=tdsOptions.filter(t=>(!t.effectiveFrom||paymentDay>=String(t.effectiveFrom).slice(0,10))&&(!t.effectiveTo||paymentDay<=String(t.effectiveTo).slice(0,10)));



 const customers=[...new Map(pos.filter(p=>id(p.customer)).map(p=>[id(p.customer),{id:id(p.customer),name:poName(p)}])).values()].sort((a,b)=>a.name.localeCompare(b.name));

 const customerPOs=pos.filter(p=>id(p.customer)===form.customer&&p.executionStatus!=='CANCELLED'&&p.overallStatus!=='CANCELLED');

 const rowInvoices=(poId)=>invoices.filter(i=>(id(i.po)===poId||(i.poAllocations||[]).some(a=>id(a.po)===poId))&&!['PENDING','REJECTED'].includes(i.approvalStatus));

 const allocations=form.rows.filter(row=>row.po&&row.invoice&&n(row.amount)>0);

 const total=r(allocations.reduce((s,row)=>s+n(row.amount),0));

 const taxable=form.paymentType==='ADVANCE' ? r(n(form.tdsBaseAmount)) : r(allocations.reduce((s,row)=>{const i=invoices.find(x=>id(x)===row.invoice);return s+n(row.amount)*n(i?.invoiceAmount)/Math.max(1,n(i?.totalInvoiceAmount));},0));

 const tds=r(taxable*n(form.tdsPercent)/100);const other=n(form.otherDeductions);const net=r((form.paymentType==='ADVANCE'?n(form.amountReceived):total)-tds-other);

 function rowAvailable(row){if(!row.po||!row.invoice)return 0;const i=invoices.find(x=>id(x)===row.invoice);if(!i)return 0;

  const share=i.poAllocations?.length?n(i.poAllocations.find(a=>id(a.po)===row.po)?.allocatedAmount):n(i.totalInvoiceAmount);

  const paymentsUsed=payments.filter(p=>id(p)!==id(editing)&&!['PENDING','REJECTED'].includes(p.approvalStatus)).flatMap(p=>receiptRows(p)).filter(a=>a.po===row.po&&a.invoice===row.invoice).reduce((s,a)=>s+n(a.amount),0);

  // Advance allocations are also checked by the backend before saving.

  return Math.max(0,r(Math.min(share-paymentsUsed,n(i.outstandingAmount)+(edit?receiptRows(editing).filter(a=>a.invoice===row.invoice).reduce((s,a)=>s+n(a.amount),0):0))));

 }

 const startCreate=()=>{setEditing(null);setForm(blank());setFormError('');setShow(true);};

 function startEdit(p){if(['PENDING','REJECTED'].includes(p.approvalStatus)){setError('Resolve this historical pending/rejected record first.');return;}

  const rows=receiptRows(p);const firstPo=pos.find(x=>id(x)===rows[0]?.po)||pos.find(x=>id(x)===id(p.po));

  setEditing(p);setForm({customer:id(p.customer)||id(firstPo?.customer),paymentType:p.paymentType,paymentDate:inputDate(p.paymentDate),rows,po:id(p.po),amountReceived:String(p.amountReceived),tdsPercent:String(p.tdsPercent||0),tdsFinancialYear:getFinancialYear(inputDate(p.paymentDate)),tdsRate:id(p.tdsRate)==='null'?'':id(p.tdsRate)||'',tdsBaseAmount:String(p.tdsBaseAmount||0),otherDeductions:String(p.otherDeductions||0),paymentReferenceUTR:p.paymentReferenceUTR||'',remarks:p.remarks||''});setFormError('');setShow(true);

 }

 const close=()=>{if(!saving){setShow(false);setEditing(null);setForm(blank());setFormError('');}};

 function updateRow(index,key,value){setForm(p=>({...p,rows:p.rows.map((row,j)=>j===index?{...row,[key]:value,...(key==='po'?{invoice:'',amount:''}:{})}:row)}));}

 async function save(e){e.preventDefault();setFormError('');

  if(!form.customer){setFormError('Select a customer.');return;}

  if(form.paymentType==='INVOICE_PAYMENT'){

   if(!allocations.length||allocations.length!==form.rows.length){setFormError('Select PO, invoice and a positive allocated amount on every row.');return;}

   const keys=allocations.map(a=>`${a.po}/${a.invoice}`);if(new Set(keys).size!==keys.length){setFormError('An invoice/PO pair cannot be duplicated.');return;}

   if(allocations.some(a=>n(a.amount)>rowAvailable(a)+.01)){setFormError('An allocation exceeds an invoice/PO available balance.');return;}

  }else if(!form.po){setFormError('Select a PO for the advance.');return;}

  if(n(form.tdsPercent)<0||n(form.tdsPercent)>100){setFormError('Invalid TDS percentage.');return;}

     if(form.tdsRate&&!effectiveTdsOptions.some(rate=>rate._id===form.tdsRate)){
     setFormError('Selected TDS rate is not applicable to the payment date. Choose an active TDS rate or No TDS.');return;
   }
   const gross=form.paymentType==='INVOICE_PAYMENT'?total:n(form.amountReceived);

  if(gross<=0||net<-.01||(form.paymentType==='ADVANCE'&&form.tdsRate&&(taxable<=0||taxable>gross))){setFormError('Check gross amount and deductions.');return;}

  const payload={paymentType:form.paymentType,paymentDate:form.paymentDate,po:form.paymentType==='ADVANCE'?form.po:allocations[0].po,invoice:form.paymentType==='ADVANCE'?null:allocations[0].invoice,

   paymentAllocations:form.paymentType==='ADVANCE'?[]:allocations.map(a=>({po:a.po,invoice:a.invoice,amount:r(n(a.amount))})),amountReceived:gross,tdsPercent:n(form.tdsPercent),tdsRate:form.tdsRate||null,tdsFinancialYear:form.tdsRate?form.tdsFinancialYear:'',tdsBaseAmount:form.paymentType==='ADVANCE'?taxable:undefined,otherDeductions:other,paymentReferenceUTR:form.paymentReferenceUTR.trim().toUpperCase(),remarks:form.remarks.trim(),paymentReceived:true};

  try{setSaving(true);if(edit)await api.put(`/payments/${editing._id}`,payload);else await api.post('/payments',payload);close();setShow(false);await load();}

  catch(x){setFormError(x.response?.data?.message||'Payment could not be saved.');}finally{setSaving(false);}

 }

 async function openHistory(p){setHistory({payment:p,data:null});setHistoryLoading(true);try{const x=await api.get(`/payments/${p._id}/history`);setHistory({payment:p,data:x.data?.data});}catch(x){setHistory({payment:p,error:x.response?.data?.message||'Could not load history.'});}finally{setHistoryLoading(false);}}

 return <>

  <PageHeader title="Payments & Receipts" subtitle="One bank receipt / UTR can settle invoices across multiple POs of the same customer." actions={canManage?<Button className="primary-btn" onClick={startCreate}>+ Record Payment</Button>:null}/>

  {error&&<Alert variant="danger" dismissible onClose={()=>setError('')}>{error}</Alert>}

  <Row className="g-3 mb-3 tv-kpi-row"><Col md={4}><Card className="border-0 shadow-sm"><Card.Body><small className="text-muted">Receipts</small><h4>{payments.length}</h4></Card.Body></Card></Col><Col md={4}><Card className="border-0 shadow-sm"><Card.Body><small className="text-muted">Active gross receipts</small><h4>{money(payments.filter(p=>!['PENDING','REJECTED'].includes(p.approvalStatus)).reduce((s,p)=>s+n(p.amountReceived),0))}</h4></Card.Body></Card></Col><Col md={4}><Card className="border-0 shadow-sm"><Card.Body><small className="text-muted">Edited receipts</small><h4>{payments.filter(p=>n(p.revisionNo)>0).length}</h4></Card.Body></Card></Col></Row>

  <Card className="table-card"><div className="table-responsive"><Table hover className="business-table mb-0 align-middle"><thead><tr><th>Date / UTR</th><th>PO / Invoice Allocations</th><th>Type</th><th className="text-end">Gross</th><th className="text-end">TDS % / Amount</th><th className="text-end">Net Bank</th><th>Recorded By</th><th>Receipt PDF</th><th>History</th>{canEditPayment&&<th>Action</th>}</tr></thead><tbody>

   {loading?<tr><td colSpan={canEditPayment?10:9} className="text-center py-4"><Spinner size="sm"/> Loading...</td></tr>:!payments.length?<tr><td colSpan={canEditPayment?10:9} className="text-center py-4">No receipts</td></tr>:payments.map(p=><tr key={p._id}><td><strong>{date(p.paymentDate)}</strong><small className="d-block text-muted">{p.paymentReferenceUTR||'No UTR'}</small></td><td>{p.paymentType==='ADVANCE'?<span>{p.po?.poNumber||'—'} (Advance)</span>:<div>{(p.paymentAllocations?.length?p.paymentAllocations:[{po:p.po,invoice:p.invoice,amount:p.amountReceived}]).map((a,j)=><div key={j} className="small mb-1"><strong>{a.po?.poNumber||'PO'}</strong> / {a.invoice?.invoiceNumber||'Invoice'} — {money(a.amount)}</div>)}</div>}</td><td><Badge bg={p.paymentType==='ADVANCE'?'info':'primary'}>{p.paymentType==='ADVANCE'?'Advance':'Invoice'}</Badge></td><td className="text-end">{money(p.amountReceived)}</td><td className="text-end">{n(p.tdsPercent)}% <small className="d-block">{money(p.tdsDeductions)}</small></td><td className="text-end fw-semibold">{money(p.netAmountReceived)}</td><td>{person(p.createdBy)}</td><td><Button size="sm" variant="outline-danger" onClick={()=>downloadReceiptPdf(p)}>PDF</Button></td><td><Button size="sm" variant="outline-secondary" onClick={()=>openHistory(p)}>History</Button></td>{canEditPayment&&<td><Button size="sm" variant="outline-primary" disabled={['PENDING','REJECTED'].includes(p.approvalStatus)} onClick={()=>startEdit(p)}>Edit</Button></td>}</tr>)}</tbody></Table></div></Card>

  <Modal show={show} onHide={close} size="xl" dialogClassName="consolidated-payment-dialog" centered backdrop="static"><Form onSubmit={save}><Modal.Header closeButton><Modal.Title>{edit?'Edit Payment':'Record Customer Payment'}</Modal.Title></Modal.Header><Modal.Body style={{maxHeight:'72vh',overflowY:'auto'}}>

   {formError&&<Alert variant="danger">{formError}</Alert>}

   <Alert variant="info" className="py-2">One receipt and UTR, with each invoice/PO settled only by its allocated amount. Saves directly and records edits.</Alert>

   <Row className="g-3 mb-3"><Col md={4}><Form.Label>Payment Type</Form.Label><Form.Select value={form.paymentType} disabled={edit} onChange={e=>setForm(f=>({...f,paymentType:e.target.value,rows:[],po:'',tdsPercent:'0',tdsRate:'',tdsFinancialYear:getFinancialYear(f.paymentDate)}))}><option value="INVOICE_PAYMENT">Invoice Payment</option><option value="ADVANCE">Advance Received</option></Form.Select></Col><Col md={4}><Form.Label>Payment Date</Form.Label><Form.Control required type="date" value={form.paymentDate} onChange={e=>setForm(f=>({...f,paymentDate:e.target.value,tdsFinancialYear:getFinancialYear(e.target.value),tdsRate:'',tdsPercent:'0'}))}/></Col><Col md={4}><Form.Label>Customer</Form.Label><Form.Select required value={form.customer} disabled={edit} onChange={e=>setForm(f=>({...f,customer:e.target.value,rows:[],po:''}))}><option value="">Choose Customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Form.Select></Col></Row>

   {form.paymentType==='INVOICE_PAYMENT'?<><div className="d-flex justify-content-between align-items-center mb-2"><strong>Invoice / PO allocations</strong><Button size="sm" variant="outline-primary" disabled={!form.customer} onClick={()=>patch('rows',[...form.rows,{po:'',invoice:'',amount:''}])}>+ Add Invoice / PO</Button></div><div className="table-responsive"><Table bordered size="sm" className="align-middle"><thead><tr><th>Customer PO</th><th>Invoice</th><th>Outstanding / Available</th><th>Allocate ₹</th><th></th></tr></thead><tbody>{form.rows.map((row,j)=>{const inv=invoices.find(i=>id(i)===row.invoice);return <tr key={j}><td style={{minWidth:210}}><Form.Select required value={row.po} onChange={e=>updateRow(j,'po',e.target.value)}><option value="">Choose PO</option>{customerPOs.map(po=><option key={po._id} value={po._id}>{po.poNumber}</option>)}</Form.Select></td><td style={{minWidth:250}}><Form.Select required value={row.invoice} disabled={!row.po} onChange={e=>updateRow(j,'invoice',e.target.value)}><option value="">Choose invoice</option>{rowInvoices(row.po).map(i=><option key={i._id} value={i._id}>{i.invoiceNumber}</option>)}</Form.Select></td><td className="text-nowrap"><small className="text-muted">{inv?`Invoice: ${money(inv.outstandingAmount)}`:'—'}</small><div className="fw-semibold">{row.invoice?money(rowAvailable(row)):'—'}</div></td><td style={{minWidth:160}}><Form.Control required type="number" min="0.01" step="0.01" value={row.amount} onChange={e=>updateRow(j,'amount',e.target.value)}/></td><td><Button size="sm" variant="outline-danger" onClick={()=>patch('rows',form.rows.filter((_,k)=>k!==j))}>Remove</Button></td></tr>;})}</tbody></Table></div>{!form.rows.length&&<Alert variant="secondary">Choose a customer, then click “Add Invoice / PO”.</Alert>}</>:<Row className="mb-3"><Col md={6}><Form.Label>Customer PO for advance</Form.Label><Form.Select required value={form.po} disabled={edit} onChange={e=>patch('po',e.target.value)}><option value="">Select PO</option>{customerPOs.map(p=><option key={p._id} value={p._id}>{p.poNumber}</option>)}</Form.Select></Col><Col md={6}><Form.Label>Advance Gross Amount ₹</Form.Label><Form.Control required type="number" min="0.01" step="0.01" value={form.amountReceived} onChange={e=>patch('amountReceived',e.target.value)}/></Col></Row>}



    {<Row className="g-3 mb-3">

      <Col md={4}><Form.Label>TDS Financial Year</Form.Label>

                <Form.Select value={form.tdsFinancialYear} disabled aria-label="Financial year determined by payment date">
          <option value={form.tdsFinancialYear}>{form.tdsFinancialYear?`FY ${form.tdsFinancialYear}`:'Select a payment date'}</option>
        </Form.Select>
        <Form.Text className="d-block">Automatically calculated from the payment date (April–March).</Form.Text>
        {tdsYearError&&<Form.Text className="text-danger d-block">{tdsYearError}</Form.Text>}
        {!tdsYearLoading&&!tdsYearError&&form.tdsFinancialYear&&!tdsYears.includes(form.tdsFinancialYear)&&<Form.Text className="text-warning d-block">TDS Master not configured for FY {form.tdsFinancialYear}. You can record this receipt without TDS or configure verified rates in Masters.</Form.Text>}
       </Col>

      <Col md={8}><Form.Label>TDS Section / Rate</Form.Label>

        <Form.Select value={form.tdsRate} disabled={!form.tdsFinancialYear||tdsLoading||!tdsYears.includes(form.tdsFinancialYear)} onChange={e=>{

          const rate=effectiveTdsOptions.find(t=>t._id===e.target.value);

          setForm(f=>({...f,tdsRate:rate?._id||'',tdsPercent:rate?String(rate.rate):'0'}));

        }}>

          <option value="">{tdsLoading?'Loading rates...':'No TDS / Choose applicable rate'}</option>

          {effectiveTdsOptions.map(t=><option key={t._id} value={t._id}>

            {t.section} — {t.description} — {t.deducteeType} — {t.rate}%

          </option>)}

        </Form.Select>

        {form.tdsFinancialYear&&!tdsLoading&&tdsYears.includes(form.tdsFinancialYear)&&effectiveTdsOptions.length===0&&<Form.Text className="text-warning d-block">No active TDS rates apply on {paymentDay} for FY {form.tdsFinancialYear}. Review the effective dates in TDS Master.</Form.Text>}
         <Form.Text>Select the applicable recipient category. Thresholds and statutory conditions must be verified before applying TDS.</Form.Text>

      </Col>

    </Row>}

   <Row className="g-3"><Col md={3}><Form.Label>Gross Settlement ₹</Form.Label><Form.Control readOnly value={form.paymentType==='INVOICE_PAYMENT'?total.toFixed(2):form.amountReceived}/></Col><Col md={3}><Form.Label>TDS % (excl. GST)</Form.Label><Form.Control value={form.tdsPercent} readOnly /></Col><Col md={3}><Form.Label>Taxable Base ₹</Form.Label>{form.paymentType==='ADVANCE'?<Form.Control type="number" min="0" max={form.amountReceived} step="0.01" value={form.tdsBaseAmount} disabled={!form.tdsRate} onChange={e=>patch('tdsBaseAmount',e.target.value)}/>:<Form.Control value={taxable.toFixed(2)} readOnly/>}</Col><Col md={3}><Form.Label>TDS Amount ₹</Form.Label><Form.Control value={tds.toFixed(2)} readOnly/></Col><Col md={4}><Form.Label>Other Deductions ₹</Form.Label><Form.Control type="number" min="0" step="0.01" value={form.otherDeductions} onChange={e=>patch('otherDeductions',e.target.value)}/></Col><Col md={4}><Form.Label>Net Bank Amount ₹</Form.Label><Form.Control value={net.toFixed(2)} readOnly/></Col><Col md={4}><Form.Label>UTR / Reference</Form.Label><Form.Control value={form.paymentReferenceUTR} onChange={e=>patch('paymentReferenceUTR',e.target.value.toUpperCase())}/></Col><Col md={12}><Form.Label>Remarks</Form.Label><Form.Control as="textarea" rows={2} value={form.remarks} onChange={e=>patch('remarks',e.target.value)}/></Col></Row>

   <Form.Text>For advances, enter the applicable taxable base excluding GST when selecting a TDS Master. For invoice allocations: taxable base = allocated gross × (invoice basic ÷ invoice total). Total TDS = sum of taxable bases × TDS%. Round-off may cause a small difference in attributed PO-wise bank totals.</Form.Text>

  </Modal.Body><Modal.Footer><Button variant="light" disabled={saving} onClick={close}>Cancel</Button><Button type="submit" disabled={saving}>{saving?'Saving...':edit?'Save Changes':'Save Payment'}</Button></Modal.Footer></Form></Modal>

  <Modal show={!!history} onHide={()=>setHistory(null)} size="lg"><Modal.Header closeButton><Modal.Title>Payment Edit History</Modal.Title></Modal.Header><Modal.Body>{historyLoading?<Spinner/>:history?.error?<Alert variant="danger">{history.error}</Alert>:history?.data&&<><Row className="mb-3"><Col><small className="d-block text-muted">Created By</small>{person(history.data.createdBy)}<div className="small">{history.data.createdAt&&new Date(history.data.createdAt).toLocaleString('en-IN')}</div></Col><Col><small className="d-block text-muted">Last Edited By</small>{person(history.data.updatedBy)}<div className="small">{history.data.updatedAt&&new Date(history.data.updatedAt).toLocaleString('en-IN')}</div></Col></Row>{!history.data.editHistory?.length?<Alert variant="secondary">No changes recorded.</Alert>:[...history.data.editHistory].reverse().map((e,j)=><Card key={j} className="mb-3"><Card.Header><strong>{person(e.editedBy)}</strong><span className="float-end small">{e.editedAt&&new Date(e.editedAt).toLocaleString('en-IN')}</span></Card.Header><Table size="sm" className="mb-0"><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>{e.changes.map((c,k)=><tr key={k}><td>{historyFields[c.field]||c.field}</td><td>{text(c.oldValue)}</td><td>{text(c.newValue)}</td></tr>)}</tbody></Table></Card>)}</>}</Modal.Body></Modal>

 </>;

}
