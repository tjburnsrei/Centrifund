// Private operator tool: never deployed as an endpoint. Keep credentials in .env.admin.local.
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
async function main() {
const usage='Usage: npm run admin -- --project <Supabase project ref> health|list|show <id>|import-preview <source>|import-confirm <review file> <sha256>|apply <action JSON file>'
const args=process.argv.slice(2), projectIndex=args.indexOf('--project')
if(projectIndex<0||!args[projectIndex+1])throw new Error(usage)
const project=args.splice(projectIndex,2)[1], [command,...values]=args
if(!['health','list','show','import-preview','import-confirm','apply'].includes(command))throw new Error(usage)
const target=new URL(process.env.SUPABASE_URL||'http://missing.invalid')
if(target.origin!=='https://'+project+'.supabase.co'||target.username||target.password)throw new Error('Project reference does not match SUPABASE_URL. No connection made.')
if(!process.env.SUPABASE_SECRET_KEY&&!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Set the private service key in .env.admin.local.')
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'), outputDir=resolve(root,'private-imports')
let input
if(command==='show')input=values[0]
if(command==='import-preview')input=await readFile(values[0],'utf8')
if(command==='apply')input=JSON.parse(await readFile(values[0],'utf8'))
if(command==='import-confirm'){
 const review=JSON.parse(await readFile(values[0],'utf8'))
 if(review.project!==project||review.sourceHash!==values[1])throw new Error('Review project or exact checksum does not match. No changes made.')
 input={id:review.id,sourceHash:values[1]}
}
const vite=await createServer({root,server:{middlewareMode:true},logLevel:'silent'})
try {
 const {maintain}=await vite.ssrLoadModule('/server/maintenance.ts')
 const result=await maintain(command,input)
 if(['list','show','import-preview','apply'].includes(command)){
  await mkdir(outputDir,{recursive:true})
  const file=resolve(outputDir,command+'-'+Date.now()+'.json')
  await writeFile(file,JSON.stringify(command==='import-preview'?{project,...result}:{project,data:result},null,2),{flag:'wx',mode:0o600})
  console.log(JSON.stringify({project,reviewFile:file,...(command==='import-preview'?{sha256:result.sourceHash,rows:result.preview.length,requiresReview:result.preview.filter(row=>row.action==='review').length}:{})},null,2))
 }else console.log(JSON.stringify({project,result},null,2))
} catch(error) {
 console.error('Maintenance failed. Review the selected project, input, and schema. Code: '+(error.code||error.name||'UNAVAILABLE'))
 process.exitCode=1
} finally {await vite.close()}

}
await main().catch(error => {
 console.error('Maintenance could not start. Check --project, SUPABASE_URL, the private service key and input files. Code: '+(error.code||error.name||'CONFIGURATION'))
 process.exitCode=1
})
