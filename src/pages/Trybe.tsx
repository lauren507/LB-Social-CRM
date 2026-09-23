import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { DataTable, type GridColumn } from '../components/DataTable'
import { invoke } from '../lib/client'
import { mockTrybe } from '../lib/demo'
import { Brand, BRANDS, dateTime, TrybeCreator, trybeName } from '../lib/model'
import { useStore } from '../lib/store'
export function Trybe(){const {brand:slug}=useParams();const brand=BRANDS.includes(slug as Brand)?slug as Brand:'ljco';const {demo,trybe,syncRuns,reload}=useStore();const [busy,setBusy]=useState(false),[localStatus,setLocalStatus]=useState('')
 const data=demo?mockTrybe(brand):trybe.filter(r=>r.brand===brand);const run=syncRuns.find(r=>r.brand===brand)
 const columns=useMemo<GridColumn<TrybeCreator>[]>(()=>[{key:'creator_name',label:'Creator Name',width:240,render:r=><strong>{r.creator_name}</strong>},{key:'joined',label:'Joined',width:170},{key:'program',label:'Program',width:220},{key:'commission',label:'Commission',width:180},{key:'status',label:'Status',width:170,render:r=><span className={`status ${r.status==='Active'?'status-ok':''}`}>{r.status}</span>}],[])
 async function refresh(){setBusy(true);try{if(demo){setLocalStatus(`Last synced ${dateTime(new Date().toISOString())} · mock data`)}else{await invoke('trybe-sync',{brand});await reload()}}catch(err){setLocalStatus(`Sync failed: ${(err as Error).message}`)}finally{setBusy(false)}}
 const status=localStatus||(demo?'Mock data · preview':run?.ok?`Last synced ${dateTime(run.finished_at)}`:run?.ok===false?`Sync failed at ${dateTime(run.finished_at)}: ${run.error}`:'No sync yet')
 return <><div className="page-heading"><div><p className="eyebrow">TRYBE CREATORS / {trybeName[brand].toUpperCase()}</p><h1>{trybeName[brand]} creators <span className="chip chip-accent">API · READ-ONLY</span></h1><p>Pulled from the Trybe affiliate platform. Nobody types into this tab, nothing migrates into it, and it does not feed the Creator Database.</p></div><button className="button" onClick={()=>void refresh()} disabled={busy}><RefreshCw size={16} className={busy?'spinning':''}/>{busy?'Syncing…':'Refresh'}</button></div><div className={`sync-banner ${status.startsWith('Sync failed')?'sync-failed':''}`}><span className="pulse-dot"/><span>{status}</span><span className="sync-right">BRAND ACCOUNT · {trybeName[brand].toUpperCase()}</span></div><section className="panel"><div className="panel-top"><div><p className="eyebrow">AFFILIATE PLATFORM</p><h2>Creator directory</h2></div><span className="panel-count">{data.length} ACTIVE</span></div><DataTable data={data} columns={columns} filename={`${brand}-trybe.csv`} empty="No creators synced. Check the connection in Settings."/><p className="table-legend">This data belongs to Trybe. Changes are made in the affiliate platform.</p></section></>
}
