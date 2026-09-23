import { createClient } from '@supabase/supabase-js'
const url=import.meta.env.VITE_SUPABASE_URL
const key=import.meta.env.VITE_SUPABASE_ANON_KEY
export const connected=Boolean(url&&key)
export const supabase=connected?createClient(url,key):null
export async function invoke<T>(name:string, body:Record<string,unknown>):Promise<T> {
 if(!supabase) throw new Error('Connect Supabase to use this action.')
 const {data,error}=await supabase.functions.invoke(name,{body})
 if(error){let message=error.message;try{const response=error.context as Response;const payload=await response?.json();message=payload?.error||message}catch{}throw new Error(message)}
 return data as T
}
