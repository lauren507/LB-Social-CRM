import { Brand, CONTACT, DELIVERABLE, normalizeHandle, OutreachRow } from './model'
export function parseCsv(text:string):string[][] {const rows:string[][]=[];let row:string[]=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++}else if(c==='"')quoted=false;else field+=c}else if(c==='"')quoted=true;else if(c===','){row.push(field);field=''}else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field=''}else field+=c}if(field||row.length){row.push(field);rows.push(row)}return rows}
const aliases:Record<string,string>={'restrictions':'partnership_terms','paid?':'partnership_terms','running?':'ad_code','date of shipment':'notes','recieved?':'deliverable_status','recieved video':'deliverable_status','quality':'deliverable_status','outcome':'deliverable_status',username:'handle_raw',link:'handle_raw','contact name':'creator_name',follwers:'followers',followers:'followers',niche:'segments','contact status':'contact_status',status:'contact_status',response:'contact_status','samples request?':'deliverable_ask','location contacted':'notes',carrier:'tracking_carrier','tracking #':'tracking_number','est. delivery date':'tracking_est_delivery','delivered?':'tracking_delivered',delivered:'tracking_delivered','date posted':'date_posted','content link':'content_link','shipping address':'shipping_address',email:'email',handle:'handle_raw','creator name':'creator_name',platform:'platform',notes:'notes','product / sku sent':'product_sku_sent','deliverable / ask':'deliverable_ask','date first contacted':'date_first_contacted','ad code':'ad_code',segments:'segments','partnership terms':'partnership_terms','deliverable status':'deliverable_status'}
const drop=new Set(['views','likes','followers amount before outreach','1162'])
export function suggestColumn(header:string,_index:number,source:string):string {const key=header.trim().toLowerCase();if(!key&&source==='GS Collabs')return 'unknown';return aliases[key]|| (drop.has(key)?'drop':'unknown')}
export function statusSuggestion(value:string,kind:'contact'|'deliverable'):string|undefined {const lower=value.trim().toLowerCase();if(!lower)return undefined;const choices=kind==='contact'?CONTACT:DELIVERABLE;const exact=choices.find(c=>c.toLowerCase()===lower);if(exact)return exact
 if(kind==='contact'){if(/declin|no thank|not interested/.test(lower))return 'Declined';if(/onboard|signed/.test(lower))return 'Onboarded';if(/interested|yes/.test(lower))return 'Interested';if(/repli|respond|response/.test(lower))return 'Replied';if(/reach|contact|sent|dm/.test(lower))return 'Contacted'}
 else {if(/complete|finish/.test(lower))return 'Complete';if(/post|live/.test(lower))return 'Posted';if(/approv|good/.test(lower))return 'Approved';if(/revision|redo/.test(lower))return 'Needs Revision';if(/receiv|submit|video/.test(lower))return 'Submitted';if(/progress|ship|working/.test(lower))return 'In Progress'}return undefined}
export type Mapping=Record<number,string>
export function mapRow(values:string[],headers:string[],mapping:Mapping,brand:Brand,statusMap:Record<string,string>):Partial<OutreachRow>&{_warnings:string[]} {
 const result:Record<string,unknown>={brand,source:'import'},warnings:string[]=[];const note:string[]=[];const terms:string[]=[];let code='',running='';const originalStatuses:string[]=[]
 for(let i=0;i<headers.length;i++){const value=values[i]?.trim();if(!value)continue;const raw=headers[i].trim().toLowerCase(),target=mapping[i];if(target==='drop'||target==='unknown'||!target)continue
 if(raw==='paid?'||raw==='restrictions'){terms.push(`${raw==='paid?'?'Paid':'Restrictions'}: ${value}`);continue}
 if(raw==='running?'){running=value;continue}
 if(raw==='location contacted'){note.push(`Contacted via: ${value}`);continue}
 if(raw==='samples request?'){result.deliverable_ask=`${result.deliverable_ask?result.deliverable_ask+'; ':''}Samples requested: ${value}`;continue}
 if(raw==='date of shipment'){note.push(`Ship date: ${value}`);continue}
 if(['recieved?','recieved video','quality','outcome'].includes(raw)){originalStatuses.push(`${headers[i]}: ${value}`);const option=statusMap[`deliverable:${value}`]||statusSuggestion(value,'deliverable');if(option)result.deliverable_status=option;continue}
 if(raw==='notes'){note.push(value);continue}
 if(target==='contact_status'||target==='deliverable_status'){const kind=target==='contact_status'?'contact':'deliverable';const option=statusMap[`${kind}:${value}`]||statusSuggestion(value,kind);if(option)result[target]=option;else warnings.push(`Map ${kind} status: ${value}`);note.push(`Original ${headers[i]}: ${value}`);continue}
 if(target==='tracking_delivered'){result.tracking_delivered=/^(yes|true|1|delivered)$/i.test(value);continue}
 if(target==='segments'){result.segments=value.split(/[,;|]/).map(v=>v.trim()).filter(Boolean);continue}
 if(target==='followers'){const n=Number(value.replace(/[^0-9]/g,''));if(Number.isFinite(n))result.followers=n;continue}
 if(target==='ad_code'){code=value;continue}
 if(target==='handle_raw'&&result.handle_raw)continue
 result[target]=value
 }
 if(terms.length)result.partnership_terms=[result.partnership_terms,terms.join('. ')].filter(Boolean).join('. ')
 if(code||running)result.ad_code=`${running?`[${/^(yes|active|running)$/i.test(running)?'RUNNING':'NOT RUNNING'}] `:''}${code}`.trim()
 if(originalStatuses.length)note.push(`Original deliverable details: ${originalStatuses.join('; ')}`)
 if(note.length)result.notes=[result.notes,...note].filter(Boolean).join('\n')
 if(!result.handle_raw)warnings.push('Needs handle')
 if(!result.tracking_carrier&&result.tracking_number)warnings.push('Carrier unknown')
 return {...result,_warnings:warnings} as Partial<OutreachRow>&{_warnings:string[]}
}
export function duplicatesOf(row:Partial<OutreachRow>,others:Partial<OutreachRow>[]):boolean {return others.some(other=>Boolean((row.email&&other.email&&row.email.toLowerCase()===other.email.toLowerCase())||(row.handle_raw&&other.handle_raw&&normalizeHandle(row.handle_raw)===normalizeHandle(other.handle_raw))))}
