import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Table } from 'react-bootstrap';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';

const empty = { name: '', customer: '', location: '', budget: 0, projectDocumentNo: '', application: '', description: '', isActive: true };
const id = (v) => typeof v === 'object' && v !== null ? v._id : v;
const errorText = (e) => e.response?.data?.errors?.map(x => x.message).join(' ') || e.response?.data?.message || 'Request failed.';
const currency = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function ProjectMasterPage({ embedded = false }) {
  const { can } = useAuth();
  const allowed = can('project.edit');
  const admin = can('project.status');
  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  async function load() {
    try {
      setLoading(true);
      const [p, c] = await Promise.all([api.get('/masters/projects'), api.get('/masters/customers')]);
      setRows(p.data.data || []);
      setCustomers(c.data.data || []);
    } catch (e) { setError(errorText(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => rows.filter(p =>
    [p.code, p.name, p.customer?.name, p.location, p.application].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase())
  ), [rows, search]);
  const start = (p = null) => {
    setError(''); setEditing(p?._id || null);
    setForm(p ? { ...empty, ...p, customer: id(p.customer) || '', budget: p.budget ?? 0 } : { ...empty });
    setShow(true);
  };
  const save = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, budget: Number(form.budget) };
      if (editing) await api.put(`/masters/projects/${editing}`, payload);
      else await api.post('/masters/projects', payload);
      setShow(false); setEditing(null); await load();
    } catch (e) { setError(errorText(e)); }
    finally { setSaving(false); }
  };
  const toggle = async (p) => {
    try { setError(''); await api.patch(`/masters/projects/${p._id}/status`, { isActive: !p.isActive }); await load(); }
    catch (e) { setError(errorText(e)); }
  };

  return <>
    {!embedded && <PageHeader title="Project Master" subtitle="Maintain customer-wise projects and project references." />}
    {error && !show && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
    <Card className="table-card border-0 shadow-sm">
      <Card.Header className="bg-white border-0 py-3">
        <Row className="align-items-center g-2">
          <Col><h6 className="mb-1 fw-semibold">Project Master</h6><small className="text-muted">Manage customer-linked projects, budget and application details.</small></Col>
          <Col xs={12} md="auto"><Form.Control size="sm" style={{ minWidth: 230 }} placeholder="Search project..." value={search} onChange={e => setSearch(e.target.value)} /></Col>
          {allowed && <Col xs="auto"><Button size="sm" className="primary-btn" onClick={() => start()}>+ Add Project</Button></Col>}
        </Row>
      </Card.Header>
      <div className="table-responsive"><Table className="business-table mb-0 align-middle">
        <thead><tr><th>Code</th><th>Project</th><th>Customer</th><th>Location</th><th>Budget</th><th>Application</th><th>Status</th><th className="text-end">Action</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={8} className="text-center py-4 text-muted">Loading projects...</td></tr> : filtered.length === 0 ? <tr><td colSpan={8} className="text-center py-4 text-muted">No projects found.</td></tr> : filtered.map(p => <tr key={p._id}>
          <td className="fw-semibold">{p.code || '—'}</td><td><div className="fw-semibold">{p.name}</div><small className="text-muted">{p.projectDocumentNo || ''}</small></td>
          <td>{p.customer?.name || customers.find(c => c._id === id(p.customer))?.name || '—'}</td><td>{p.location || '—'}</td><td>{currency(p.budget)}</td><td>{p.application || '—'}</td>
          <td><Badge bg={p.isActive ? 'success' : 'secondary'} className="fw-normal">{p.isActive ? 'Active' : 'Inactive'}</Badge></td>
          <td className="text-end">{allowed && <Button size="sm" variant="outline-primary" className="me-2" onClick={() => start(p)}>Edit</Button>}{admin && <Button size="sm" variant={p.isActive ? 'outline-danger' : 'outline-success'} onClick={() => toggle(p)}>{p.isActive ? 'Deactivate' : 'Activate'}</Button>}</td>
        </tr>)}</tbody>
      </Table></div>
    </Card>
    <Modal show={show} onHide={() => !saving && setShow(false)} centered size="lg" backdrop="static">
      <Form onSubmit={save}><Modal.Header closeButton><Modal.Title>{editing ? 'Edit Project' : 'Add Project'}</Modal.Title></Modal.Header>
        <Modal.Body>{error && <Alert variant="danger">{error}</Alert>}
          <h6 className="fw-semibold mb-3">Project Information</h6><Row className="g-3">
            <Col md={8}><Form.Label>Project Name *</Form.Label><Form.Control required maxLength={200} value={form.name} onChange={e => set('name', e.target.value)} /></Col>
            <Col md={4}><Form.Label>Project Code</Form.Label><Form.Control readOnly value={editing ? form.code || '' : 'Auto-generated on Save'} /></Col>
            <Col md={6}><Form.Label>Customer *</Form.Label><Form.Select required value={form.customer} onChange={e => set('customer', e.target.value)}><option value="">Select Customer</option>{customers.filter(c => c.isActive || c._id === form.customer).map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</Form.Select></Col>
            <Col md={6}><Form.Label>Location</Form.Label><Form.Control value={form.location} onChange={e => set('location', e.target.value)} /></Col>
            <Col md={6}><Form.Label>Budget (₹)</Form.Label><Form.Control type="number" min="0" step="0.01" value={form.budget} onChange={e => set('budget', e.target.value)} /></Col>
            <Col md={6}><Form.Label>Project Document No.</Form.Label><Form.Control value={form.projectDocumentNo} onChange={e => set('projectDocumentNo', e.target.value)} /></Col>
            <Col md={12}><Form.Label>Application</Form.Label><Form.Control value={form.application} onChange={e => set('application', e.target.value)} /></Col>
            <Col md={12}><Form.Label>Project Description</Form.Label><Form.Control as="textarea" rows={3} value={form.description} onChange={e => set('description', e.target.value)} /></Col>
            <Col md={12}><Form.Check type="switch" id="project-active" label="Project Active" checked={Boolean(form.isActive)} onChange={e => set('isActive', e.target.checked)} /></Col>
          </Row>
        </Modal.Body><Modal.Footer><Button variant="light" disabled={saving} onClick={() => setShow(false)}>Cancel</Button><Button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update Project' : 'Save Project'}</Button></Modal.Footer>
      </Form>
    </Modal>
  </>;
}
