import {useCallback,useEffect,useMemo,useState} from 'react';
import {Alert,Badge,Button,Card,Col,Form,Modal,Row,Spinner,Table,Tab,Tabs} from 'react-bootstrap';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import {useAuth} from '../context/AuthContext';

const emptyUser=()=>({name:'',email:'',password:'',role:'VIEWER',isActive:true});
const emptyRole=()=>({code:'',name:'',description:'',isActive:true,permissions:[]});
const label=s=>String(s||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

export default function UsersPage(){
  const {hasPermission,refreshPermissions}=useAuth();
  const [tab,setTab]=useState('users');
  const [users,setUsers]=useState([]),[roles,setRoles]=useState([]),[catalog,setCatalog]=useState({});
  const [userOpen,setUserOpen]=useState(false),[roleOpen,setRoleOpen]=useState(false),[editingRole,setEditingRole]=useState(null),[editingUser,setEditingUser]=useState(null);
  const [userForm,setUserForm]=useState(emptyUser()),[roleForm,setRoleForm]=useState(emptyRole());
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const canCreateUser=hasPermission('user.create'),canEditUser=hasPermission('user.edit');
  const canCreateRole=hasPermission('role.create'),canEditRole=hasPermission('role.edit');
  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [u,r,c]=await Promise.all([api.get('/users'),api.get('/roles'),api.get('/roles/catalog')]);
      setUsers(u.data.data||[]);setRoles(r.data.data||[]);setCatalog(c.data.data||{});setError('');
    }catch(e){setError(e.response?.data?.message||'Unable to load users and role permissions.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);
  const activeRoles=useMemo(()=>roles.filter(r=>r.isActive!==false),[roles]);
  const totalPermissions=Object.values(catalog).reduce((n,actions)=>n+actions.length,0);
  function addUser(){setEditingUser(null);setUserForm(emptyUser());setError('');setUserOpen(true);}
  function editUser(user){setEditingUser(user);setUserForm({name:user.name,email:user.email,password:'',role:user.role,isActive:user.isActive!==false});setError('');setUserOpen(true);}
  function addRole(){setEditingRole(null);setRoleForm(emptyRole());setError('');setRoleOpen(true);}
  function editRole(role){setEditingRole(role);setRoleForm({code:role.code,name:role.name,description:role.description||'',isActive:role.isActive!==false,permissions:[...(role.permissions||[])]});setError('');setRoleOpen(true);}
  function togglePermission(permission,checked){setRoleForm(f=>({...f,permissions:checked?[...new Set([...f.permissions,permission])]:f.permissions.filter(p=>p!==permission)}));}
  function toggleModule(module,checked){const keys=(catalog[module]||[]).map(action=>`${module}.${action}`);setRoleForm(f=>({...f,permissions:checked?[...new Set([...f.permissions,...keys])]:f.permissions.filter(p=>!keys.includes(p))}));}
  async function saveUser(e){e.preventDefault();setSaving(true);setError('');setNotice('');try{
    const payload={...userForm};if(editingUser&&!payload.password)delete payload.password;
    if(editingUser)await api.put(`/users/${editingUser._id}`,payload);else await api.post('/users',payload);
    setUserOpen(false);setNotice(editingUser?'User updated.':'User created.');await load();
  }catch(e){setError(e.response?.data?.message||'Unable to save user.');}finally{setSaving(false);}}
  async function saveRole(e){e.preventDefault();setSaving(true);setError('');setNotice('');try{
    const payload={...roleForm,code:roleForm.code.trim().toUpperCase(),permissions:[...new Set(roleForm.permissions)]};
    if(editingRole)await api.put(`/roles/${encodeURIComponent(editingRole.code)}`,payload);else await api.post('/roles',payload);
    setRoleOpen(false);setNotice(editingRole?'Role updated.':'Role created.');await load();await refreshPermissions();
  }catch(e){setError(e.response?.data?.message||'Unable to save role.');}finally{setSaving(false);}}
  return <>
    <PageHeader title="Users & Roles" subtitle="Manage users and role-based permissions in one place." actions={tab==='users'&&canCreateUser?<Button className="primary-btn" onClick={addUser}><i className="bi bi-person-plus me-1"/>Add User</Button>:tab==='roles'&&canCreateRole?<Button className="primary-btn" onClick={addRole}><i className="bi bi-plus-lg me-1"/>Add Role</Button>:null}/>
    {notice&&<Alert variant="success" dismissible onClose={()=>setNotice('')}>{notice}</Alert>}
    {error&&!userOpen&&!roleOpen&&<Alert variant="danger" dismissible onClose={()=>setError('')}>{error}</Alert>}
    <Row className="g-3 mb-3  tv-kpi-row"><Col md={4}><Card className="border-0 shadow-sm h-100"><Card.Body><div className="text-muted small">Total Users</div><h4 className="mt-2 mb-0">{users.length}</h4></Card.Body></Card></Col><Col md={4}><Card className="border-0 shadow-sm h-100"><Card.Body><div className="text-muted small">Active Roles</div><h4 className="mt-2 mb-0">{activeRoles.length}</h4></Card.Body></Card></Col><Col md={4}><Card className="border-0 shadow-sm h-100"><Card.Body><div className="text-muted small">Available Permissions</div><h4 className="mt-2 mb-0">{totalPermissions}</h4></Card.Body></Card></Col></Row>
    <Card className="table-card border-0 shadow-sm"><Card.Body>
      <Tabs activeKey={tab} onSelect={k=>setTab(k||'users')} className="mb-3">
        <Tab eventKey="users" title="Users"/><Tab eventKey="roles" title="Role Master & Permissions"/>
      </Tabs>
      {loading?<div className="py-5 text-center"><Spinner size="sm"/> Loading...</div>:tab==='users'?
        <div className="table-responsive"><Table hover className="business-table mb-0 align-middle"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Action</th></tr></thead><tbody>{users.map(u=><tr key={u._id}><td className="fw-semibold">{u.name}</td><td>{u.email}</td><td><Badge bg="primary">{roles.find(r=>r.code===u.role)?.name||u.role}</Badge></td><td><Badge bg={u.isActive?'success':'secondary'}>{u.isActive?'Active':'Inactive'}</Badge></td><td>{u.lastLoginAt?new Date(u.lastLoginAt).toLocaleString('en-IN'):'Never'}</td><td>{canEditUser&&<Button variant="outline-primary" size="sm" onClick={()=>editUser(u)}>Edit</Button>}</td></tr>)}{!users.length&&<tr><td colSpan={6} className="text-center text-muted">No users found</td></tr>}</tbody></Table></div>
      :<div className="table-responsive"><Table hover className="business-table mb-0 align-middle"><thead><tr><th>Role Name</th><th>Code</th><th>Permissions</th><th>Status</th><th>Action</th></tr></thead><tbody>{roles.map(r=><tr key={r.code}><td className="fw-semibold">{r.name}</td><td><code>{r.code}</code></td><td>{(r.permissions||[]).length} / {totalPermissions}</td><td><Badge bg={r.isActive?'success':'secondary'}>{r.isActive?'Active':'Inactive'}</Badge></td><td>{canEditRole&&r.code!=='ADMIN'?<Button size="sm" variant="outline-primary" onClick={()=>editRole(r)}>Edit Permissions</Button>:r.code==='ADMIN'?<small className="text-muted">Protected system role</small>:null}</td></tr>)}{!roles.length&&<tr><td colSpan={5} className="text-center text-muted">No roles found</td></tr>}</tbody></Table></div>}
    </Card.Body></Card>
    <Modal show={userOpen} onHide={()=>!saving&&setUserOpen(false)} centered><Form onSubmit={saveUser}><Modal.Header closeButton><Modal.Title>{editingUser?'Edit User':'Create User'}</Modal.Title></Modal.Header><Modal.Body>
      {error&&<Alert variant="danger">{error}</Alert>}
      <Row className="g-3"><Col md={12}><Form.Label>Name *</Form.Label><Form.Control required value={userForm.name} onChange={e=>setUserForm(p=>({...p,name:e.target.value}))}/></Col><Col md={12}><Form.Label>Email *</Form.Label><Form.Control required type="email" value={userForm.email} onChange={e=>setUserForm(p=>({...p,email:e.target.value}))}/></Col><Col md={6}><Form.Label>{editingUser?'New Password (optional)':'Password *'}</Form.Label><Form.Control required={!editingUser} minLength={8} type="password" value={userForm.password} onChange={e=>setUserForm(p=>({...p,password:e.target.value}))}/></Col><Col md={6}><Form.Label>Role *</Form.Label><Form.Select required value={userForm.role} onChange={e=>setUserForm(p=>({...p,role:e.target.value}))}>{!activeRoles.some(r=>r.code===userForm.role)&&<option value={userForm.role}>{userForm.role}</option>}{activeRoles.map(r=><option key={r.code} value={r.code}>{r.name} ({r.code})</option>)}</Form.Select></Col><Col md={12}><Form.Check type="switch" label="Active User" checked={userForm.isActive} onChange={e=>setUserForm(p=>({...p,isActive:e.target.checked}))}/></Col></Row>
    </Modal.Body><Modal.Footer><Button variant="outline-secondary" disabled={saving} onClick={()=>setUserOpen(false)}>Cancel</Button><Button type="submit" className="primary-btn" disabled={saving}>{saving?'Saving...':editingUser?'Update User':'Create User'}</Button></Modal.Footer></Form></Modal>
    <Modal show={roleOpen} onHide={()=>!saving&&setRoleOpen(false)} size="xl" centered scrollable backdrop="static"><Form onSubmit={saveRole}><Modal.Header closeButton><Modal.Title>{editingRole?'Edit Role & Permissions':'Create Role & Permissions'}</Modal.Title></Modal.Header><Modal.Body>
      {error&&<Alert variant="danger">{error}</Alert>}
      <Row className="g-3 mb-3"><Col md={4}><Form.Label>Role Code *</Form.Label><Form.Control required disabled={!!editingRole} value={roleForm.code} placeholder="QUALITY_MANAGER" onChange={e=>setRoleForm(p=>({...p,code:e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g,'')}))}/></Col><Col md={4}><Form.Label>Role Name *</Form.Label><Form.Control required value={roleForm.name} onChange={e=>setRoleForm(p=>({...p,name:e.target.value}))}/></Col><Col md={4} className="d-flex align-items-end"><Form.Check type="switch" className="pb-2" label="Active Role" checked={roleForm.isActive} onChange={e=>setRoleForm(p=>({...p,isActive:e.target.checked}))}/></Col><Col md={12}><Form.Label>Description</Form.Label><Form.Control value={roleForm.description} onChange={e=>setRoleForm(p=>({...p,description:e.target.value}))}/></Col></Row>
      <div className="d-flex align-items-center justify-content-between mb-2"><strong>Module Permissions</strong><Badge bg="secondary">{roleForm.permissions.length} selected</Badge></div>
      <div className="table-responsive" style={{maxHeight:420,overflowY:'auto'}}><Table bordered hover size="sm" className="align-middle"><thead><tr><th style={{minWidth:175}}>Module</th><th style={{minWidth:105}}>All actions</th><th>Allowed actions</th></tr></thead><tbody>{Object.entries(catalog).map(([module,actions])=>{const all=actions.every(a=>roleForm.permissions.includes(`${module}.${a}`));return <tr key={module}><td className="fw-semibold">{label(module)}</td><td><Form.Check label="Select all" checked={all} onChange={e=>toggleModule(module,e.target.checked)}/></td><td><div className="d-flex flex-wrap gap-3">{actions.map(action=>{const key=`${module}.${action}`;return <Form.Check key={key} type="checkbox" label={label(action)} checked={roleForm.permissions.includes(key)} onChange={e=>togglePermission(key,e.target.checked)}/>})}</div></td></tr>})}</tbody></Table></div>
      <small className="text-muted">Changes apply to users assigned to this role. Backend APIs enforce access independently of the visible buttons.</small>
    </Modal.Body><Modal.Footer><Button variant="outline-secondary" disabled={saving} onClick={()=>setRoleOpen(false)}>Cancel</Button><Button type="submit" disabled={saving} className="primary-btn">{saving?'Saving...':editingRole?'Save Permissions':'Create Role'}</Button></Modal.Footer></Form></Modal>
  </>;
}
