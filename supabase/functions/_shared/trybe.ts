import type {Brand} from './common.ts'
export interface TrybeCreator {trybe_creator_id:string;creator_name:string;joined:string|null;program:string|null;commission:string|null;status:string|null}
export interface TrybeBrandConfig {brand:Brand;apiKey:string;accountId?:string}
export interface TrybeAdapter {fetchCreators(cfg:TrybeBrandConfig):Promise<TrybeCreator[]>;testConnection(cfg:TrybeBrandConfig):Promise<{ok:boolean;message:string}>}
// Endpoint and response mappings are isolated here until Trybe publishes the account's API contract.
export class RealTrybeAdapter implements TrybeAdapter {
 async fetchCreators(cfg:TrybeBrandConfig){const base=Deno.env.get('TRYBE_API_BASE_URL');if(!base)throw new Error('TRYBE_API_BASE_URL is not configured');const url=new URL('/creators',base);if(cfg.accountId)url.searchParams.set('account_id',cfg.accountId)
 const res=await fetch(url,{headers:{Authorization:`Bearer ${cfg.apiKey}`,Accept:'application/json'},signal:AbortSignal.timeout(15000)});if(!res.ok)throw new Error(`Trybe HTTP ${res.status}`)
 const body=await res.json();const records=Array.isArray(body)?body:body.data?.creators||body.creators||body.data;if(!Array.isArray(records))throw new Error('Unexpected Trybe creator response');return records.map((c:Record<string,unknown>)=>({trybe_creator_id:String(c.id??c.creator_id),creator_name:String(c.name??c.creator_name??''),joined:String(c.joined_at??c.joined??'').slice(0,10)||null,program:String(c.program??'')||null,commission:String(c.commission??'')||null,status:String(c.status??'')||null})) }
 async testConnection(cfg:TrybeBrandConfig){try{const rows=await this.fetchCreators(cfg);return {ok:true,message:`Connected. Found ${rows.length} creators.`}}catch(e){return {ok:false,message:(e as Error).message}}}
}
export class MockTrybeAdapter implements TrybeAdapter {
 async fetchCreators(cfg:TrybeBrandConfig){const names=['Avery Morgan','Casey Brooks','Taylor Reed','Morgan Blake','Alex Rivera','Jamie Park','Cameron Wells','Parker Lane','Quinn Harper','Bailey Stone'];return names.map((name,i)=>({trybe_creator_id:`${cfg.brand}-${1001+i}`,creator_name:name,joined:`2026-${String(1+i%8).padStart(2,'0')}-${String(10+i).padStart(2,'0')}`,program:i%3?'Affiliate':'Ambassador',commission:`${10+i%3*5}%`,status:i%4?'Active':'Pending'}))}
 async testConnection(_cfg:TrybeBrandConfig){return {ok:true,message:'Mock adapter is available.'}}
}
export const adapter=():TrybeAdapter=>Deno.env.get('TRYBE_USE_MOCK')==='true'?new MockTrybeAdapter():new RealTrybeAdapter()
