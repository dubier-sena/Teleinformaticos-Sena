'use strict';
const http=require('node:http'),path=require('node:path'),fs=require('node:fs');
const {createService,FileRepository}=require('./service.cjs'),fixtures=require('./fixtures.cjs');
async function start({port=8796,dataFile=path.join(__dirname,'../../.v6-test-data/state.json'),service:provided,apiOnly=false}={}){
 const service=provided||await createService({repository:new FileRepository(dataFile),...fixtures});
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self' data: blob:; connect-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'; form-action 'self'");
  // No CORS and no production routes. Reject cross-origin browser submissions.
  if(req.headers.origin&&req.headers.origin!==`http://127.0.0.1:${port}`){res.writeHead(403);res.end('{"error":"ORIGIN"}');return;}
  try{
   const token=(req.headers.authorization||'').replace(/^Bearer /,'');let raw='';
   for await(const chunk of req){raw+=chunk; if(Buffer.byteLength(raw)>720*1024)throw Error('SIZE');}
   let result;const u=new URL(req.url,`http://127.0.0.1:${port}`);
   if(req.method==='GET'&&!u.pathname.startsWith('/v6/checkpoints')&&!u.pathname.startsWith('/v6/tracking')&&!u.pathname.startsWith('/v6/access/')){
    if(apiOnly)throw Error('NOT_FOUND');
    const root=path.resolve(__dirname,'../..');let content,type='text/html; charset=utf-8';
    if(u.pathname==='/laboratorio-virtual-hardware.html'){
     content=fs.readFileSync(path.join(root,'laboratorio-virtual-hardware.html'),'utf8');
     content=content.replace(/<script[^>]*src="(?:https:[^"]*|js\/(?:firebase[^"?]*|portal_auth|drive_db)[^"]*)"[^>]*><\/script>/g,'');
     const who=u.searchParams.get('user')==='b'?'b':'a',p=fixtures.directory['test-'+who];
     const prelude=`<script>window.HWLAB_V6_TEST=${JSON.stringify({endpoint:'/v6/checkpoints',token:'fixture-token-'+who})};window.portalAuth={getCurrentSession:()=>(${JSON.stringify({role:'student',user:{usernameKey:p.user,uid:'test-'+who,ficha:p.ficha}})}),getFichaInfo:()=>({optionalModules:{hardwareLab:true}})};</script>`;
     content=content.replace('</head>',prelude+'</head>');
    }else if(u.pathname==='/')content='<h1>V6 · entorno contractual ficticio</h1><p>No es Firebase ni producción.</p><a href="/laboratorio-virtual-hardware.html?user=a">APRENDIZ_A</a><br><a href="/laboratorio-virtual-hardware.html?user=b">APRENDIZ_B</a><br><a href="/instructor">INSTRUCTOR_PRUEBA</a>';
    else if(u.pathname==='/instructor')content=fs.readFileSync(path.join(root,'v6/tracking.html'));
    else{
     const allowed=/^\/(?:css\/[a-zA-Z0-9_./-]+\.css|js\/(?:hardware_lab_[a-zA-Z0-9_]+|shared_utils|global_error_handler|save_status|shared_shell)\.js|js\/vendor\/[a-zA-Z0-9_./-]+\.js)$/;
     const file=path.resolve(root,'.'+u.pathname);if(!allowed.test(u.pathname)||!file.startsWith(root+path.sep)||u.pathname.includes('..'))throw Error('NOT_FOUND');
     content=fs.readFileSync(file);type=u.pathname.endsWith('.css')?'text/css':'text/javascript';
    }res.setHeader('Content-Type',type);res.end(content);return;
   }
   if(req.method==='POST'&&u.pathname==='/v6/access/revoke'&&service.revokeAccess)result=await service.revokeAccess(token,JSON.parse(raw));
   else if(req.method==='POST'&&u.pathname==='/v6/checkpoints')result=await service.send(token,JSON.parse(raw));
   else if(req.method==='GET'&&u.pathname==='/v6/checkpoints')result=await service.list(token,u.searchParams.get('profile'));
   else if(req.method==='GET'&&u.pathname==='/v6/tracking')result=await service.tracking(token,u.searchParams.get('ficha'));
   else{res.writeHead(404);res.end('{"error":"NOT_FOUND"}');return;}
   res.end(JSON.stringify(result));
  }catch(e){res.writeHead(400);res.end(JSON.stringify({error:e.code||e.message}));}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});return server;
}
if(require.main===module)start().then(()=>console.log('V6 fixture gateway: http://127.0.0.1:8796 (not Firebase)')).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={start};
