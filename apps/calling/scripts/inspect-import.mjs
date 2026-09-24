import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { createServer } from 'vite'
const file=process.argv[2]
if(!file)throw new Error('Usage: npm run import:preview -- <private HTML or JSON path>')
const source=fs.readFileSync(file,'utf8')
const vite=await createServer({server:{middlewareMode:true}})
try {
 const {parseImport}=await vite.ssrLoadModule('/shared/import.ts')
 const rows=parseImport(source)
 console.log(JSON.stringify({sha256:createHash('sha256').update(source).digest('hex'),contacts:rows.length,uniqueSourceIds:new Set(rows.map(r=>r.source_id)).size,withPhone:rows.filter(r=>r.phones.length).length,withEmail:rows.filter(r=>r.email).length},null,2))
}finally{await vite.close()}
