import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { StoreProvider, useStore } from './lib/store'
import { Shell } from './components/Shell'
import { Outreach } from './pages/Outreach'
import { Creators } from './pages/Creators'
import { Trybe } from './pages/Trybe'
import { Onboard } from './pages/Onboard'
import { Settings } from './pages/Settings'
import { ImportPage } from './pages/Import'
import { Reference } from './pages/Reference'
import './style.css'
function DefaultRoute(){let last='/outreach/ljco';try{const stored=localStorage.getItem('lb-last-tab');if(stored&&/^\/(trybe|outreach|creators|reference|settings|import)(\/|$)/.test(stored))last=stored}catch{}return <Navigate to={last} replace/>}
function Admin({children}:{children:React.ReactNode}){const {role}=useStore();return role==='admin'?children:<div className="access-denied"><h1>Admin access required</h1><p>This area is available to administrators.</p></div>}
createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><StoreProvider><Routes><Route path="/onboard" element={<Onboard/>}/><Route element={<Shell/>}><Route index element={<DefaultRoute/>}/><Route path="/outreach/:brand" element={<Outreach/>}/><Route path="/trybe/:brand" element={<Trybe/>}/><Route path="/creators" element={<Creators/>}/><Route path="/reference" element={<Reference/>}/><Route path="/settings" element={<Admin><Settings/></Admin>}/><Route path="/import" element={<Admin><ImportPage/></Admin>}/><Route path="*" element={<Navigate to="/outreach/ljco" replace/>}/></Route></Routes></StoreProvider></BrowserRouter></React.StrictMode>)
