import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import { money, date } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import WorkTimeline from '../components/WorkTimeline';
import { useNavigate } from 'react-router-dom';

const empty = () => ({ customer: '', project: '', title: '', description: '', completionDate: new Date().toLocaleDateString('en-CA'), expectedValue: '', responsiblePerson: '', pendingReason: '', nextFollowUpDate: '', notes: '' });
const id = v => String(v?._id || v || '');
const inputDate = value => value ? new Date(value).toISOString().slice(0, 10) : '';
const number = v => Number(v || 0);
const emptyDraft = { taxableAmount: '', gstPercent: 18, roundOffAmount: 0, paymentTermDays: 45, notes: '' };

export default function WorkFollowUpPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [timelineTarget,setTimelineTarget] = useState(null);
  const canEdit = can('work.create');
  const canUpdateWork = can('work.edit');
  const canLinkPO = can('work.link');
  const canEditDraft = can('draft.edit');
  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [pos, setPos] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(empty());
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [customerFilter, setCustomerFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [draftFilter, setDraftFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [showDraftList, setShowDraftList] = useState(false);
  const [linkTarget, setLinkTarget] = useState(null);
  const [poId, setPoId] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [draftTarget, setDraftTarget] = useState(null);
  const [draftForm, setDraftForm] = useState(emptyDraft);
  const [draftSaving, setDraftSaving] = useState(false);
  const canDraft = can('draft.create');
  const canInvoice = can('draft.convert');

  async function load() {
    setLoading(true);
    try {
      const responses = await Promise.all([
        api.get('/work-followups'),
        api.get('/work-followups/summary'),
        api.get('/masters/customers'),
        api.get('/masters/projects').catch(() => ({ data: { data: [] } })),
        api.get('/pos', { params: { limit: 200 } }),
        api.get('/invoice-drafts')
      ]);
      setRows(responses[0].data.data || []);
      setSummary(responses[1].data.data || {});
      setCustomers(responses[2].data.data || []);
      setProjects(responses[3].data.data || []);
      setPos(responses[4].data.data || []);
      setDrafts(responses[5].data.data || []);
      setError('');
    } catch (e) { setError(e.response?.data?.message || 'Unable to load work follow-ups.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const draftByWork = useMemo(() => new Map(drafts.map(d => [id(d.workFollowUp), d])), [drafts]);
  const draftCount = drafts.filter(d => d.status !== 'CONVERTED' && d.status !== 'CANCELLED').length;
  const visible = useMemo(() => rows.filter(r => {
    if (status === 'PO_PENDING' && r.linkedPO) return false;
    if (status === 'PO_RECEIVED' && !r.linkedPO) return false;
    if (customerFilter && id(r.customer) !== customerFilter) return false;
    if (projectFilter && id(r.project) !== projectFilter) return false;
    if (dateFilter && inputDate(r.completionDate) !== dateFilter) return false;
    const draft = draftByWork.get(id(r));
    if (draftFilter === 'HAS_DRAFT' && !draft) return false;
    if (draftFilter === 'NO_DRAFT' && draft) return false;
    if (draftFilter === 'CONVERTED' && draft?.status !== 'CONVERTED') return false;
    const q = search.toLowerCase().trim();
    return !q || [r.title, r.description, r.customer?.name, r.project?.name, r.pendingReason, r.responsiblePerson, r.linkedPO?.poNumber].some(v => String(v || '').toLowerCase().includes(q));
  }), [rows, search, status, customerFilter, projectFilter, dateFilter, draftFilter, draftByWork]);
  function clearFilters() {
    setSearch(''); setStatus('ALL'); setCustomerFilter('');
    setProjectFilter(''); setDraftFilter('ALL'); setDateFilter('');
  }
  const metricStyle = {border: '1px solid #e7eaf3', borderRadius: 14, boxShadow: '0 4px 16px rgba(25,38,78,.04)', height:'100%'};
  const iconStyle = color => ({ width: 42, height: 42, borderRadius: 12, display:'grid', placeItems:'center', background: color+'15', color, fontSize: 19, flexShrink:0 });
  const actionStyle = {fontSize:12, fontWeight:600, whiteSpace:'nowrap'};
  const projectOptions = projects.filter(p => id(p.customer) === id(form.customer));
  const poOptions = pos.filter(p => id(p.customer) === id(linkTarget?.customer) && p.executionStatus !== 'CANCELLED' && p.overallStatus !== 'CANCELLED' && (!linkTarget?.project || !p.project || id(p.project) === id(linkTarget.project)) && !rows.some(r => id(r.linkedPO) === id(p)));

  function openCreate() { setEdit(null); setForm(empty()); setError(''); setModal(true); }
  function openEdit(r) {
    setEdit(r); setError('');
    setForm({ customer: id(r.customer), project: id(r.project), title: r.title || '', description: r.description || '', completionDate: inputDate(r.completionDate), expectedValue: r.expectedValue ?? '', responsiblePerson: r.responsiblePerson || '', pendingReason: r.pendingReason || '', nextFollowUpDate: inputDate(r.nextFollowUpDate), notes: r.notes || '' });
    setModal(true);
  }
  async function save(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, project: form.project || null, nextFollowUpDate: form.nextFollowUpDate || null, expectedValue: Number(form.expectedValue) };
      if (edit) await api.put(`/work-followups/${edit._id}`, payload);
      else await api.post('/work-followups', payload);
      setModal(false); await load();
    } catch (e) { setError(e.response?.data?.message || 'Could not save this work record.'); }
    finally { setSaving(false); }
  }
  async function linkPO() {
    if (!poId || !linkTarget) return;
    setSaving(true); setError('');
    try { await api.post(`/work-followups/${linkTarget._id}/link-po`, { poId }); setLinkTarget(null); setPoId(''); await load(); }
    catch (e) { setError(e.response?.data?.message || 'Unable to link PO.'); }
    finally { setSaving(false); }
  }

  const draftTaxable = Number(draftForm.taxableAmount || 0);
  const draftGST = Number(draftForm.gstPercent || 0);
  const draftRound = Number(draftForm.roundOffAmount || 0);
  const draftTotal = Math.round((draftTaxable + Math.round(draftTaxable * draftGST) / 100 + draftRound) * 100) / 100;

  function openDraft(work) {
    const current = draftByWork.get(id(work));
    if (current?.status === 'CONVERTED') return;
    setDraftTarget(work);
    setError('');
    setDraftForm(current ? {
      taxableAmount: current.taxableAmount,
      gstPercent: current.gstPercent,
      roundOffAmount: current.roundOffAmount,
      paymentTermDays: current.paymentTermDays,
      notes: current.notes || ''
    } : { ...emptyDraft, taxableAmount: work.expectedValue || '' });
  }

  async function saveDraft(event) {
    event.preventDefault();
    if (!draftTarget) return;
    setDraftSaving(true);
    setError('');
    try {
      await api.post('/invoice-drafts', { workFollowUp: id(draftTarget), ...draftForm });
      setDraftTarget(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to save invoice draft.');
    } finally {
      setDraftSaving(false);
    }
  }

  async function registerDraftInvoice(draft) {
    setError('');
    try {
      const response = await api.get(`/invoice-drafts/${draft._id}/prepare-invoice`);
      navigate('/invoices', { state: { draftPrefill: response.data.data } });
    } catch (e) {
      setError(e.response?.data?.message || 'Cannot register invoice: check linked PO and available uninvoiced balance.');
    }
  }

  return <>
    <PageHeader
      title="Work Tracking & Commercial Follow-up"
      subtitle="Track completed work, pending customer POs, invoice drafts and billing readiness in one place."
      actions={canEdit ? <Button className="primary-btn" onClick={openCreate}><i className="bi bi-plus-lg me-2"/>Add Completed Work</Button> : null}
    />
    {error && !modal && !linkTarget && !draftTarget && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

    <Row className="g-3 mb-3 tv-kpi-row">
      <Col sm={6} xl={3}>
        <Card style={metricStyle}><Card.Body className="d-flex align-items-start gap-3 p-3">
          <div style={iconStyle('#2878d6')}><i className="bi bi-clipboard-check"/></div>
          <div><div className="small text-muted">Completed Work – PO Pending</div><h4 className="my-2 fw-bold">{money(summary.poPendingExpectedValue)}</h4><small className="text-muted">{summary.poPendingCount || 0} work records · Estimated only</small></div>
        </Card.Body></Card>
      </Col>
      <Col sm={6} xl={3}>
        <Card style={metricStyle}><Card.Body className="d-flex align-items-start gap-3 p-3">
          <div style={iconStyle('#168e66')}><i className="bi bi-link-45deg"/></div>
          <div><div className="small text-muted">Work Records Linked to PO</div><h4 className="my-2 fw-bold">{summary.poReceivedCount || 0}</h4><small className="text-muted">Customer POs linked</small></div>
        </Card.Body></Card>
      </Col>
      <Col sm={6} xl={3}>
        <Card style={metricStyle}><Card.Body className="d-flex align-items-start gap-3 p-3">
          <div style={iconStyle('#d87818')}><i className="bi bi-currency-rupee"/></div>
          <div><div className="small text-muted">Linked PO Yet to Invoice</div><h4 className="my-2 fw-bold">{money(summary.poReceivedInvoicePendingValue)}</h4><small className="text-muted">Existing PO financial balance</small></div>
        </Card.Body></Card>
      </Col>
      <Col sm={6} xl={3}>
        <Card style={metricStyle}><Card.Body className="d-flex align-items-start gap-3 p-3">
          <div style={iconStyle('#6654d8')}><i className="bi bi-file-earmark-text"/></div>
          <div><div className="small text-muted">Pre-Invoice Drafts</div><h4 className="my-2 fw-bold">{draftCount}</h4>
            <Button size="sm" variant="link" className="p-0 text-decoration-none" onClick={()=>setShowDraftList(true)}>View saved drafts <i className="bi bi-arrow-right"/></Button>
          </div>
        </Card.Body></Card>
      </Col>
    </Row>

    <Card className="border-0 shadow-sm mb-3"><Card.Body className="p-3">
      <Row className="g-2 align-items-end">
        <Col lg={5} md={6}><Form.Label className="small text-muted">Search work records</Form.Label><Form.Control placeholder="Search work, customer, PO, owner or pending reason..." value={search} onChange={e=>setSearch(e.target.value)}/></Col>
        <Col lg={3} md={3}><Form.Label className="small text-muted">PO Status</Form.Label><Form.Select value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">All Work</option><option value="PO_PENDING">Customer PO Pending</option><option value="PO_RECEIVED">Customer PO Received</option></Form.Select></Col>
        <Col lg={2} md={3}><Form.Label className="small text-muted">Completion Date</Form.Label><Form.Control type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/></Col>
        <Col lg={2}><Button className="w-100" variant="outline-secondary" onClick={clearFilters}><i className="bi bi-arrow-counterclockwise me-1"/>Clear Filters</Button></Col>
        <Col lg={4} md={6}><Form.Label className="small text-muted">Customer</Form.Label><Form.Select value={customerFilter} onChange={e=>{setCustomerFilter(e.target.value);setProjectFilter('');}}><option value="">All Customers</option>{customers.map(c=><option key={c._id} value={id(c)}>{c.name}</option>)}</Form.Select></Col>
        <Col lg={4} md={6}><Form.Label className="small text-muted">Project</Form.Label><Form.Select value={projectFilter} onChange={e=>setProjectFilter(e.target.value)}><option value="">All Projects</option>{projects.filter(p=>!customerFilter||id(p.customer)===customerFilter).map(p=><option key={p._id} value={id(p)}>{p.name}</option>)}</Form.Select></Col>
        <Col lg={4} md={6}><Form.Label className="small text-muted">Invoice Draft Status</Form.Label><Form.Select value={draftFilter} onChange={e=>setDraftFilter(e.target.value)}><option value="ALL">All Draft Statuses</option><option value="HAS_DRAFT">Draft Prepared</option><option value="NO_DRAFT">Not Prepared</option><option value="CONVERTED">Converted to Invoice</option></Form.Select></Col>
      </Row>
    </Card.Body></Card>

    <Card className="border-0 shadow-sm"><Card.Body className="p-0">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 px-3 py-3 border-bottom">
        <div><strong>Completed Work Records</strong><div className="small text-muted">Draft and PO activity for each work item</div></div>
        <div className="d-flex flex-wrap gap-2 align-items-center"><span className="small text-muted">{visible.length} record(s)</span><Button variant="outline-primary" size="sm" onClick={()=>setShowDraftList(true)}><i className="bi bi-files me-1"/>View All Drafts ({drafts.length})</Button></div>
      </div>
      <div className="table-responsive">
        <Table hover className="align-middle mb-0" style={{fontSize:13,minWidth:1180}}>
          <thead className="table-light"><tr>
            <th className="ps-3">Customer / Work</th><th>Completed</th><th className="text-end">Expected Value</th><th>PO Status</th><th>Invoice Draft</th><th>Follow-up</th><th>Owner</th><th style={{minWidth:230}}>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="text-center py-5"><Spinner size="sm" className="me-2"/>Loading work records...</td></tr>
             : visible.length===0 ? <tr><td colSpan={8} className="text-center py-5 text-muted">No work records match the selected filters.</td></tr>
             : visible.map(r=>{
                const draft = draftByWork.get(id(r));
                return <tr key={r._id}>
                  <td className="ps-3" style={{minWidth:230,maxWidth:330}}>
                    <div className="fw-semibold">{r.title}</div><div className="small text-muted">{r.customer?.name||'—'}{r.project?.name?` · ${r.project.name}`:''}</div>
                    {r.description && <div className="small text-muted text-truncate" title={r.description} style={{maxWidth:300}}>{r.description}</div>}
                  </td>
                  <td className="text-nowrap">{date(r.completionDate)}</td>
                  <td className="text-end text-nowrap fw-semibold">{money(r.expectedValue)}</td>
                  <td style={{minWidth:145}}>{r.linkedPO ? <><Badge bg="success">PO Received</Badge><div className="small mt-1">{r.linkedPO.poNumber}</div><small className="text-muted">{money(r.linkedPO.totalPOAmount)}</small></> : <><Badge bg="warning" text="dark">PO Awaited</Badge><div className="small text-muted mt-1" style={{maxWidth:180}}>{r.pendingReason||'Awaiting customer PO'}</div></>}</td>
                  <td style={{minWidth:145}}>{draft ? <><Badge bg={draft.status==='CONVERTED'?'success':'secondary'}>{draft.status==='CONVERTED'?'Invoiced':'Draft Saved'}</Badge><div className="fw-semibold mt-1">{money(draft.estimatedTotal)}</div><small className="text-muted">GST {Number(draft.gstPercent||0)}%</small></> : <span className="text-muted">Not prepared</span>}</td>
                  <td className="text-nowrap">{!r.linkedPO && r.nextFollowUpDate ? date(r.nextFollowUpDate) : r.linkedPO?'PO linked':'Not scheduled'}<div><Button variant="link" size="sm" className="px-0 py-0 text-decoration-none" onClick={()=>setTimelineTarget(r)}>View timeline</Button></div></td>
                  <td>{r.responsiblePerson||'—'}</td>
                  <td><div className="d-flex flex-wrap gap-1" style={{maxWidth:270}}>
                    {canUpdateWork && <Button size="sm" variant="outline-secondary" style={actionStyle} onClick={()=>openEdit(r)}><i className="bi bi-pencil-square me-1"/>Edit</Button>}
                    {(draft ? canEditDraft : canDraft) && draft?.status!=='CONVERTED' && <Button size="sm" variant="outline-primary" style={actionStyle} onClick={()=>openDraft(r)}><i className="bi bi-file-earmark-text me-1"/>{draft?'Edit Draft':'Prepare Draft'}</Button>}
                    {canInvoice && draft?.status==='DRAFT' && r.linkedPO && <Button size="sm" style={actionStyle} onClick={()=>registerDraftInvoice(draft)}><i className="bi bi-receipt me-1"/>Register Invoice</Button>}
                    <Button size="sm" variant="outline-secondary" style={actionStyle} onClick={()=>setTimelineTarget(r)}><i className="bi bi-clock-history me-1"/>Timeline</Button>
                    {canLinkPO && !r.linkedPO && <Button size="sm" variant="outline-primary" style={actionStyle} onClick={()=>{setLinkTarget(r);setPoId('');setError('');}}><i className="bi bi-link-45deg me-1"/>Link PO</Button>}
                    {draft?.status==='CONVERTED' && <small className="text-success align-self-center">Invoice registered</small>}
                  </div></td>
                </tr>;
              })}
          </tbody>
        </Table>
      </div>
    </Card.Body></Card>

    <Modal show={showDraftList} onHide={()=>setShowDraftList(false)} size="xl" centered scrollable>
      <Modal.Header closeButton><Modal.Title>Saved Pre-Invoice Draft Records</Modal.Title></Modal.Header>
      <Modal.Body>
        <p className="text-muted small">All saved drafts are shown here, including work with a PO already linked. These records are separate from approved Tally invoices.</p>
        <div className="table-responsive"><Table hover className="align-middle" style={{minWidth:750}}><thead className="table-light"><tr><th>Work / Customer</th><th>Customer PO</th><th>Taxable</th><th>Draft Total</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {drafts.length===0?<tr><td colSpan={6} className="text-center text-muted py-4">No invoice drafts have been saved yet.</td></tr>:
            drafts.map(d=>{
              const work = rows.find(w=>id(w)===id(d.workFollowUp));
              const linkedPO = work?.linkedPO;
              return <tr key={d._id}>
                <td><strong>{work?.title||d.workFollowUp?.title||'Work record'}</strong><small className="d-block text-muted">{work?.customer?.name||d.customer?.name||'—'}</small></td>
                <td>{linkedPO?.poNumber||<Badge bg="warning" text="dark">Awaited</Badge>}</td>
                <td>{money(d.taxableAmount)}</td><td className="fw-semibold">{money(d.estimatedTotal)}</td>
                <td><Badge bg={d.status==='CONVERTED'?'success':'secondary'}>{d.status}</Badge></td>
                <td className="text-nowrap">{work && canEditDraft && d.status!=='CONVERTED' && <Button variant="outline-primary" size="sm" className="me-1" onClick={()=>{setShowDraftList(false);openDraft(work);}}>Edit</Button>}
                  {work && linkedPO && canInvoice && d.status==='DRAFT' && <Button size="sm" onClick={()=>{setShowDraftList(false);registerDraftInvoice(d);}}>Register Invoice</Button>}
                  {d.status==='CONVERTED' && <small className="text-success">{d.convertedInvoice?.invoiceNumber||'Registered'}</small>}
                </td>
              </tr>;
            })}
        </tbody></Table></div>
      </Modal.Body>
      <Modal.Footer><Button variant="outline-secondary" onClick={()=>setShowDraftList(false)}>Close</Button></Modal.Footer>
    </Modal>

    <WorkTimeline work={timelineTarget} onClose={()=>{setTimelineTarget(null);load();}} />
    <Modal show={modal} onHide={() => !saving && setModal(false)} centered size="lg" backdrop="static"><Form onSubmit={save}><Modal.Header closeButton><Modal.Title>{edit ? 'Edit Completed Work' : 'Register Completed Work'}</Modal.Title></Modal.Header><Modal.Body>
      {error && <Alert variant="danger">{error}</Alert>}
      <Row className="g-3">
        <Col md={6}><Form.Label>Customer *</Form.Label><Form.Select required disabled={!!edit?.linkedPO} value={form.customer} onChange={e => setForm(p => ({ ...p, customer: e.target.value, project: '' }))}><option value="">Select Customer</option>{customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</Form.Select></Col>
        <Col md={6}><Form.Label>Project (Optional)</Form.Label><Form.Select value={form.project} onChange={e => setForm(p => ({ ...p, project: e.target.value }))}><option value="">No project selected</option>{projectOptions.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</Form.Select></Col>
        <Col md={12}><Form.Label>Work Title *</Form.Label><Form.Control required maxLength={180} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></Col>
        <Col md={12}><Form.Label>Work Description</Form.Label><Form.Control as="textarea" rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></Col>
        <Col md={6}><Form.Label>Work Completion Date *</Form.Label><Form.Control type="date" required value={form.completionDate} onChange={e => setForm(p => ({ ...p, completionDate: e.target.value }))} /></Col>
        <Col md={6}><Form.Label>Expected Work Value (₹) *</Form.Label><Form.Control type="number" min="0" step="0.01" required value={form.expectedValue} onChange={e => setForm(p => ({ ...p, expectedValue: e.target.value }))} /></Col>
        <Col md={6}><Form.Label>Responsible Person</Form.Label><Form.Control value={form.responsiblePerson} onChange={e => setForm(p => ({ ...p, responsiblePerson: e.target.value }))} /></Col>
        <Col md={6}><Form.Label>Next PO Follow-up Date</Form.Label><Form.Control type="date" value={form.nextFollowUpDate} onChange={e => setForm(p => ({ ...p, nextFollowUpDate: e.target.value }))} /></Col>
        <Col md={12}><Form.Label>Why Is the Customer PO Pending?</Form.Label><Form.Control as="textarea" rows={2} value={form.pendingReason} onChange={e => setForm(p => ({ ...p, pendingReason: e.target.value }))} /></Col>
        <Col md={12}><Form.Label>Remarks / Follow-up Notes</Form.Label><Form.Control as="textarea" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></Col>
      </Row>
      {edit?.linkedPO && <Alert variant="info" className="mt-3 mb-0">PO already linked: {edit.linkedPO.poNumber}. Linking cannot be changed from this screen.</Alert>}
    </Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setModal(false)} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Work'}</Button></Modal.Footer></Form></Modal>

    <Modal show={!!linkTarget} onHide={() => !saving && setLinkTarget(null)} centered><Modal.Header closeButton><Modal.Title>Link Customer PO</Modal.Title></Modal.Header><Modal.Body>
      {error && <Alert variant="danger">{error}</Alert>}
      <p className="small text-muted">Link an already registered PO to <strong>{linkTarget?.title}</strong>. Only POs belonging to this customer are shown.</p>
      <Form.Label>Select Customer PO</Form.Label><Form.Select value={poId} onChange={e => setPoId(e.target.value)}><option value="">Select PO</option>{poOptions.map(p => <option key={p._id} value={p._id}>{p.poNumber} — {money(p.totalPOAmount)}</option>)}</Form.Select>
      {!poOptions.length && <small className="d-block text-muted mt-2">No eligible PO found. Register the customer PO in PO Management first.</small>}
    </Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setLinkTarget(null)}>Cancel</Button><Button disabled={!poId || saving} onClick={linkPO}>Confirm PO Link</Button></Modal.Footer></Modal>

    <Modal show={!!draftTarget} onHide={() => !draftSaving && setDraftTarget(null)} centered backdrop="static">
      <Form onSubmit={saveDraft}>
        <Modal.Header closeButton><Modal.Title>{draftByWork.has(id(draftTarget)) ? 'Edit Pre-Invoice Draft' : 'Prepare Pre-Invoice Draft'}</Modal.Title></Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <p><strong>{draftTarget?.title}</strong><span className="text-muted d-block small">Customer: {draftTarget?.customer?.name} · Expected work value: {money(draftTarget?.expectedValue)}</span></p>
          <Row className="g-3">
            <Col md={6}><Form.Label>Taxable Amount *</Form.Label><Form.Control type="number" min="0.01" step="0.01" required value={draftForm.taxableAmount} onChange={e => setDraftForm(p => ({ ...p, taxableAmount: e.target.value }))} /></Col>
            <Col md={6}><Form.Label>GST (%) *</Form.Label><Form.Control type="number" min="0" max="100" step="0.01" required value={draftForm.gstPercent} onChange={e => setDraftForm(p => ({ ...p, gstPercent: e.target.value }))} /></Col>
            <Col md={6}><Form.Label>Round Off</Form.Label><Form.Control type="number" step="0.01" value={draftForm.roundOffAmount} onChange={e => setDraftForm(p => ({ ...p, roundOffAmount: e.target.value }))} /></Col>
            <Col md={6}><Form.Label>Payment Terms (Days)</Form.Label><Form.Control type="number" min="0" step="1" required value={draftForm.paymentTermDays} onChange={e => setDraftForm(p => ({ ...p, paymentTermDays: e.target.value }))} /></Col>
            <Col xs={12}><Form.Label>Internal Notes</Form.Label><Form.Control as="textarea" rows={3} value={draftForm.notes} onChange={e => setDraftForm(p => ({ ...p, notes: e.target.value }))} /></Col>
          </Row>
          <Alert variant="info" className="mt-3 mb-0">Estimated invoice total: <strong>{money(draftTotal)}</strong>.<div className="small mt-1">Draft only — no actual Tally invoice or financial outstanding is created.</div></Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" disabled={draftSaving} onClick={() => setDraftTarget(null)}>Cancel</Button>
          <Button type="submit" disabled={draftSaving}>{draftSaving ? 'Saving...' : 'Save Draft'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  </>;
}
