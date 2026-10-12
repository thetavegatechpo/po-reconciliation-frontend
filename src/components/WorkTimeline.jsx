import {useEffect,useState} from 'react';
import {Alert,Badge,Button,Form,Modal,Spinner} from 'react-bootstrap';
import api from '../api/client';
import {date} from '../utils/format';
import {useAuth} from '../context/AuthContext';
const localDate=()=>new Date().toLocaleDateString('en-CA');
export default function WorkTimeline({work,onClose}){
 const [events,setEvents]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[description,setDescription]=useState(''),[eventDate,setEventDate]=useState(localDate()),[next,setNext]=useState('');
 const {can}=useAuth();const write=can('work.followup');
 async function load(){if(!work)return;setBusy(true);try{const r=await api.get(`/work-followups/${work._id}/timeline`);setEvents(r.data.data||[]);setError('');}catch(e){setError(e.response?.data?.message||'Unable to load timeline.');}finally{setBusy(false);}}
 useEffect(()=>{if(work)load();},[work?._id]);
 async function follow(e){e.preventDefault();setBusy(true);try{await api.post(`/work-followups/${work._id}/events`,{description,eventDate,nextFollowUpDate:next||null});setDescription('');setNext('');await load();}catch(e){setError(e.response?.data?.message||'Cannot save follow-up.');}finally{setBusy(false);}}
 return <Modal show={!!work} onHide={onClose} size="lg" centered scrollable><Modal.Header closeButton><Modal.Title>Work Activity Timeline</Modal.Title></Modal.Header><Modal.Body>
 <strong>{work?.title}</strong><div className="text-muted small mb-3">{work?.customer?.name||'Customer'} — event dates and audit details</div>
 {error&&<Alert variant="danger">{error}</Alert>}
 {busy&&<Spinner size="sm" className="me-2"/>}
 <div className="border-start ps-3 ms-2">{events.map((ev,i)=><div key={i} className="mb-3"><div className="d-flex flex-wrap gap-2 align-items-center"><Badge bg="secondary">{String(ev.type).replaceAll('_',' ')}</Badge><strong>{ev.date?date(ev.date):'—'}</strong></div><div className="mt-1">{ev.description}</div>{ev.nextFollowUpDate&&<small className="text-muted">Next follow-up: {date(ev.nextFollowUpDate)}</small>}</div>)}</div>
 {write&&<Form onSubmit={follow} className="border-top pt-3"><h6>Record Customer Follow-up</h6><Form.Label>Follow-up Date</Form.Label><Form.Control type="date" required value={eventDate} onChange={e=>setEventDate(e.target.value)}/><Form.Label className="mt-2">Remarks *</Form.Label><Form.Control as="textarea" required rows={2} value={description} onChange={e=>setDescription(e.target.value)}/><Form.Label className="mt-2">Next Follow-up (Optional)</Form.Label><Form.Control type="date" value={next} onChange={e=>setNext(e.target.value)}/><Button className="mt-3" type="submit" disabled={busy}>Save Follow-up Event</Button></Form>}
 </Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={onClose}>Close</Button></Modal.Footer></Modal>;
}
