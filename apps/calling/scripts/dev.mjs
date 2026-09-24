import { createServer } from 'vite'
import http from 'node:http'
const vite=await createServer()
const api=http.createServer(async(req,res)=>{
 try { const {default:handler}=await vite.ssrLoadModule('/server/node-adapter.ts');await handler(req,res) }
 catch(error){vite.ssrFixStacktrace(error);console.error('Local API failed:',error.name);res.statusCode=500;res.end('Local API failed.')}
})
api.listen(5181,'127.0.0.1')
await vite.listen()
vite.printUrls()
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{api.close();void vite.close()})
