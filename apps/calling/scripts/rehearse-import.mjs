// Local, ephemeral rehearsal. No contact data is written to disk or printed.
import { readFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { PGlite } from '@electric-sql/pglite'
const file=process.argv[2]
if(!file)throw new Error('Usage: npm run import:rehearse -- <private source file>')
const source=await readFile(file,'utf8'),sha256=createHash('sha256').update(source).digest('hex')
const vite=await createServer({server:{middlewareMode:true}}),db=new PGlite()
try {
 const {parseImport}=await vite.ssrLoadModule('/shared/import.ts'),rows=parseImport(source)
 await db.exec('create role anon;create role authenticated;create role service_role;')
 await db.exec(await readFile(new URL('../supabase/migrations/001_calling.sql',import.meta.url),'utf8'))
 await db.query("select public.crm_create_session('rehearsal','rehearsal','admin','v1')")
 const rpc=async(action,args={})=>(await db.query("select public.crm_request('rehearsal','v1',$1,$2::jsonb) result",[action,JSON.stringify(args)])).rows[0].result
 const preview=await rpc('import.preview',{sourceHash:sha256,rows})
 const review=preview.preview.filter(r=>r.action==='review').length
 if(review)throw new Error(review+' ambiguous rows need review; rehearsal stopped before import.')
 const first=await rpc('import.confirm',{id:preview.id})
 assert.equal(first.inserted,rows.length)
 const contacts=await rpc('contacts.list',{view:'all'}),contact=contacts.find(c=>c.phones.length)
 if(contact){
  for(const outcome of ['interested','bad_number']){
   const id=randomUUID();await rpc('draft.ensure',{id,contactId:contact.id})
   const draft=await rpc('draft.update',{id,revision:1,mutationId:randomUUID(),rawText:'Synthetic rehearsal only.',phoneId:contact.phones[0].id,fields:{summary:'Synthetic rehearsal only.',outcome,nextAction:outcome==='interested'?'Synthetic follow-up':'',followUpDate:outcome==='interested'?'2026-10-01':''}})
   const current=await rpc('contact.get',{contactId:contact.id})
   await rpc('draft.save',{id,revision:draft.revision,completeFollowUp:false,expectedFollowUp:{nextAction:current.next_action,followUpDate:current.follow_up_date,lastCalledAt:current.last_called_at}})
  }
  const second=contacts.find(c=>c.id!==contact.id)
  if(second)await db.query("insert into crm.contact_state(contact_id,workspace_id,do_not_call) values($1,'shared',true)",[second.id])
 }
 const snapshot=async()=>JSON.stringify((await db.query("select (select jsonb_agg(to_jsonb(a) order by id) from crm.activities a) calls,(select jsonb_agg(to_jsonb(s) order by contact_id) from crm.contact_state s) state,(select jsonb_agg(to_jsonb(p) order by id) from crm.phones p) phones")).rows)
 const before=await snapshot()
 assert.deepEqual(await rpc('import.confirm',{id:preview.id}),first)
 const update=await rpc('import.preview',{sourceHash:sha256+'-local-rehearsal-update',rows})
 assert.equal((await rpc('import.confirm',{id:update.id})).updated,rows.length)
 assert.equal(await snapshot(),before)
 assert.equal((await rpc('contacts.list',{view:'all'})).length,rows.length)
 console.log(JSON.stringify({sha256,contacts:rows.length,phones:(await db.query('select count(*)::int n from crm.phones')).rows[0].n,withoutPhone:rows.filter(r=>!r.phones.length).length,identityReviewRows:review,repeatedImport:'passed',historyFollowupsFlags:'preserved',database:'local ephemeral rehearsal only'},null,2))
} finally {await vite.close();await db.close()}
