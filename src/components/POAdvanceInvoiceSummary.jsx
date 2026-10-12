import { useEffect, useState } from 'react';
import { Alert, Card, Spinner } from 'react-bootstrap';
import api from '../api/client';

// Display ONLY. No invoice adjustment takes place until invoice/payment reconciliation is integrated.
export default function POAdvanceInvoiceSummary({ poId }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    setResult(null); setError('');
    if (!poId) return undefined;
    api.get(`/pos/${poId}/advances`)
      .then(response => { if (alive) setResult(response.data.summary || {}); })
      .catch(err => { if (alive) setError(err.response?.data?.message || 'Unable to load PO advance.'); });
    return () => { alive = false; };
  }, [poId]);
  if (!poId) return null;
  return <Card className="mb-3"><Card.Body>
    <h6>Customer Advance for Selected PO</h6>
    {error ? <Alert variant="warning">{error}</Alert> : !result ? <Spinner size="sm" /> : <>
      <div>Advance Received: ₹{Number(result.totalReceived || 0).toLocaleString('en-IN')}</div>
      <div>Advance Allocated: ₹{Number(result.totalAllocated || 0).toLocaleString('en-IN')}</div>
      <strong>Available Advance: ₹{Number(result.availableAdvance || 0).toLocaleString('en-IN')}</strong>
      <div className="small text-muted mt-2">Display only. Do not subtract from invoice due until backend allocation is integrated.</div>
    </>}
  </Card.Body></Card>;
}
