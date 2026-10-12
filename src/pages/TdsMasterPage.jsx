import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Table } from 'react-bootstrap';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';

const empty = { financialYear: '2026-27', section: '', description: '', deducteeType: 'ALL', rate: 0, threshold: 0, effectiveFrom: '', effectiveTo: '', notes: '', isActive: true };
const dateInput = (v) => v ? String(v).slice(0, 10) : '';
const errorText = (e) => e.response?.data?.errors?.map(x => x.message).join(' ') || e.response?.data?.message || 'Request failed.';
const currency = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function TdsMasterPage({ embedded = false }) {
  const { can } = useAuth();
  const allowed = can('tds.edit');
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  async function load() {
    try { setLoading(true); const res = await api.get('/masters/tds-rates'); setRows(res.data.data || []); }
    catch (e) { setError(errorText(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  const years = useMemo(() => [...new Set(rows.map(r => r.financialYear))].sort().reverse(), [rows]);
  const filtered = useMemo(() => rows.filter(r => (!year || r.financialYear === year) &&
    [r.section, r.description, r.deducteeType].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase())), [rows, year, search]);
  const start = (r = null) => {
    setError(''); setEditing(r?._id || null);
    setForm(r ? { ...empty, ...r, effectiveFrom: dateInput(r.effectiveFrom), effectiveTo: dateInput(r.effectiveTo) } : { ...empty, financialYear: year || empty.financialYear });
    setShow(true);
  };
  const save = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, rate: Number(form.rate), threshold: Number(form.threshold), effectiveFrom: form.effectiveFrom || null, effectiveTo: form.effectiveTo || null };
      if (editing) await api.put(`/masters/tds-rates/${editing}`, payload);
      else await api.post('/masters/tds-rates', payload);
      setShow(false); setEditing(null); await load();
    } catch (e) { setError(errorText(e)); }
    finally { setSaving(false); }
  };
  const toggle = async (r) => {
    try { setError(''); await api.patch(`/masters/tds-rates/${r._id}/status`, { isActive: !r.isActive }); await load(); }
    catch (e) { setError(errorText(e)); }
  };

  return <>
    {!embedded && <PageHeader title="TDS Rate Master" subtitle="Maintain financial-year-wise TDS sections, rates and effective dates." />}
    {error && !show && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
    <Card className="table-card border-0 shadow-sm">
      <Card.Header className="bg-white border-0 py-3"><Row className="align-items-center g-2">
        <Col><h6 className="mb-1 fw-semibold">TDS Rate Master</h6><small className="text-muted">Rates are maintained by your finance team for each financial year.</small></Col>
        <Col xs={12} md="auto"><Form.Select size="sm" value={year} onChange={e => setYear(e.target.value)}><option value="">All Financial Years</option>{years.map(y => <option key={y} value={y}>{y}</option>)}</Form.Select></Col>
        <Col xs={12} md="auto"><Form.Control size="sm" style={{ minWidth: 180 }} placeholder="Search section..." value={search} onChange={e => setSearch(e.target.value)} /></Col>
        {allowed && <Col xs="auto"><Button size="sm" className="primary-btn" onClick={() => start()}>+ Add TDS Rate</Button></Col>}
      </Row></Card.Header>
      <div className="table-responsive"><Table className="business-table mb-0 align-middle">
        <thead><tr><th>Financial Year</th><th>Section</th><th>Description</th><th>Deductee</th><th>Rate</th><th>Threshold</th><th>Effective Dates</th><th>Status</th><th className="text-end">Action</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={9} className="text-center py-4 text-muted">Loading TDS rates...</td></tr> : filtered.length === 0 ? <tr><td colSpan={9} className="text-center py-4 text-muted">No TDS rates found.</td></tr> : filtered.map(r => <tr key={r._id}>
          <td className="fw-semibold">{r.financialYear}</td><td>{r.section}</td><td>{r.description}</td><td>{r.deducteeType}</td><td className="fw-semibold">{r.rate}%</td><td>{currency(r.threshold)}</td><td><small>{dateInput(r.effectiveFrom) || '—'} to {dateInput(r.effectiveTo) || '—'}</small></td>
          <td><Badge bg={r.isActive ? 'success' : 'secondary'} className="fw-normal">{r.isActive ? 'Active' : 'Inactive'}</Badge></td>
          <td className="text-end">{allowed && <><Button size="sm" variant="outline-primary" className="me-2" onClick={() => start(r)}>Edit</Button><Button size="sm" variant={r.isActive ? 'outline-danger' : 'outline-success'} onClick={() => toggle(r)}>{r.isActive ? 'Deactivate' : 'Activate'}</Button></>}</td>
        </tr>)}</tbody>
      </Table></div>
    </Card>
    <Modal show={show} onHide={() => !saving && setShow(false)} centered size="lg" backdrop="static">
      <Form onSubmit={save}><Modal.Header closeButton><Modal.Title>{editing ? 'Edit TDS Rate' : 'Add TDS Rate'}</Modal.Title></Modal.Header>
        <Modal.Body>{error && <Alert variant="danger">{error}</Alert>}
          <h6 className="fw-semibold mb-3">TDS Section & Rate</h6><Row className="g-3">
            <Col md={4}><Form.Label>Financial Year *</Form.Label><Form.Control required placeholder="2026-27" pattern="[0-9]{4}-[0-9]{2}" value={form.financialYear} onChange={e => set('financialYear', e.target.value)} /></Col>
            <Col md={4}><Form.Label>TDS Section *</Form.Label><Form.Control required value={form.section} onChange={e => set('section', e.target.value)} /></Col>
            <Col md={4}><Form.Label>Deductee Type *</Form.Label><Form.Select value={form.deducteeType} onChange={e => set('deducteeType', e.target.value)}>{['ALL', 'COMPANY', 'FIRM', 'INDIVIDUAL_HUF', 'OTHER'].map(v => <option key={v} value={v}>{v}</option>)}</Form.Select></Col>
            <Col md={12}><Form.Label>Description *</Form.Label><Form.Control required value={form.description} onChange={e => set('description', e.target.value)} /></Col>
            <Col md={6}><Form.Label>TDS Rate (%) *</Form.Label><Form.Control required type="number" min="0" max="100" step="0.01" value={form.rate} onChange={e => set('rate', e.target.value)} /></Col>
            <Col md={6}><Form.Label>Threshold (₹)</Form.Label><Form.Control type="number" min="0" step="0.01" value={form.threshold} onChange={e => set('threshold', e.target.value)} /></Col>
            <Col md={6}><Form.Label>Effective From</Form.Label><Form.Control type="date" value={form.effectiveFrom} onChange={e => set('effectiveFrom', e.target.value)} /></Col>
            <Col md={6}><Form.Label>Effective To</Form.Label><Form.Control type="date" min={form.effectiveFrom || undefined} value={form.effectiveTo} onChange={e => set('effectiveTo', e.target.value)} /></Col>
            <Col md={12}><Form.Label>Notes</Form.Label><Form.Control as="textarea" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></Col>
            <Col md={12}><Form.Check type="switch" id="tds-active" label="TDS Rate Active" checked={Boolean(form.isActive)} onChange={e => set('isActive', e.target.checked)} /></Col>
          </Row><div className="small text-muted mt-3">Enter verified statutory rates. Payment TDS calculation integration is separate.</div>
        </Modal.Body><Modal.Footer><Button variant="light" disabled={saving} onClick={() => setShow(false)}>Cancel</Button><Button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update TDS Rate' : 'Save TDS Rate'}</Button></Modal.Footer>
      </Form>
    </Modal>
  </>;
}
