import { createClient } from 'npm:@supabase/supabase-js@2'
export const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-cron-secret','Access-Control-Allow-Methods':'POST, OPTIONS'}
export const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}})
export const service=()=>createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
export async function staff(req:Request,admin=false){const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');if(!token)return null;const db=service();const {data:{user},error}=await db.auth.getUser(token);if(error||!user?.email?.toLowerCase().endsWith(`@${Deno.env.get('ALLOWED_EMAIL_DOMAIN')||'louisvillebrands.com'}`))return null;const {data}=await db.from('user_profiles').select('role').eq('user_id',user.id).single();if(!data||admin&&data.role!=='admin')return null;return user}
export type Brand='ljco'|'pumps'|'gym_snack'
export const brands:Brand[]=['ljco','pumps','gym_snack']
export function isBrand(value:unknown):value is Brand{return brands.includes(value as Brand)}
const keyMaterial=()=>Deno.env.get('INTEGRATION_ENCRYPTION_KEY')||''
async function cryptoKey(){const secret=keyMaterial();if(secret.length<32)throw new Error('INTEGRATION_ENCRYPTION_KEY must be at least 32 characters');const bytes=new TextEncoder().encode(secret);const digest=await crypto.subtle.digest('SHA-256',bytes);return crypto.subtle.importKey('raw',digest,'AES-GCM',false,['encrypt','decrypt'])}
export async function encrypt(text:string){const iv=crypto.getRandomValues(new Uint8Array(12)),value=await crypto.subtle.encrypt({name:'AES-GCM',iv},await cryptoKey(),new TextEncoder().encode(text));return `${btoa(String.fromCharCode(...iv))}.${btoa(String.fromCharCode(...new Uint8Array(value)))}`}
export async function decrypt(cipher:string){const [iv,data]=cipher.split('.');const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(atob(iv),c=>c.charCodeAt(0))},await cryptoKey(),bytes);return new TextDecoder().decode(plain)}
