import {useCallback,useEffect,useState} from 'react';
import {Alert,Badge,Button,Card,Col,Form,Row,Table} from 'react-bootstrap';
import api from '../api/client';
const empty=()=>({amount:'',receivedDate:new Date().toLocaleDateString('en-CA'),paymentMode:'NEFT',referenceNo:'',remarks:'',tdsRate:'',tdsBaseAmount:'',otherDeductions:0});
const currency=v=>`₹${Number(v||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const readableDate=v=>v?new Date(v).toLocaleDateString('en-IN'):'—';
const readableTime=v=>v?new Date(v).toLocaleString('en-IN'):'—';
export default function POAdvanceSection({poId,canRecord=false}) {
  const [rows,setRows]=useState([]),[summary,setSummary]=useState({}),[form,setForm]=useState(empty);
  const [rates,setRates]=useState([]);
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[info,setInfo]=useState('');
  const load=useCallback(async()=>{
    try {const r=await api.get(`/pos/${poId}/advances`);setRows(r.data.data||[]);setSummary(r.data.summary||{});}
    catch(e){setError(e.response?.data?.message||'Unable to load advance receipts.');}
  },[poId]);
  useEffect(()=>{if(poId) load();},[poId,load]);
  const paymentDay = String(form.receivedDate || '').slice(0, 10);
  const [fyYear,fyMonth] = paymentDay.split('-').map(Number);
  const fiscalStart = fyMonth >= 4 ? fyYear : fyYear - 1;
  const fy = fyYear ? `${fiscalStart}-${String((fiscalStart + 1) % 100).padStart(2,'0')}` : '';
  useEffect(() => {let live=true;setRates([]);if (fy) api.get('/payments/tds-options',{params:{year:fy}}).then(r=>{if(live)setRates(r.data.data||[]);}).catch(()=>{});return()=>{live=false;};},[fy]);
  const eligibleRates = rates.filter(rate=>rate.isActive!==false&&(!rate.effectiveFrom||paymentDay>=String(rate.effectiveFrom).slice(0,10))&&(!rate.effectiveTo||paymentDay<=String(rate.effectiveTo).slice(0,10)));
  const selectedRate=eligibleRates.find(rate=>rate._id===form.tdsRate);
  const tdsAmount=Math.round(Number(form.tdsBaseAmount||0)*Number(selectedRate?.rate||0))/100;
  const netBank=Number(form.amount||0)-tdsAmount-Number(form.otherDeductions||0);
  async function save(e){e.preventDefault();setBusy(true);setError('');setInfo('');
    try {await api.post(`/pos/${poId}/advances`,{...form,amount:Number(form.amount),tdsBaseAmount:form.tdsRate?Number(form.tdsBaseAmount):0,otherDeductions:Number(form.otherDeductions||0)});setOpen(false);setForm(empty());setInfo('Advance receipt recorded successfully.');await load();}
    catch(e){setError(e.response?.data?.message||'Unable to record advance.');}
    finally{setBusy(false);}
  }
  return <Card className="panel-card mb-3"><Card.Body>
    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
      <div><h5 className="mb-1">Customer Advance Receipts</h5><small className="text-muted">Advance receipts also appear in Payments and are included in PO outstanding.</small></div>
      {canRecord&&<Button variant="outline-primary" onClick={()=>setOpen(x=>!x)}>{open?'Cancel':' + Add Advance Payment'}</Button>}
    </div>
    {error&&<Alert variant="danger" onClose={()=>setError('')} dismissible>{error}</Alert>}
    {info&&<Alert variant="success" onClose={()=>setInfo('')} dismissible>{info}</Alert>}
    <Row className="g-2 mb-3">{[['Advance Received',summary.totalReceived],['Advance Allocated',summary.totalAllocated],['Advance Available',summary.availableAdvance]].map(([label,val])=><Col md={4} key={label}><div className="border rounded p-3 h-100"><small className="text-muted d-block">{label}</small><strong style={{fontSize:20}}>{currency(val)}</strong></div></Col>)}</Row>
    {open&&canRecord&&<Form onSubmit={save} className="border rounded p-3 mb-3"><Row className="g-3">
      <Col md={6}><Form.Label>Advance Amount (₹) *</Form.Label><Form.Control type="number" min="0.01" step="0.01" required value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></Col>
      <Col md={6}><Form.Label>Received Date *</Form.Label><Form.Control type="date" required value={form.receivedDate} onChange={e=>setForm({...form,receivedDate:e.target.value,tdsRate:'',tdsBaseAmount:''})}/></Col>
      <Col md={6}><Form.Label>Payment Mode *</Form.Label><Form.Select value={form.paymentMode} onChange={e=>setForm({...form,paymentMode:e.target.value})}>{['NEFT','RTGS','IMPS','UPI','CHEQUE','CASH','OTHER'].map(x=><option key={x}>{x}</option>)}</Form.Select></Col>
      <Col md={6}><Form.Label>UTR / Transaction Reference *</Form.Label><Form.Control required maxLength={120} value={form.referenceNo} onChange={e=>setForm({...form,referenceNo:e.target.value})}/></Col>
      <Col md={4}><Form.Label>TDS Financial Year</Form.Label><Form.Control readOnly value={fy}/></Col>
      <Col md={8}><Form.Label>TDS Master Rate</Form.Label><Form.Select value={form.tdsRate} onChange={e=>setForm(p=>({...p,tdsRate:e.target.value}))}><option value="">No TDS</option>{eligibleRates.map(rate=><option key={rate._id} value={rate._id}>{rate.section} — {rate.description} — {rate.rate}%</option>)}</Form.Select></Col>
      {form.tdsRate&&<Col md={4}><Form.Label>Taxable Base excl. GST ₹ *</Form.Label><Form.Control required type="number" min="0.01" step="0.01" max={form.amount} value={form.tdsBaseAmount} onChange={e=>setForm(p=>({...p,tdsBaseAmount:e.target.value}))}/></Col>}
      <Col md={4}><Form.Label>TDS Amount ₹</Form.Label><Form.Control readOnly value={tdsAmount.toFixed(2)}/></Col>
      <Col md={4}><Form.Label>Other Deductions ₹</Form.Label><Form.Control type="number" min="0" step="0.01" value={form.otherDeductions} onChange={e=>setForm(p=>({...p,otherDeductions:e.target.value}))}/></Col>
      <Col md={4}><Form.Label>Net Bank Received ₹</Form.Label><Form.Control readOnly value={netBank.toFixed(2)}/></Col>
      <Col xs={12}><Form.Label>Remarks</Form.Label><Form.Control as="textarea" rows={2} maxLength={1000} value={form.remarks} onChange={e=>setForm({...form,remarks:e.target.value})}/></Col>
      <Col xs={12}><Button type="submit" disabled={busy}>{busy?'Saving...':'Save Advance Receipt'}</Button></Col>
    </Row></Form>}
    <div className="table-responsive"><Table hover size="sm" className="align-middle mb-0"><thead><tr><th>Received Date</th><th>Reference</th><th>Mode</th><th className="text-end">Gross</th><th className="text-end">TDS</th><th className="text-end">Net Bank</th><th className="text-end">Allocated</th><th className="text-end">Available</th><th>Recorded By / At</th></tr></thead><tbody>
      {rows.length===0?<tr><td colSpan={9} className="text-center text-muted py-4">No customer advances recorded for this PO.</td></tr>:rows.map(r=><tr key={r._id}><td>{readableDate(r.receivedDate)}</td><td>{r.referenceNo}</td><td><Badge bg="secondary">{r.paymentMode}</Badge></td><td className="text-end">{currency(r.amount)}</td><td className="text-end">{currency(r.tdsDeductions)}</td><td className="text-end">{currency(r.netAmountReceived)}</td><td className="text-end">{currency(r.allocatedAmount)}</td><td className="text-end fw-semibold">{currency(r.availableAmount)}</td><td>{r.recordedBy?.name||r.recordedBy?.email||'—'}<small className="text-muted d-block">{readableTime(r.recordedAt)}</small></td></tr>)}
    </tbody></Table></div>
  </Card.Body></Card>;
}
