
document.getElementById('load').addEventListener('click',async()=>{
 const status=document.getElementById('status');status.textContent='Consultando…';
 try{const response=await fetch('/v6/tracking?ficha=TEST_A',{headers:{Authorization:'Bearer fixture-token-instructor'},redirect:'error'});if(!response.ok)throw Error('No se pudo consultar.');
 const rows=HardwareLab.TrackingV6.project(await response.json()),body=document.getElementById('rows');body.replaceChildren();
 for(const r of rows){const tr=document.createElement('tr');for(const k of ['uid','ficha','profile','practice','active','completed','conflicts','bestProposedScore','lastProposedScore','updatedAt']){const td=document.createElement('td');td.textContent=r[k]??'—';tr.append(td);}body.append(tr);}status.textContent=rows.length+' prácticas. Sin modificaciones académicas.';
 }catch(_){status.textContent='No se pudo consultar el seguimiento de prueba.';}
});
