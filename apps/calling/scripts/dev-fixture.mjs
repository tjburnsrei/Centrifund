// Synthetic local test system only. Never enabled in Vercel or production.
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
if(process.env.VERCEL||process.env.APP_ENV==='production')throw new Error('Fixtures are local-development only.')
const db=new PGlite()
await db.exec('create role anon; create role authenticated; create role service_role;')
await db.exec(await readFile(new URL('../supabase/migrations/001_calling.sql',import.meta.url),'utf8'))
const rpcNames={crm_request:['p_session_hash','p_password_version','p_action','p_args'],crm_rate_limit:['p_bucket','p_max','p_seconds'],crm_create_session:['p_token_hash','p_owner_id','p_role','p_password_version'],crm_audio_cleanup:['p_completed']}
const fake=http.createServer(async(req,res)=>{
 try{
  let text='';for await(const chunk of req)text+=chunk
  const name=req.url.split('/').at(-1),keys=rpcNames[name]
  if(!keys){res.writeHead(501,{'Content-Type':'application/json'});res.end(JSON.stringify({message:'This external service is not simulated.'}));return}
  const args=JSON.parse(text)
  const values=keys.map(k=>typeof args[k]==='object'&&k!=='p_completed'?JSON.stringify(args[k]):args[k])
  const result=await db.query('select public.'+name+'('+keys.map((_,i)=>'$'+(i+1)).join(',')+') result',values)
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result.rows[0].result))
 }catch(error){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({message:error.message}))}
})
await new Promise(resolve=>fake.listen(54335,'127.0.0.1',resolve))
Object.assign(process.env,{APP_ENV:'development',APP_ORIGIN:'http://localhost:5180',SUPABASE_URL:'http://127.0.0.1:54335',SUPABASE_SERVICE_ROLE_KEY:'synthetic-local-only',CALLER_PASSWORD:'demo-password',SESSION_SECRET:'synthetic-local-session-secret-for-tests-only',ADMIN_EMAILS:'admin@example.invalid'})
const records=[
 {name:'Casey Example',company:'Harbor Example Homes',city:'Richmond, VA',email:'casey@example.invalid',loans:8,lender:'Example Lending',phone:'202-555-0141'},
 {name:'River Example',company:'Northline Example Properties',city:'Raleigh, NC',email:'river@example.invalid',loans:3,lender:'Example Capital',phone:'202-555-0163'},
 {name:'Morgan Example',company:'Example Renovations',city:'Baltimore, MD',email:'morgan@example.invalid',loans:5,lender:'Example Funding',phone:'202-555-0198'},
 {name:'No Phone Example',company:'Example Holdings',city:'Norfolk, VA',email:'',loans:1,lender:'',phone:''}
]
for(const r of records){
 const id=randomUUID();await db.query("insert into crm.contacts(id,owner_workspace,name,company,city,email,background) values($1,'zendra',$2,$3,$4,$5,$6)",[id,r.name,r.company,r.city,r.email,JSON.stringify({loans12:r.loans,size:325000,lender:r.lender,projects:[['Synthetic project','Richmond, VA','Example only']]})])
 await db.query("insert into crm.contact_access values($1,'shared'),($1,'zendra')",[id])
 if(r.phone)await db.query("insert into crm.phones(contact_id,value,normalized) values($1,$2,$3)",[id,r.phone,'1'+r.phone.replace(/\D/g,'')])
}
console.log('Synthetic calling preview. Password: demo-password. No real contacts or AI responses are loaded.')
await import('./dev.mjs')
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{fake.close();void db.close()})
