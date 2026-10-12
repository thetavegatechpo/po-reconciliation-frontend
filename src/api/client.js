import axios from 'axios';
export const API_URL=import.meta.env.VITE_API_URL||'http://localhost:5000/api';
export const FILE_BASE=API_URL.replace(/\/api\/?$/,'');
const api=axios.create({baseURL:API_URL,timeout:30000});
api.interceptors.request.use(config=>{const token=localStorage.getItem('po_token');if(token)config.headers.Authorization=`Bearer ${token}`;return config;});
api.interceptors.response.use(r=>r,err=>{if(err.response?.status===401){localStorage.removeItem('po_token');localStorage.removeItem('po_user');if(!location.pathname.includes('/login'))location.href='/login';}return Promise.reject(err);});
export const fileUrl=(path)=>path?`${FILE_BASE}${path}`:'#';
export default api;
