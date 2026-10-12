import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Dropdown } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import logo from "../assets/logo.png";

/* All masters (Customers, Items, Projects, TDS) use /masters tabs. */
const nav = [
  ['/', 'bi-grid-1x2-fill', 'Dashboard'],
  ['/pos', 'bi-receipt-cutoff', 'PO Management'],
  ['/work-followups', 'bi-clipboard-check', 'Work Follow-up'],
  
  ['/invoices', 'bi-file-earmark-text', 'Invoices'],
  ['/payments', 'bi-cash-stack', 'Payments'],
  ['/reports', 'bi-bar-chart-line', 'Reports'],
  ['/masters', 'bi-database-gear', 'Masters']
];

const navPermissions = {'/':'dashboard.view','/pos':'po.view','/work-followups':'work.view','/invoices':'invoice.view','/payments':'payment.view','/reports':'report.view','/masters':['customer.view','item.view','project.view','tds.view']};

export default function AppLayout() {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  const pageName = location.pathname.startsWith('/invoice-drafts') ? 'Pre-Invoice Drafts' : location.pathname.startsWith('/work-followups') ? 'Work Follow-up' : location.pathname.startsWith('/pos') ? 'PO Management' : location.pathname.startsWith('/invoices') ? 'Invoices' : location.pathname.startsWith('/payments') ? 'Payments' : location.pathname.startsWith('/masters') ? 'Masters' : location.pathname.startsWith('/approvals') ? 'Approvals' : location.pathname.startsWith('/reports') ? 'Reports' : location.pathname.startsWith('/users') ? 'Users & Roles' : 'Dashboard';
  const role = user?.role;

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <>
      <style>{`
        .app-shell .sidebar { display: flex; flex-direction: column; min-height: 100vh; }
        .app-shell .sidebar > nav { flex: 1; min-height: 0; overflow-y: auto; padding-bottom: 12px; }
        .app-shell .sidebar > nav::-webkit-scrollbar { width: 4px; }
        .app-shell .sidebar > nav::-webkit-scrollbar-thumb { background: rgba(148,163,184,.25); border-radius: 10px; }
        .app-shell .sidebar .app-nav-link {
          display: flex; align-items: center; gap: 12px; width: 100%;
          min-height: 42px; padding: 10px 13px; margin-bottom: 4px;
          border-left: 3px solid transparent; border-radius: 9px;
          color: #aebbd2; font-size: 13px; font-weight: 500;
          text-decoration: none; transition: background .2s ease, color .2s ease;
        }
        .app-shell .sidebar .app-nav-link i { width: 18px; flex-shrink: 0; font-size: 16px; text-align: center; }
        .app-shell .sidebar .app-nav-link:hover { background: rgba(99,102,241,.12); color: #fff; }
        .app-shell .sidebar .app-nav-link.app-nav-active {
          background: rgba(99,102,241,.20); border-left-color: #818cf8; color: #fff;
        }
        .app-shell .sidebar .sidebar-foot { flex-shrink: 0; }
        @media(max-width:768px) { .app-shell .sidebar .app-nav-link { gap: 9px; padding: 10px; } }

        /* Internal theme: shared components and page alignment */
        .app-shell {--primary:#6557ca;--ink:#292d42;--border:#e8eaf2;--bg:#f7f8fc;background:#f7f8fc}
        .app-shell .sidebar {width:250px;background:linear-gradient(155deg,#25243e,#292944);padding:24px 15px}
        .app-shell .brand-mark {background:linear-gradient(120deg,#f6a16a,#e87957);box-shadow:none;font-size:12px}
        .app-shell .sidebar .app-nav-link {border-left:0;border-radius:11px;transition:background .2s,transform .2s}
        .app-shell .sidebar .app-nav-link:hover {background:rgba(255,255,255,.08);transform:translateX(2px)}
        .app-shell .sidebar .app-nav-link.app-nav-active {background:#fff;color:#363153;box-shadow:0 7px 20px rgba(0,0,0,.1);font-weight:700}
        .app-shell .sidebar .app-nav-link.app-nav-active i {color:#6557ca}
        .app-shell .main {margin-left:250px;min-width:0}
        .app-shell .topbar {height:73px;padding:0 30px;background:rgba(255,255,255,.94);backdrop-filter:blur(12px)}
        .app-shell .topbar-label {color:#2d3046;font-size:15px;font-weight:700}
        .app-shell .topbar-context {color:#949aae;font-size:11px;margin-top:3px}
        .app-shell .user-menu {background:#fafaff!important;border-radius:11px;padding:6px 9px;max-width:220px}
        .app-shell .content {max-width:1800px;margin:auto;padding:28px 30px 45px;min-width:0}
        .app-shell .page-heading h1 {font-size:26px;color:#2b3048;letter-spacing:-.8px}
        .app-shell .kpi-card,.app-shell .panel-card,.app-shell .filter-card,.app-shell .table-card,.app-shell .form-card,.app-shell .mini-metric {border-color:#e9eaf2!important;border-radius:16px!important;box-shadow:0 5px 24px rgba(40,40,80,.045);transition:box-shadow .2s,transform .2s}
        .app-shell .kpi-card:hover,.app-shell .mini-metric:hover {transform:translateY(-3px);box-shadow:0 14px 32px rgba(57,50,106,.085)}
        .app-shell .kpi-value {font-size:28px}
        .app-shell .kpi-icon {background:#f0edff;color:#6458c3}
        .app-shell .primary-btn,.app-shell .btn-primary {background:#6659c9!important;border-color:#6659c9!important;color:#fff!important;box-shadow:0 4px 12px rgba(102,89,201,.14)}
        .app-shell .primary-btn:hover,.app-shell .btn-primary:hover {background:#5549b6!important;border-color:#5549b6!important}
        .app-shell .btn {border-radius:9px;font-size:12px;font-weight:600}
        .app-shell .form-label {font-size:12px;font-weight:650;color:#515875}
        .app-shell .form-control,.app-shell .form-select {background:#fcfcff;border:1px solid #e3e6f0;border-radius:9px;min-height:40px;font-size:13px}
        .app-shell .form-control:focus,.app-shell .form-select:focus {background:#fff;border-color:#897ae4;box-shadow:0 0 0 3px rgba(102,89,201,.09)}
        .app-shell .table-responsive {max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}
        .app-shell .table thead th {background:#f8f9fc;color:#69718b;font-size:11px;font-weight:700;white-space:nowrap;vertical-align:middle}
        .app-shell .table tbody td {vertical-align:middle;border-bottom-color:#f0f1f6}
        .app-shell .table tbody tr:hover {background-color:#faf9ff}
        .app-shell .nav-tabs {flex-wrap:wrap;gap:4px}
        .app-shell .nav-tabs .nav-link {font-size:12px;font-weight:600}
        .app-shell .card,.app-shell .row>* {min-width:0}
        .app-shell .mobile-menu-button {display:none;border:1px solid #e6e7ef;background:#fff;color:#44405f;width:39px;height:39px;border-radius:10px;align-items:center;justify-content:center}
        .app-shell .mobile-overlay {display:none}
        @media(min-width:769px) and (max-width:992px) {.app-shell .sidebar {width:76px;padding:20px 10px}.app-shell .main {margin-left:76px}.app-shell .brand>div:not(.brand-mark),.app-shell .sidebar nav span,.app-shell .sidebar-foot {display:none}.app-shell .brand {justify-content:center}.app-shell .sidebar .app-nav-link {justify-content:center;padding:11px}}
        @media(max-width:768px) {
          .app-shell .sidebar {position:fixed;inset:0 auto 0 0;width:260px;display:flex;transform:translateX(-105%);transition:transform .25s ease;z-index:1051}
          .app-shell .sidebar.tv-sidebar-open {transform:translateX(0)}
          .app-shell .sidebar .brand>div:not(.brand-mark),.app-shell .sidebar nav span,.app-shell .sidebar-foot {display:block}
          .app-shell .sidebar .app-nav-link {justify-content:flex-start!important}
          .app-shell .mobile-overlay.tv-overlay-open {display:block;position:fixed;inset:0;background:rgba(17,20,39,.45);z-index:1050}
          .app-shell .mobile-menu-button {display:inline-flex;flex:none}
          .app-shell .main {margin-left:0}
          .app-shell .topbar {height:64px;padding:0 14px}
          .app-shell .topbar-label {font-size:13px}
          .app-shell .content {padding:18px 13px 35px}
        }
        @media(max-width:420px) {.app-shell .topbar-context {display:none}.app-shell .content {padding:15px 10px 30px}}
        @media(prefers-reduced-motion:reduce) {.app-shell * {transition:none!important}}
      `}</style>

      <div className="app-shell">
        <div className={`mobile-overlay${mobileOpen ? ' tv-overlay-open' : ''}`} onClick={() => setMobileOpen(false)} aria-hidden="true" />
        <aside className={`sidebar${mobileOpen ? ' tv-sidebar-open' : ''}`}>
          <div className="brand">
            <div
  className="brand-mark"
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "55px",
    height: "55px",
    padding: "4px",
    background: "transparent",
    border: "none",
    boxShadow: "none",
  }}
>
  <img
    src={logo}
    alt="Thetavega Logo"
    style={{
      width: "100%",
      height: "100%",
      objectFit: "contain",
      display: "block",
    }}
  />
</div>
             <div
    style={{
      fontSize: "17px",
      fontWeight: "700",
      color: "#FFFFFF",
      letterSpacing: "0.2px",
      whiteSpace: "nowrap",
      lineHeight: "1.3",
    }}
  >
    Thetavega Tech
  </div>
          </div>

          <nav aria-label="Main navigation">
            {nav.filter(([to]) => { const required=navPermissions[to]; return Array.isArray(required)?required.some(hasPermission):hasPermission(required); }).map(([to, icon, label]) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/' || to === '/masters'}
                className={({ isActive }) => `app-nav-link${isActive ? ' app-nav-active' : ''}`}
              >
                <i className={`bi ${icon}`} />
                <span>{label}</span>
              </NavLink>
            ))}

            {hasPermission('approval.view') && (
              <NavLink
                to="/approvals"
                className={({ isActive }) => `app-nav-link${isActive ? ' app-nav-active' : ''}`}
              >
                <i className="bi bi-shield-check" />
                <span>Approvals</span>
              </NavLink>
            )}

            {hasPermission('user.view') && (
              <NavLink
                to="/users"
                className={({ isActive }) => `app-nav-link${isActive ? ' app-nav-active' : ''}`}
              >
                <i className="bi bi-people" />
                <span>Users & Roles</span>
              </NavLink>
            )}
          </nav>

          <div className="sidebar-foot">
            <span className="role-pill">{role}</span>
            <small>Secure business workspace</small>
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <div className="d-flex align-items-center gap-3">
              <button className="mobile-menu-button" type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><i className="bi bi-list fs-5" /></button>
              <div><div className="topbar-label">{pageName}</div><div className="topbar-context">Thetavega / Finance Workspace</div></div>
            </div>
            <Dropdown align="end">
              <Dropdown.Toggle variant="light" className="user-menu">
                <span className="avatar">{user?.name?.[0] || 'U'}</span>
                <span className="d-none d-md-inline">{user?.name}</span>
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item disabled>{user?.email}</Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right me-2" />Logout
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </header>
          <motion.section key={location.pathname} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:0.25}} className="content"><Outlet /></motion.section>
        </main>
      </div>
    </>
  );
}
