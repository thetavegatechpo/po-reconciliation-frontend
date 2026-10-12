import {useEffect,useState} from 'react';
import {Alert,Badge,Button,Card,Col,Form,Modal,Row,Spinner,Table} from 'react-bootstrap';
import {useNavigate} from 'react-router-dom';
import api from '../api/client';
import {money,date} from '../utils/format';
import {useAuth} from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
const empty={taxableAmount:'',gstPercent:18,roundOffAmount:0,paymentTermDays:45,notes:''};
const id=v=>String(v?._id||v||'');
export default function InvoiceDraftsPage(){
 const nav=useNavigate();const {can}=useAuth();const canWrite=can('draft.create');const canInvoice=can('draft.convert');
 const [work,setWork]=useState([]),[drafts,setDrafts]=useState([]),[target,setTarget]=useState(null),[form,setForm]=useState(empty),[saving,setSaving]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 async function load(){setLoading(true);try{const [w,d]=await Promise.all([api.get('/work-followups'),api.get('/invoice-drafts')]);setWork(w.data.data||[]);setDrafts(d.data.data||[]);setError('');}catch(e){setError(e.response?.data?.message||'Cannot load invoice drafts.');}finally{setLoading(false);}}
 useEffect(()=>{load();},[]);
 const byWork=new Map(drafts.map(d=>[id(d.workFollowUp),d]));
 function edit(w){const d=byWork.get(id(w));setTarget(w);setForm(d?{taxableAmount:d.taxableAmount,gstPercent:d.gstPercent,roundOffAmount:d.roundOffAmount,paymentTermDays:d.paymentTermDays,notes:d.notes}:{...empty,taxableAmount:w.expectedValue||''});setError('');}
 const taxable=Number(form.taxableAmount||0),gst=Number(form.gstPercent||0),round=Number(form.roundOffAmount||0);const total=Math.round((taxable+Math.round(taxable*gst)/100+round)*100)/100;
 async function save(e){e.preventDefault();if(!target)return;setSaving(true);setError('');try{await api.post('/invoice-drafts',{workFollowUp:id(target),...form});setTarget(null);await load();}catch(err){setError(err.response?.data?.message||'Unable to save draft.');}finally{setSaving(false);}}
 async function proceed(d){setError('');try{const r=await api.get(`/invoice-drafts/${d._id}/prepare-invoice`);nav('/invoices',{state:{draftPrefill:r.data.data}});}catch(err){setError(err.response?.data?.message||'Cannot register invoice until PO is linked and enough PO balance is available.');}}
 return <>
 <PageHeader title="Pre-Invoice Drafts" subtitle="Prepare draft billing for completed work even when the customer PO is pending. Drafts are not posted to financials." />
 {error&&<Alert variant="danger" dismissible onClose={()=>setError('')}>{error}</Alert>}
 <Card className="border-0 shadow-sm"><Card.Body><p className="small text-muted">Drafts are linked to completed work. Register the actual Tally invoice only after linking a customer PO.</p>
 <div className="table-responsive"><Table hover className="align-middle"><thead><tr><th>Work / Customer</th><th>PO</th><th>Draft Total</th><th>Status</th><th>Action</th></tr></thead><tbody>
 {loading?<tr><td colSpan={5}><Spinner size="sm"/> Loading...</td></tr>:work.length===0?<tr><td colSpan={5}>No completed work yet. Add work in Work Follow-up.</td></tr>:work.map(w=>{const d=byWork.get(id(w));return <tr key={w._id}>
 <td><strong>{w.title}</strong><small className="d-block text-muted">{w.customer?.name} · Completed {date(w.completionDate)}</small></td>
 <td>{w.linkedPO?<><Badge bg="success">Received</Badge><div className="small">{w.linkedPO.poNumber}</div></>:<Badge bg="warning" text="dark">Awaited</Badge>}</td>
 <td>{d?money(d.estimatedTotal):'—'}</td><td>{d?<Badge bg={d.status==='CONVERTED'?'success':'secondary'}>{d.status}</Badge>:'Not prepared'}</td>
 <td className="text-nowrap">{canWrite&&d?.status!=='CONVERTED'&&<Button size="sm" variant="outline-secondary" className="me-2" onClick={()=>edit(w)}>{d?'Edit Draft':'Prepare Draft'}</Button>}{canInvoice&&d?.status==='DRAFT'&&<Button size="sm" disabled={!w.linkedPO} onClick={()=>proceed(d)}>Register Tally Invoice</Button>}{d?.status==='CONVERTED'&&<small>Invoice: {d.convertedInvoice?.invoiceNumber||'Registered'}</small>}</td>
 </tr>})}</tbody></Table></div></Card.Body></Card>
 <Modal show={!!target} onHide={()=>!saving&&setTarget(null)} centered><Form onSubmit={save}><Modal.Header closeButton><Modal.Title>Prepare Pre-Invoice Draft</Modal.Title></Modal.Header><Modal.Body>
 {error&&<Alert variant="danger">{error}</Alert>}<p><strong>{target?.title}</strong><span className="text-muted d-block small">Customer: {target?.customer?.name} · Expected work value: {money(target?.expectedValue)}</span></p>
 <Row className="g-3"><Col md={6}><Form.Label>Taxable Amount *</Form.Label><Form.Control type="number" min="0.01" step="0.01" required value={form.taxableAmount} onChange={e=>setForm(p=>({...p,taxableAmount:e.target.value}))}/></Col>
 <Col md={6}><Form.Label>GST (%) *</Form.Label><Form.Control type="number" min="0" max="100" step="0.01" required value={form.gstPercent} onChange={e=>setForm(p=>({...p,gstPercent:e.target.value}))}/></Col>
 <Col md={6}><Form.Label>Round Off</Form.Label><Form.Control type="number" step="0.01" value={form.roundOffAmount} onChange={e=>setForm(p=>({...p,roundOffAmount:e.target.value}))}/></Col>
 <Col md={6}><Form.Label>Payment Terms (Days)</Form.Label><Form.Control type="number" min="0" step="1" required value={form.paymentTermDays} onChange={e=>setForm(p=>({...p,paymentTermDays:e.target.value}))}/></Col>
 <Col xs={12}><Form.Label>Internal Notes</Form.Label><Form.Control as="textarea" rows={3} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/></Col></Row>
 <Alert variant="info" className="mt-3 mb-0">Estimated invoice total: <strong>{money(total)}</strong>. No actual invoice is created at this stage.</Alert>
 </Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={()=>setTarget(null)}>Cancel</Button><Button type="submit" disabled={saving}>{saving?'Saving...':'Save Draft'}</Button></Modal.Footer></Form></Modal>
 </>;
}
