import { useEffect, useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import { Alert, Badge, Card, Col, Form, Modal, Row, Spinner, Button } from 'react-bootstrap';

import { motion } from 'framer-motion';

import {

  ResponsiveContainer, AreaChart, Area, BarChart, Bar, CartesianGrid,

  Tooltip, XAxis, YAxis, Legend, Cell, ReferenceLine

} from 'recharts';

import api from '../api/client';

import { money } from '../utils/format';

import KpiCard from '../components/KpiCard';

import PageHeader from '../components/PageHeader';



const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const asNumber = v => Number.isFinite(Number(v)) ? Number(v) : 0;

const compact = value => {

  const v = asNumber(value), a = Math.abs(v);

  if (a >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;

  if (a >= 100000) return `₹${(v / 100000).toFixed(1)}L`;

  if (a >= 1000) return `₹${(v / 1000).toFixed(1)}K`;

  return `₹${Math.round(v)}`;

};

const showDate = value => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : 'Not provided';

const definitions = [

  { key: 'poOverdue', title: 'Overdue PO completion', icon: 'bi-exclamation-triangle', color: 'danger', kind: 'po' },

  { key: 'invoiceOverdue', title: 'Overdue invoice payments', icon: 'bi-clock-history', color: 'danger', kind: 'invoice' },

  { key: 'poDue', title: 'PO completion due in 7 days', icon: 'bi-calendar-event', color: 'warning', kind: 'po' },

  { key: 'invoiceDue', title: 'Invoice payments due in 7 days', icon: 'bi-receipt', color: 'warning', kind: 'invoice' },

  { key: 'completedWorkPOAwaited', title: 'Completed work – customer PO awaited', icon: 'bi-clipboard-x', color: 'warning', kind: 'work' },

  { key: 'completedNoInvoice', title: 'Completed POs pending invoice', icon: 'bi-file-earmark-text', color: 'info', kind: 'po' }

];

const chartTooltip = ({ active, payload, label }) => {

  if (!active || !payload?.length) return null;

  return <div className="tv-chart-tooltip"><strong>{label}</strong>{payload.map((x, i) => <div key={i} style={{ color: x.color || x.stroke }}>{x.name}: <b>{money(x.value)}</b></div>)}</div>;

};



export default function DashboardPage() {

  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear);

  const [data, setData] = useState(null);

  const [workSummary, setWorkSummary] = useState(null);

  const [alerts, setAlerts] = useState({});

  const [error, setError] = useState('');

  const [alertError, setAlertError] = useState('');

  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState(null);

  const [chartMode, setChartMode] = useState('movement');
  const [alertFilter, setAlertFilter] = useState('all');



  useEffect(() => {

    let live = true;

    async function load() {

      setLoading(true); setError(''); setAlertError('');

      const results = await Promise.allSettled([

        api.get('/dashboard', { params: { year } }),

        api.get('/alerts', { params: { days: 7 } }),

        api.get('/work-followups/summary')

      ]);

      if (!live) return;

      if (results[0].status === 'fulfilled') setData(results[0].value.data.data);

      else { setData(null); setError(results[0].reason?.response?.data?.message || 'Unable to load financial dashboard.'); }

      if (results[1].status === 'fulfilled') setAlerts(results[1].value.data.data || {});

      else { setAlerts({}); setAlertError('Alerts could not be loaded.'); }

      setWorkSummary(results[2]?.status === 'fulfilled' ? results[2].value.data.data : null);

      setLoading(false);

    }

    load();

    return () => { live = false; };

  }, [year]);



  const kpis = data?.kpis || {};

  const po = asNumber(kpis.totalPOValue);

  const bank = asNumber(kpis.totalBankReceived ?? kpis.totalAmountReceived);

  // Prefer the reconciled amount supplied by the API (which may include TDS).
  const outstanding = asNumber(kpis.totalPOOutstanding ?? kpis.totalOutstanding ?? kpis.outstandingAmount ?? (po - bank - asNumber(kpis.totalTDS)));
  const invoiced = asNumber(kpis.totalInvoicedAmount);
  const collectionPercent = po > 0 ? Math.min(100, (bank / po) * 100) : 0;
  const invoicedPercent = po > 0 ? Math.min(100, (invoiced / po) * 100) : 0;
  const alertCount = definitions.reduce((n, x) => n + (alerts[x.key]?.length || 0), 0);
  const visibleDefinitions = definitions.filter(x => alertFilter === 'all' || (alerts[x.key]?.length || 0) > 0);
  const actionItems = definitions.flatMap(x => (alerts[x.key] || []).map(item => ({ ...item, alertType: x.title, kind: x.kind, key: x.key })))
    .sort((a,b) => new Date(b.completionDate || b.expectedCompletionDate || b.invoiceDueDate || 0) - new Date(a.completionDate || a.expectedCompletionDate || a.invoiceDueDate || 0)).slice(0,6);

  const monthly = useMemo(() => {

    const result = months.map((name, i) => ({ name, month: i + 1, poValue: 0, invoiced: 0, received: 0, outstanding: 0 }));

    for (const item of data?.monthly || []) {

      const m = Number(item.month ?? item._id?.month ?? item._id);

      if (m < 1 || m > 12 || !Number.isInteger(m)) continue;

      result[m - 1].poValue += asNumber(item.poValue ?? item.totalPOValue);

      result[m - 1].invoiced += asNumber(item.invoiced ?? item.invoiceValue);

      result[m - 1].received += asNumber(item.received ?? item.totalBankReceived);

    }

    let cumulative = 0;

    return result.map(row => {

      cumulative += row.poValue - row.received;

      return { ...row, outstanding: cumulative };

    });

  }, [data]);



  // The API's ageing is based on approved outstanding invoices, NOT PO minus bank receipts.

  const ageing = useMemo(() => {

    const names = ['Not due', '0-30', '31-60', '61-90', '90+'];

    const map = new Map(names.map(name => [name, 0]));

    for (const item of data?.aging || []) {

      const key = String(item._id ?? item.bucket ?? '');

      if (map.has(key)) map.set(key, map.get(key) + asNumber(item.amount));

    }

    return names.map(name => ({ name: name === 'Not due' ? 'Not due' : `${name} days`, key: name, amount: map.get(name) }));

  }, [data]);

  const agingPresent = ageing.some(r => r.amount > 0);

  const modalItems = selected ? (Array.isArray(alerts[selected.key]) ? alerts[selected.key] : []) : [];



  return <>

    <style>{`

      .tv-dashboard{--line:#e9edf4;--ink:#24324a;--muted:#8995a8;color:var(--ink)}

      .tv-dashboard .tv-kpi{position:relative;background:#fff;border:1px solid var(--line);border-left:5px solid var(--accent);border-radius:16px;padding:21px 20px;box-shadow:0 8px 25px rgba(42,54,88,.045);min-width:0;overflow:hidden}

      .tv-kpi:after{content:"";position:absolute;width:125px;height:125px;border-radius:50%;right:-72px;bottom:-85px;background:var(--accent-pale)}

      .tv-kpi-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.tv-kpi-label{font-size:12px;color:#66738b;font-weight:650;letter-spacing:.15px}.tv-kpi-icon{width:40px;height:40px;flex:0 0 40px;display:grid;place-items:center;background:var(--accent-pale);color:var(--accent);border-radius:12px;font-size:19px}

      .tv-kpi-value{font-size:clamp(22px,2.1vw,30px);font-weight:750;letter-spacing:-.8px;line-height:1.3;margin-top:16px;overflow-wrap:anywhere;position:relative;z-index:1}.tv-kpi-caption{margin-top:7px;color:#8a95a7;font-size:11px;position:relative;z-index:1;line-height:1.5}

      @keyframes tvPulseGlow{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.1)}}
      .tv-dashboard .tv-kpi{transition:transform .28s ease,box-shadow .28s ease!important}
      .tv-dashboard .tv-kpi:hover{transform:translateY(-6px);box-shadow:0 17px 35px rgba(40,51,85,.12)}
      .tv-dashboard .tv-panel{transition:box-shadow .3s ease,transform .3s ease}
      .tv-dashboard .tv-panel:hover{box-shadow:0 15px 36px rgba(40,51,85,.085)}
      .tv-dashboard .tv-progress{height:5px;background:#edf0f6;border-radius:9px;overflow:hidden;margin-top:8px}
      .tv-dashboard .tv-progress>span{height:100%;display:block;background:linear-gradient(90deg,#7668d6,#17aa83);border-radius:9px}
      .tv-dashboard .tv-action{display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid #f0f1f5;text-decoration:none;color:inherit}
      .tv-dashboard .tv-action:hover{background:#f8f9ff}
      .tv-dashboard .tv-panel{border:1px solid var(--line)!important;border-radius:17px!important;box-shadow:0 9px 28px rgba(40,51,85,.045);height:100%;overflow:hidden}

      .tv-dashboard .tv-panel .card-body{padding:22px}.tv-panel-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:16px}.tv-panel-heading h5{font-size:16px;font-weight:750;margin:0 0 6px}.tv-panel-heading p{font-size:12px;color:#8793a5;margin:0;line-height:1.5}

      .tv-dashboard .tv-pill{border-radius:9px;padding:7px 12px;border:1px solid #e5e8f1;background:white;color:#68738c;font-size:12px;font-weight:600;cursor:pointer}.tv-dashboard .tv-pill.active{color:#5f55c8;background:#f1f0fe;border-color:#dcd8ff}.tv-dashboard .tv-pill:focus-visible,.tv-attention:focus-visible{outline:3px solid #aaa4ff;outline-offset:2px}

      .tv-chart-wrap{height:315px;min-width:0;width:100%}.tv-chart-tooltip{background:white;padding:12px 14px;border:1px solid #e8eaf1;border-radius:12px;box-shadow:0 12px 30px #1a24521a;font-size:12px;display:grid;gap:5px}

      .tv-attention-list{display:grid;gap:9px}.tv-attention{display:flex;align-items:center;gap:11px;width:100%;text-align:left;border:1px solid #edf0f5;background:#fbfcfe;border-radius:12px;padding:13px 14px;transition:background .2s,transform .2s}.tv-attention:hover{background:#f4f4ff;transform:translateX(3px)}.tv-attention-icon{font-size:17px;color:#675bcc;flex-shrink:0}.tv-attention.danger .tv-attention-icon{color:#dc5e58}.tv-attention.warning .tv-attention-icon{color:#d79437}.tv-attention-main{min-width:0;flex:1}.tv-attention-title{font-size:12px;color:#4c5770;font-weight:650}.tv-attention-hint{display:block;font-size:10px;color:#9aa3b2;margin-top:3px}.tv-attention-count{background:#f1f0ff;color:#6158b5;border-radius:9px;min-width:32px;padding:5px 7px;text-align:center;font-size:14px;font-weight:750}.tv-attention.danger .tv-attention-count{background:#fff0ef;color:#bb4546}

      .tv-empty{min-height:225px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;color:#8793a6;gap:9px}.tv-empty i{font-size:30px;color:#c2c8d5}.tv-alert-row{border-bottom:1px solid #f0f1f5;padding:14px 3px}.tv-alert-row:last-child{border-bottom:0}.tv-alert-row strong{font-size:13px;overflow-wrap:anywhere}.tv-alert-row small{display:block;color:#79869b;margin-top:4px;font-size:12px}.tv-alert-message{background:#f8f9fd;border-radius:9px;padding:9px 11px;color:#526079;font-size:12px;margin-top:9px}

      @media(max-width:580px){.tv-dashboard .tv-panel .card-body{padding:15px}.tv-chart-wrap{height:265px}.tv-kpi-value{font-size:22px}}

      @media(prefers-reduced-motion:reduce){.tv-dashboard *{transition:none!important}}

    `}</style>

    <div className="tv-dashboard">

      <PageHeader title="Finance Dashboard" subtitle="Purchase orders, bank collections, receivables and action items at a glance." actions={

        <Form.Select aria-label="Calendar year" value={year} onChange={e => setYear(Number(e.target.value))} style={{ minWidth: 135 }}>

          {Array.from({length:5}, (_, i) => currentYear - i).map(y => <option key={y} value={y}>{y}</option>)}

        </Form.Select>

      } />



      {data && <>

        <div className="d-flex gap-2 align-items-center mb-3 flex-wrap"><Badge bg="light" text="dark" className="border px-3 py-2">Calendar year {year}</Badge><span className="text-muted small"><i className="bi bi-shield-check text-success me-1" />Approved financial transactions and eligible legacy records only</span></div>

        <Row className="g-3">

          <Col sm={6} xl={3}><KpiCard icon="bi-bag-check" label="Total PO Amount" value={money(po)} caption="Purchase orders dated in selected year" tone="violet" index={0}/></Col>

          <Col sm={6} xl={3}><KpiCard icon="bi-file-earmark-text" label="Approved Invoiced" value={money(kpis.totalInvoicedAmount)} caption={`${invoicedPercent.toFixed(1)}% of selected PO value invoiced`} tone="blue" index={1}/></Col>

          <Col sm={6} xl={3}><KpiCard icon="bi-bank" label="Actual Bank Received" value={money(bank)} caption={`${collectionPercent.toFixed(1)}% of selected PO value · excluding TDS`} tone="green" index={2}/></Col>

          <Col sm={6} xl={3}><KpiCard icon="bi-hourglass-split" label="PO Outstanding" value={money(outstanding)} caption="Reconciled PO outstanding (including TDS where reported)" tone="orange" index={3}/></Col>

        </Row>

        <Row className="g-3 mt-1">

          <Col xl={8}><motion.div initial={{ opacity:0,y:12 }} animate={{ opacity:1,y:0 }} transition={{delay:.15}} className="h-100"><Card className="tv-panel"><Card.Body>

            <div className="tv-panel-heading"><div><h5>Financial Performance</h5><p>{chartMode === 'movement' ? 'Monthly PO creation, approved invoices and bank deposits' : 'Running PO minus bank receipts within the selected calendar year'}</p></div><div className="d-flex gap-2 flex-wrap"><button className={`tv-pill ${chartMode === 'movement' ? 'active':''}`} onClick={() => setChartMode('movement')}>Movement</button><button className={`tv-pill ${chartMode === 'outstanding' ? 'active':''}`} onClick={() => setChartMode('outstanding')}>PO Balance</button></div></div>

              <div className="tv-chart-wrap"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                <AreaChart data={monthly} margin={{top:10,right:8,left:0,bottom:10}}>
                  <defs><linearGradient id="tvPurple" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7668d6" stopOpacity={.24}/><stop offset="95%" stopColor="#7668d6" stopOpacity={.01}/></linearGradient><linearGradient id="tvOrange" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ed9959" stopOpacity={.32}/><stop offset="95%" stopColor="#ed9959" stopOpacity={.01}/></linearGradient></defs>
                  <CartesianGrid stroke="#e9ecf3" strokeDasharray="4 5" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#8793a6',fontSize:11}}/><YAxis width={65} tickFormatter={compact} axisLine={false} tickLine={false} tick={{fill:'#8793a6',fontSize:11}}/><Tooltip content={chartTooltip}/><Legend wrapperStyle={{fontSize:11,paddingTop:8}}/>
                  {chartMode === 'movement' ? <><Area type="monotone" name="PO Amount" dataKey="poValue" stroke="#7265d3" strokeWidth={3} fill="url(#tvPurple)" isAnimationActive/><Area type="monotone" name="Invoiced" dataKey="invoiced" stroke="#319bd3" strokeWidth={2.5} fill="none"/><Area type="monotone" name="Bank Received" dataKey="received" stroke="#15a77e" strokeWidth={2.5} fill="none"/></> : <><ReferenceLine y={0} stroke="#9aa5b5"/><Area type="monotone" name="Running PO Balance" dataKey="outstanding" stroke="#e98c45" strokeWidth={3} fill="url(#tvOrange)"/></>}
                </AreaChart>
              </ResponsiveContainer></div>

          </Card.Body></Card></motion.div></Col>



<Col xl={4}>

  <Card className="tv-panel">

    <Card.Body>

      <div className="tv-panel-heading">

        <div>

          <h5>Alerts & Attention</h5>

          <p>Click an alert to view matching records</p>

        </div>

        <motion.i className="bi bi-bell-fill fs-5 text-danger" animate={{ rotate: [0,-12,12,-8,0] }} transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 6 }} />

      </div>



      {alertError && (

        <Alert variant="warning" className="small">

          {alertError}

        </Alert>

      )}



      <div className="d-flex align-items-center justify-content-between mb-2 gap-2">
          <span className="small text-muted">{alertCount} open action item{alertCount === 1 ? '' : 's'}</span>
          <div className="d-flex gap-1"><button className={`tv-pill ${alertFilter === 'all' ? 'active' : ''}`} onClick={() => setAlertFilter('all')}>All</button><button className={`tv-pill ${alertFilter === 'active' ? 'active' : ''}`} onClick={() => setAlertFilter('active')}>Active</button></div>
        </div>
        <div className="tv-attention-list">

        {visibleDefinitions.map((x, index) => {

          const count = alerts[x.key]?.length || 0;



          return (

            <motion.button

              key={x.key}

              type="button"

              className={`tv-attention ${x.color}`}

              onClick={() => setSelected(x)}

              initial={{ opacity: 0, x: 85 }}

              animate={{ opacity: 1, x: 0 }}

              transition={{

                duration: 0.55,

                delay: index * 0.18,

                ease: [0.22, 1, 0.36, 1]

              }}

            >

              <i className={`bi ${x.icon} tv-attention-icon`} />



              <span className="tv-attention-main">

                <span className="tv-attention-title">

                  {x.title}

                </span>



                <span className="tv-attention-hint">

                  {count

                    ? 'View names, dates & details'

                    : 'No matching records'}

                </span>

              </span>



              <span className="tv-attention-count">

                {count}

              </span>



              <i className="bi bi-chevron-right text-muted small" />

            </motion.button>

          );

        })}

      </div>



      <div className="small text-muted mt-3">

        Invoice alerts exclude pending and rejected approvals.

        Due dates are evaluated against calendar-day boundaries.

      </div>

    </Card.Body>

  </Card>

</Col>



        </Row>

        <Row className="g-3 mt-1">
          <Col lg={5}><motion.div initial={{opacity:0,y:22}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:.55}} className="h-100"><Card className="tv-panel"><Card.Body>
            <div className="tv-panel-heading"><div><h5>Collection & Invoicing Progress</h5><p>Against PO value in the selected calendar year</p></div><i className="bi bi-graph-up-arrow text-success"/></div>
            {[{label:'Bank collection',pct:collectionPercent,value:bank},{label:'Approved invoicing',pct:invoicedPercent,value:invoiced}].map((r,i)=><div key={r.label} className="mb-4">
              <div className="d-flex justify-content-between small mb-1"><strong>{r.label}</strong><span>{money(r.value)} · {r.pct.toFixed(1)}%</span></div>
              <div className="tv-progress"><motion.span initial={{width:0}} whileInView={{width:`${r.pct}%`}} viewport={{once:true}} transition={{duration:1.1,delay:i*.2}}/></div>
            </div>)}
            <div className="small text-muted">Bank receipts exclude TDS. Invoice and PO balances are separate financial measures.</div>
          </Card.Body></Card></motion.div></Col>
          <Col lg={7}><motion.div initial={{opacity:0,y:22}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:.55,delay:.12}} className="h-100"><Card className="tv-panel"><Card.Body>
            <div className="tv-panel-heading"><div><h5>Recent Action Items</h5><p>Latest dated items from your existing alerts · not a transaction audit log</p></div><Badge bg="light" text="dark" className="border">{actionItems.length} shown</Badge></div>
            {actionItems.length ? actionItems.map((item,i)=><motion.div key={`${item.key}-${item._id || i}`} initial={{opacity:0,x:18}} whileInView={{opacity:1,x:0}} viewport={{once:true}} transition={{delay:i*.08}} className="tv-action">
              <i className="bi bi-clock-history text-warning"/><div className="flex-grow-1"><div className="small fw-semibold">{item.alertType}</div><div className="small text-muted">{item.poNumber || item.invoiceNumber || item.title || 'Record'} · {showDate(item.completionDate || item.expectedCompletionDate || item.invoiceDueDate)}</div></div>
              <Link className="small" to={item.kind === 'work' ? '/work-followups' : item.kind === 'invoice' ? '/invoices' : '/pos'}>View</Link>
            </motion.div>) : <div className="tv-empty"><i className="bi bi-check-circle"/><strong>No active action items</strong><span>Alerts will appear here when relevant.</span></div>}
          </Card.Body></Card></motion.div></Col>
        </Row>
        <Row className="g-3 mt-1"><Col><Card className="tv-panel"><Card.Body><div className="tv-panel-heading"><div><h5>Approved Invoice Outstanding Ageing</h5><p>Unpaid approved invoices grouped by days past invoice due date · distinct from PO outstanding</p></div><Badge bg="light" text="dark" className="border p-2">Invoice receivables</Badge></div>

          {agingPresent ? <div className="tv-chart-wrap"><ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}><BarChart data={ageing} margin={{top:8,right:15,left:0,bottom:8}} barSize={56}><CartesianGrid stroke="#e9ecf3" strokeDasharray="4 5" vertical={false}/><XAxis dataKey="name" tick={{fill:'#8793a6',fontSize:11}} axisLine={false} tickLine={false}/><YAxis width={65} tickFormatter={compact} axisLine={false} tickLine={false} tick={{fill:'#8793a6',fontSize:11}}/><Tooltip content={chartTooltip}/><Bar dataKey="amount" name="Unpaid invoices" radius={[8,8,0,0]}>{ageing.map((r,i) => <Cell key={r.key} fill={['#78a6d9','#6b78d6','#d4a04c','#e48b54','#df6262'][i]}/>)}</Bar></BarChart></ResponsiveContainer></div> : <div className="tv-empty"><i className="bi bi-bar-chart-line"/><strong>No unpaid approved invoices for the selected year</strong><span>Ageing will appear when relevant invoice balances exist.</span></div>}

        </Card.Body></Card></Col></Row>

      </>}

      <Modal show={!!selected} onHide={() => setSelected(null)} centered size="lg" scrollable><Modal.Header closeButton><Modal.Title className="fs-5">{selected?.title} <Badge bg="secondary" className="ms-2">{modalItems.length}</Badge></Modal.Title></Modal.Header><Modal.Body>

        {modalItems.length === 0 ? <div className="text-center text-muted py-4">No records in this category.</div> : modalItems.map((row, index) => {

          if (selected?.kind === 'work') return <div className="tv-alert-row" key={row._id || index}>

            <div className="d-flex justify-content-between gap-2"><strong>{row.title || 'Completed work'}</strong><strong className="text-warning">{money(row.expectedValue)}</strong></div>

            <small><i className="bi bi-building me-1"/>{row.customer?.name || 'Customer not available'}</small>

            <small>Completed: {showDate(row.completionDate)} · Next follow-up: {showDate(row.nextFollowUpDate)} · Owner: {row.responsiblePerson || 'Not assigned'}</small>

            <div className="tv-alert-message">{row.pendingReason || 'Customer PO is still awaited.'}</div>

            <Link to="/work-followups" onClick={() => setSelected(null)} className="small">Open Work Follow-up</Link>

          </div>;

          const invoice = selected?.kind === 'invoice';

          const ref = invoice ? row.invoiceNumber : row.poNumber;

          const customer = row.partyCustomerName || row.po?.partyCustomerName || 'Customer not provided';

          const date = invoice ? row.invoiceDueDate : row.expectedCompletionDate;

          const message = invoice ? `Invoice ${ref || '—'} for ${customer} ${selected.key === 'invoiceOverdue' ? 'is overdue' : 'is due soon'}.` : selected.key === 'completedNoInvoice' ? `PO ${ref || '—'} for ${customer} is completed but not fully invoiced.` : `PO ${ref || '—'} for ${customer} ${selected.key === 'poOverdue' ? 'has passed its expected completion date' : 'is approaching its expected completion date'}.`;

          return <div className="tv-alert-row" key={row._id || index}><div className="d-flex justify-content-between flex-wrap gap-2"><strong>{invoice ? 'Invoice' : 'PO'}: {ref || '—'}</strong>{invoice && <strong className="text-danger">{money(row.outstandingAmount)}</strong>}</div><small><i className="bi bi-building me-1"/>{customer} {invoice && row.po?.poNumber ? `· PO ${row.po.poNumber}` : ''}</small><small><i className="bi bi-calendar3 me-1"/>{date ? `Due: ${showDate(date)}` : 'No due date'} {row.invoiceStatus ? `· ${row.invoiceStatus.replaceAll('_',' ')}` : ''}</small><div className="tv-alert-message">{message}</div><Link to={invoice ? '/invoices' : '/pos'} onClick={() => setSelected(null)} className="small">Open {invoice ? 'Invoices' : 'PO Management'} <i className="bi bi-arrow-up-right"/></Link></div>;

        })}

      </Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setSelected(null)}>Close</Button></Modal.Footer></Modal>

    </div>

  </>;

}
