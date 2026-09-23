export type Brand = 'ljco' | 'pumps' | 'gym_snack'
export const BRANDS: Brand[] = ['ljco','pumps','gym_snack']
export const brandName: Record<Brand,string> = { ljco:'Louisville Jerky', pumps:'Pumps', gym_snack:'Gym Snack' }
export const trybeName: Record<Brand,string> = { ljco:'LJCo', pumps:'Pumps', gym_snack:'Gym Snack' }
export const PLATFORM = ['TikTok','Instagram','YouTube','Other']
export const CONTACT = ['Not Contacted','Contacted','Replied','Interested','Declined','Onboarded']
export const DELIVERABLE = ['Not Started','In Progress','Submitted','Needs Revision','Approved','Posted','Complete']
export const CARRIER = ['USPS','UPS','FedEx','DHL','Other']
export interface OutreachRow {
  id: string; brand: Brand; creator_name: string|null; date_first_contacted: string|null;
  handle_raw: string|null; handle_normalized: string; platform: string|null; followers: number|null;
  email: string|null; segments: string[]; contact_status: string; deliverable_ask: string|null;
  shipping_address: string|null; product_sku_sent: string|null; tracking_carrier: string|null;
  tracking_number: string|null; tracking_est_delivery: string|null; tracking_delivered: boolean;
  deliverable_status: string; content_link: string|null; date_posted: string|null;
  partnership_terms: string|null; ad_code: string|null; notes: string|null;
  source: string; created_at: string; updated_at: string;
}
export interface Creator {
  creator_key: string; creator_name: string|null; handle: string|null; platform: string|null;
  email: string|null; address: string|null; brand_tags: Brand[]; first_qualified_at: string;
  last_updated_at: string;
}
export interface TrybeCreator { id: string; brand: Brand; trybe_creator_id: string; creator_name: string|null; joined: string|null; program: string|null; commission: string|null; status: string|null; active: boolean }
export interface SyncRun { brand: Brand; started_at: string; finished_at: string|null; ok: boolean|null; rows_upserted: number|null; error: string|null }
export const normalizeHandle = (value: string) => value.trim().replace(/^@+/, '').toLowerCase()
export const identityKey = (row: Pick<OutreachRow,'email'|'handle_raw'|'id'>) => row.email?.trim().toLowerCase() || (normalizeHandle(row.handle_raw || '') ? `h:${normalizeHandle(row.handle_raw || '')}` : `row:${row.id}`)
export const qualifies = (row: Pick<OutreachRow,'shipping_address'|'deliverable_status'>) => Boolean(row.shipping_address?.trim()) && ['Submitted','Approved','Posted','Complete'].includes(row.deliverable_status)
export const hasPostedWarning = (row: OutreachRow) => Boolean(row.content_link || row.date_posted) && ['Not Started','In Progress'].includes(row.deliverable_status)
export const emailValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
export function csv(rows: Record<string,unknown>[], columns: {key:string;label:string}[]) {
 const quote = (v:unknown) => `"${String(Array.isArray(v)?v.join('; '):v ?? '').replaceAll('"','""')}"`
 return [columns.map(c=>quote(c.label)).join(','), ...rows.map(r=>columns.map(c=>quote(r[c.key])).join(','))].join('\r\n')
}
export function downloadCsv(filename:string, text:string) {
 const url = URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}))
 const anchor=document.createElement('a'); anchor.href=url; anchor.download=filename; anchor.click(); setTimeout(()=>URL.revokeObjectURL(url),1000)
}
export const dateTime = (s?:string|null) => s ? new Date(s).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'Never'
export function fieldWarnings(row:OutreachRow, peers:OutreachRow[]) {
 const warnings:string[]=[]
 if (qualifies(row) && !row.email) warnings.push("Qualifies but can't be de-duplicated; add an email.")
 if (hasPostedWarning(row)) warnings.push('Content looks posted; update Deliverable Status so the gate can see it.')
 if (peers.some(other=>other.id!==row.id && ((row.email && other.email?.toLowerCase()===row.email.toLowerCase()) || (row.handle_normalized && other.handle_normalized===row.handle_normalized)))) warnings.push('Possible duplicate Email or Handle on this brand.')
 return warnings
}
