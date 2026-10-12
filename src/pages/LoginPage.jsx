import React, { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

const Motion = motion;

const workflow = [
  { icon: 'bi-file-earmark-text', label: 'Purchase Orders', color: '#6657d7' },
  { icon: 'bi-receipt', label: 'Invoices', color: '#108cc9' },
  { icon: 'bi-bank', label: 'Payments', color: '#0a9b71' },
  { icon: 'bi-check2-circle', label: 'Reconciliation', color: '#f07a39' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    try {
      setBusy(true);
      setErr('');
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (error) {
      setErr(error.response?.data?.message || 'Unable to sign in. Please verify your credentials.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tv-login-screen">
      <style>{`
        .tv-login-screen { --ink:#222a43; --muted:#8591aa; --navy:#272640; --purple:#6658d4; --line:#e7eaf2; position:relative; min-height:100vh; min-height:100dvh; width:100%; overflow:hidden; background:#f6f7fb; color:var(--ink); font-family:Inter,'Segoe UI',sans-serif; isolation:isolate; }
        .tv-login-screen * { box-sizing:border-box; }
        .tv-login-screen::before { content:''; position:absolute; inset:0 0 auto 0; height:6px; background:linear-gradient(90deg,#6658d4 0 25%,#0b91d1 25% 50%,#08a575 50% 75%,#f47c38 75%); }
        .tv-login-glow { position:absolute; border-radius:50%; filter:blur(8px); pointer-events:none; z-index:-1; }
        .tv-login-glow.one { width:520px; height:520px; top:-230px; right:-200px; background:radial-gradient(circle,rgba(102,88,212,.11),transparent 67%); }
        .tv-login-glow.two { width:530px; height:530px; bottom:-340px; left:-230px; background:radial-gradient(circle,rgba(17,143,211,.1),transparent 68%); }
        .tv-login-shell { width:min(1210px,calc(100% - 72px)); min-height:100dvh; margin:auto; display:flex; flex-direction:column; }
        .tv-login-top { padding:33px 0 0; display:flex; justify-content:space-between; align-items:center; gap:20px; }
        .tv-login-brand { display:flex; align-items:center; gap:12px; min-width:0; }
        .tv-login-logo { width:49px; height:49px; object-fit:contain; flex-shrink:0; }
        .tv-login-brandname { font-size:20px; font-weight:750; letter-spacing:-.55px; line-height:1.15; color:#262743; white-space:nowrap; }
        .tv-login-brandcaption { margin-top:5px; font-size:10px; letter-spacing:1.22px; font-weight:650; color:#8b97b0; }
        .tv-login-topright { display:flex; align-items:center; gap:9px; font-size:12px; font-weight:600; color:#7986a0; }
        .tv-login-status { display:block; width:8px; height:8px; border-radius:50%; background:#08a57c; box-shadow:0 0 0 5px rgba(8,165,124,.1); }
        .tv-login-main { width:100%; max-width:1180px; margin:auto; display:grid; grid-template-columns:minmax(0,1.14fr) minmax(375px,.86fr); gap:clamp(55px,8vw,135px); align-items:center; padding:24px 0 28px; }
        .tv-login-copy { padding:14px 0; min-width:0; }
        .tv-login-pill { display:inline-flex; align-items:center; gap:9px; padding:9px 13px; border:1px solid #e1e3f6; border-radius:9px; background:#eeedfc; font-size:10px; font-weight:800; letter-spacing:1px; color:#675bc5; }
        .tv-login-headline { margin:25px 0 18px; font-size:clamp(37px,3.65vw,56px); line-height:1.13; letter-spacing:-2px; font-weight:770; }
        .tv-login-headline span { color:#6658d4; }
        .tv-login-description { max-width:460px; font-size:14px; color:#7f8ca5; line-height:1.85; margin:0; }
        .tv-login-workflow { margin-top:31px; display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
        .tv-login-flowitem { display:flex; gap:7px; align-items:center; background:#fff; border:1px solid var(--line); box-shadow:0 5px 18px rgba(30,40,80,.035); border-radius:9px; padding:10px 11px; font-size:11px; font-weight:650; color:#46526e; }
        .tv-login-flowitem i { font-size:15px; }
        .tv-login-arrow { font-size:12px; color:#aeb7c9; }
        .tv-login-visual { position:relative; margin-top:28px; max-width:475px; }
        .tv-login-dashboardcard { background:white; border:1px solid var(--line); border-radius:15px; box-shadow:0 15px 45px rgba(35,43,82,.055); padding:18px 20px 17px; width:100%; }
        .tv-login-minihead { display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .tv-login-minititle { font-size:13px; font-weight:750; }
        .tv-login-minisub { margin-top:4px; font-size:11px; color:#9aa6ba; }
        .tv-login-bars { height:90px; margin-top:19px; display:flex; align-items:flex-end; justify-content:space-between; gap:9px; border-bottom:1px solid #eef0f7; }
        .tv-login-bar { flex:1; min-width:5px; border-radius:5px 5px 0 0; }
        .tv-login-minirow { display:flex; justify-content:space-between; gap:12px; margin-top:13px; font-size:10px; color:#8d9bb1; }
        .tv-login-progress { color:#0a9b71; font-weight:700; }
        .tv-login-floating { display:flex; align-items:center; gap:11px; position:absolute; right:-23px; top:42px; padding:12px 15px; background:#fff; border:1px solid #e8eaf2; border-radius:12px; box-shadow:0 12px 35px rgba(35,43,82,.12); }
        .tv-login-floaticon { display:flex; width:34px; height:34px; align-items:center; justify-content:center; border-radius:10px; background:#e4f7ef; color:#109c73; }
        .tv-login-floattitle { font-size:11px; font-weight:750; }
        .tv-login-floatsub { font-size:10px; color:#97a2b4; margin-top:3px; }
        .tv-login-formcard { position:relative; width:100%; padding:38px 38px 30px; background:white; border:1px solid #e9eaf2; border-radius:20px; box-shadow:0 20px 60px rgba(33,43,77,.08); }
        .tv-login-formcard::before { content:''; position:absolute; top:0; left:36px; right:36px; height:3px; background:linear-gradient(90deg,#6658d4,#0a91d0,#11a075,#f47c38); border-radius:0 0 5px 5px; }
        .tv-login-cardicon { width:43px; height:43px; display:flex; align-items:center; justify-content:center; background:#f0effc; color:#6558d1; border-radius:12px; margin-bottom:20px; font-size:20px; }
        .tv-login-overline { font-size:10px; font-weight:800; letter-spacing:1.4px; color:#6c64bf; }
        .tv-login-cardtitle { font-size:29px; font-weight:760; letter-spacing:-.8px; margin:9px 0 6px; }
        .tv-login-cardsub { color:#909cb0; font-size:12px; line-height:1.7; margin:0 0 26px; }
        .tv-login-formcard .form-label { display:block; font-size:12px; font-weight:700; color:#40516e; margin-bottom:9px; }
        .tv-login-inputwrap { position:relative; }
        .tv-login-inputicon { position:absolute; top:50%; transform:translateY(-50%); left:15px; font-size:15px; color:#a3aec2; z-index:1; pointer-events:none; }
        .tv-login-formcard .tv-login-input { height:49px; border-radius:10px; border:1px solid #e5e9f2; background:#fbfcfe; padding:10px 14px 10px 43px; color:#25304a; font-size:13px; box-shadow:none; transition:all .2s ease; }
        .tv-login-formcard .tv-login-input:focus { border-color:#887de0; background:white; box-shadow:0 0 0 4px rgba(102,88,212,.09); }
        .tv-login-formcard .tv-login-input::placeholder { color:#adb7c7; }
        .tv-login-input.password { padding-right:48px; }
        .tv-login-eye { display:flex; position:absolute; right:8px; top:50%; transform:translateY(-50%); padding:9px; border:0; background:none; color:#8793a8; }
        .tv-login-eye:hover { color:#6658d4; }
        .tv-login-submit.btn { width:100%; min-height:49px; border:0; border-radius:10px; background:#6055ca; font-size:13px; font-weight:750; margin-top:7px; display:flex; justify-content:center; align-items:center; gap:11px; box-shadow:0 9px 24px rgba(96,85,202,.18); transition:transform .2s ease,background .2s ease,box-shadow .2s ease; }
        .tv-login-submit.btn:hover:not(:disabled) { background:#5045b9; transform:translateY(-2px); box-shadow:0 12px 26px rgba(96,85,202,.23); }
        .tv-login-secure { display:flex; gap:8px; align-items:center; justify-content:center; border-top:1px solid #f0f2f7; padding-top:19px; margin-top:22px; color:#9ca6b8; font-size:11px; text-align:center; }
        .tv-login-secure i { color:#09a37a; font-size:14px; }
        .tv-login-footer { padding:13px 0 19px; border-top:1px solid #e7eaf1; color:#9ba6b9; font-size:10px; display:flex; justify-content:space-between; gap:15px; }
        @media(max-width:1100px) { .tv-login-main { gap:45px; grid-template-columns:minmax(0,1fr) minmax(350px,.85fr); } .tv-login-floating { right:-10px; } .tv-login-formcard { padding:32px 28px 25px; } .tv-login-headline { font-size:42px; } }
        @media(max-width:850px) { .tv-login-screen { overflow:auto; } .tv-login-shell { width:min(620px,calc(100% - 34px)); } .tv-login-main { grid-template-columns:1fr; gap:24px; padding:35px 0; } .tv-login-copy { padding:0; } .tv-login-visual { display:none; } .tv-login-description { max-width:570px; } .tv-login-formcard { max-width:530px; margin:0 auto; } }
        @media(max-width:520px) { .tv-login-top { padding-top:25px; } .tv-login-topright { display:none; } .tv-login-brandname { font-size:18px; } .tv-login-main { padding:28px 0; } .tv-login-headline { font-size:36px; letter-spacing:-1.4px; margin:18px 0 13px; } .tv-login-description { font-size:13px; } .tv-login-workflow { margin-top:19px; } .tv-login-flowitem { font-size:10px; padding:8px; } .tv-login-formcard { padding:29px 23px; } .tv-login-footer { flex-direction:column; align-items:center; text-align:center; gap:6px; } }
        @media(max-height:740px) and (min-width:851px) { .tv-login-top { padding-top:18px; } .tv-login-main { padding:16px 0; } .tv-login-headline { margin:15px 0 12px; font-size:clamp(33px,3vw,45px); } .tv-login-workflow { margin-top:17px; } .tv-login-visual { margin-top:15px; } .tv-login-bars { height:60px; margin-top:12px; } .tv-login-formcard { padding-top:24px; padding-bottom:22px; } .tv-login-cardicon { margin-bottom:12px; } .tv-login-cardsub { margin-bottom:15px; } .tv-login-footer { padding:10px 0; } }
        @media(prefers-reduced-motion:reduce) { .tv-login-screen *, .tv-login-screen *::before, .tv-login-screen *::after { animation:none !important; transition:none !important; } }
      `}</style>
      <div className="tv-login-glow one" />
      <div className="tv-login-glow two" />
      <div className="tv-login-shell">
        <div className="tv-login-top">
          <div className="tv-login-brand">
            <img src={logo} alt="Thetavega Tech" className="tv-login-logo" />
            <div><div className="tv-login-brandname">Thetavega Tech</div><div className="tv-login-brandcaption">PAYMENT RECONCILIATION</div></div>
          </div>
          <div className="tv-login-topright"><span className="tv-login-status" /> Secure Finance Workspace</div>
        </div>
        <main className="tv-login-main">
          <section className="tv-login-copy">
            <Motion.div initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:.55}}>
              <div className="tv-login-pill"><i className="bi bi-stars" /> SMART FINANCIAL OPERATIONS</div>
              <h1 className="tv-login-headline">Your finances.<br/>One connected<br/><span>workspace.</span></h1>
              <p className="tv-login-description">Manage purchase orders, invoices, collections and reconciliation with clarity, control and confidence.</p>
            </Motion.div>
            <Motion.div className="tv-login-workflow" initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} transition={{duration:.55,delay:.18}}>
              {workflow.map((item,index) => <React.Fragment key={item.label}>
                {index>0 && <i className="bi bi-arrow-right tv-login-arrow" aria-hidden="true" />}
                <div className="tv-login-flowitem"><i className={`bi ${item.icon}`} style={{color:item.color}} />{item.label}</div>
              </React.Fragment>)}
            </Motion.div>
            <Motion.div className="tv-login-visual" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:.6,delay:.3}} aria-hidden="true">
              <div className="tv-login-dashboardcard">
                <div className="tv-login-minihead"><div><div className="tv-login-minititle">Financial Performance</div><div className="tv-login-minisub">Illustrative workspace overview</div></div><i className="bi bi-graph-up-arrow" style={{color:'#6558d4',fontSize:19}} /></div>
                <div className="tv-login-bars">
                  {[31,47,42,62,56,73,64,87,76,100].map((height,index) => <Motion.div key={index} className="tv-login-bar" style={{background:index>6?'#6658d4':index>3?'#b8b2ec':'#dcd9f6'}} initial={{height:0}} animate={{height:`${height}%`}} transition={{duration:.7,delay:.4+index*.065,ease:'easeOut'}} />)}
                </div>
                <div className="tv-login-minirow"><span>Organized • Tracked • Reconciled</span><span className="tv-login-progress"><i className="bi bi-check-circle me-1" />In sync</span></div>
              </div>
              <Motion.div className="tv-login-floating" animate={{y:[0,-7,0]}} transition={{duration:4,repeat:Infinity,ease:'easeInOut'}}>
                <div className="tv-login-floaticon"><i className="bi bi-check2-circle" /></div><div><div className="tv-login-floattitle">Payment Reconciled</div><div className="tv-login-floatsub">Illustrative status</div></div>
              </Motion.div>
            </Motion.div>
          </section>
          <Motion.section className="tv-login-formcard" initial={{opacity:0,x:25,scale:.98}} animate={{opacity:1,x:0,scale:1}} transition={{duration:.6,delay:.12,ease:'easeOut'}} aria-label="Sign in">
            <div className="tv-login-cardicon"><i className="bi bi-shield-lock" /></div>
            <div className="tv-login-overline">PAYMENT RECONCILIATION PORTAL</div>
            <h2 className="tv-login-cardtitle">Welcome back</h2>
            <p className="tv-login-cardsub">Sign in to access your finance workspace.</p>
            {err && <Alert variant="danger" dismissible onClose={()=>setErr('')} role="alert" className="small">{err}</Alert>}
            <Form onSubmit={submit}>
              <Form.Group className="mb-4" controlId="tv-login-email">
                <Form.Label>Work Email</Form.Label>
                <div className="tv-login-inputwrap"><i className="bi bi-envelope tv-login-inputicon" /><Form.Control className="tv-login-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" autoComplete="username" required disabled={busy} /></div>
              </Form.Group>
              <Form.Group className="mb-4" controlId="tv-login-password">
                <Form.Label>Password</Form.Label>
                <div className="tv-login-inputwrap"><i className="bi bi-lock tv-login-inputicon" /><Form.Control className="tv-login-input password" type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required minLength={6} disabled={busy} /><button className="tv-login-eye" type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword}><i className={`bi bi-eye${showPassword?'-slash':''}`} /></button></div>
              </Form.Group>
              <Button className="tv-login-submit" type="submit" disabled={busy}>{busy?<><Spinner size="sm" animation="border"/> Signing in...</>:<>Access Workspace <i className="bi bi-arrow-right" /></>}</Button>
            </Form>
            <div className="tv-login-secure"><i className="bi bi-shield-check" /> Secure access for authorized team members</div>
          </Motion.section>
        </main>
        <footer className="tv-login-footer"><span>© {new Date().getFullYear()} Thetavega Tech Pvt. Ltd. All rights reserved.</span><span>Payment Reconciliation Workspace</span></footer>
      </div>
    </div>
  );
}
