import {createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import api from '../api/client';

const Context=createContext(null);
export function AuthProvider({children}){
  const [user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem('po_user'))}catch{return null}});
  const login=async(email,password)=>{
    const {data}=await api.post('/auth/login',{email,password});
    localStorage.setItem('po_token',data.token);
    localStorage.setItem('po_user',JSON.stringify(data.user));
    setUser(data.user);return data.user;
  };
  const logout=()=>{localStorage.removeItem('po_token');localStorage.removeItem('po_user');setUser(null);};
  const refreshPermissions=useCallback(async()=>{
    if(!localStorage.getItem('po_token'))return;
    const {data}=await api.get('/auth/me');
    if(data?.user){localStorage.setItem('po_user',JSON.stringify(data.user));setUser(data.user);}
  },[]);
  useEffect(()=>{if(user)refreshPermissions().catch(()=>{});},[]);
  const hasPermission=useCallback(key=>Boolean(user?.role==='ADMIN'||user?.permissions?.includes(key)),[user]);
  // Legacy role guard retained only for existing buttons not yet converted to permission keys.
  const can=useCallback(required=>!required||required.length===0||(Array.isArray(required)?required.some(k=>k.includes('.')?hasPermission(k):k===user?.role):hasPermission(required)),[user,hasPermission]);
  const value=useMemo(()=>({user,login,logout,can,hasPermission,refreshPermissions}),[user,can,hasPermission,refreshPermissions]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useAuth=()=>useContext(Context);
