import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { connected, supabase } from './client'
import { applyOnboarding, demoCreators, readDemo, saveDemo } from './demo'
import { Brand, Creator, OutreachRow, qualifies, TrybeCreator, SyncRun } from './model'
import type { Session } from '@supabase/supabase-js'
interface Store {
 rows:OutreachRow[];creators:Creator[];trybe:TrybeCreator[];syncRuns:SyncRun[];loading:boolean;demo:boolean;
 session:Session|null;role:'admin'|'member';error:string|null;reload:()=>Promise<void>;
 update:(id:string,changes:Partial<OutreachRow>)=>Promise<void>;add:(brand:Brand)=>Promise<void>;remove:(id:string)=>Promise<void>;
 onboard:(data:{full_name:string;handle:string;platform:string;email:string;shipping_address:string;brands:Brand[]})=>Promise<void>;
 importRows:(brand:Brand,rows:Partial<OutreachRow>[])=>Promise<void>;
}
const Context=createContext<Store|null>(null)
export const useStore=()=>{const value=useContext(Context);if(!value)throw new Error('Store unavailable');return value}
export function StoreProvider({children}:{children:ReactNode}) {
 const [session,setSession]=useState<Session|null>(null),[role,setRole]=useState<'admin'|'member'>(connected?'member':'admin')
 const [rows,setRows]=useState<OutreachRow[]>([]),[creators,setCreators]=useState<Creator[]>([]),[trybe,setTrybe]=useState<TrybeCreator[]>([]),[syncRuns,setSyncRuns]=useState<SyncRun[]>([])
 const [loading,setLoading]=useState(connected),[error,setError]=useState<string|null>(null)
 const [sticky,setSticky]=useState<Record<string,string>>({}),[archived,setArchived]=useState<OutreachRow[]>([])
 useEffect(()=>{if(!supabase){const data=readDemo();setRows(data.rows);setSticky(data.sticky);setArchived(data.archived);setLoading(false);return}
 supabase.auth.getSession().then(({data})=>setSession(data.session));const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>setSession(s));return ()=>subscription.unsubscribe()},[])
 useEffect(()=>{if(!connected){setCreators(demoCreators(rows,sticky,archived));saveDemo(rows,sticky,archived)}},[rows,sticky,archived])
 async function reload(){if(!supabase||!session)return;setLoading(true);setError(null)
 const [a,b,c,d,e]=await Promise.all([supabase.from('outreach_rows').select('*').order('updated_at',{ascending:false}),supabase.from('creator_database').select('*'),supabase.from('trybe_creators').select('*').eq('active',true),supabase.from('trybe_sync_runs').select('*').order('started_at',{ascending:false}).limit(30),supabase.from('user_profiles').select('role').eq('user_id',session.user.id).maybeSingle()]);
 const failure=[a.error,b.error,c.error,d.error,e.error].find(Boolean);if(failure)setError(failure.message)
 setRows((a.data||[]) as OutreachRow[]);setCreators((b.data||[]) as Creator[]);setTrybe((c.data||[]) as TrybeCreator[]);setSyncRuns((d.data||[]) as SyncRun[]);setRole(e.data?.role==='admin'?'admin':'member');setLoading(false)}
 useEffect(()=>{if(session)void reload();else if(connected){setRows([]);setCreators([]);setTrybe([]);setLoading(false)}},[session?.access_token])
 const commitDemo=(next:OutreachRow[])=>{setRows(next);setSticky(prev=>{const copy={...prev};next.forEach(r=>{if(qualifies(r)&&!copy[r.id])copy[r.id]=new Date().toISOString()});return copy})}
 async function update(id:string,changes:Partial<OutreachRow>){if(supabase){const {error}=await supabase.from('outreach_rows').update(changes).eq('id',id);if(error)throw error;await reload()}else commitDemo(rows.map(r=>r.id===id?{...r,...changes,updated_at:new Date().toISOString()}:r))}
 async function add(brand:Brand){if(supabase){const {error}=await supabase.from('outreach_rows').insert({brand,created_by:session?.user.id});if(error)throw error;await reload()}else{const {emptyRow}=await import('./demo');commitDemo([emptyRow(brand),...rows])}}
 async function remove(id:string){if(supabase){const {error}=await supabase.from('outreach_rows').delete().eq('id',id);if(error)throw error;await reload()}else{const row=rows.find(r=>r.id===id);if(row&&sticky[id])setArchived([...archived,row]);commitDemo(rows.filter(r=>r.id!==id))}}
 async function onboard(data:{full_name:string;handle:string;platform:string;email:string;shipping_address:string;brands:Brand[]}){if(supabase){const {invoke}=await import('./client');await invoke('onboard',data);await reload()}else commitDemo(applyOnboarding(rows,data))}
 async function importRows(brand:Brand,items:Partial<OutreachRow>[]){if(supabase){const {invoke}=await import('./client');await invoke('import-commit',{brand,rows:items});await reload()}else{const {emptyRow}=await import('./demo');commitDemo([...items.map(item=>({...emptyRow(brand),...item,brand,source:'import'} as OutreachRow)),...rows])}}
 return <Context.Provider value={{rows,creators,trybe,syncRuns,loading,demo:!connected,session,role,error,reload,update,add,remove,onboard,importRows}}>{children}</Context.Provider>
}
