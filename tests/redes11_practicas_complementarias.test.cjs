'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('partials/guia-redes11-rap01-content.html');
const section=html.slice(html.indexOf('<section id="r11-practicas-complementarias"'),html.indexOf('</section>',html.indexOf('<section id="r11-practicas-complementarias"')));
test('practicas 2 y 3 reutilizan escenarios, direccionamiento y preguntas existentes de grado 10',()=>{
 const source=read('partials/guia-redes-rap01-content.html');
 for(const needle of ['Boyc&aacute;Tech','192.168.1.0/24','192.168.20.0/24','fibra &oacute;ptica']){assert.ok(source.includes(needle),needle+' existe en fuente');assert.ok(section.includes(needle),needle+' reutilizado');}
 assert.match(section,/data-r11-complementary-lab="2"/);assert.match(section,/data-r11-complementary-lab="3"/);
 assert.match(section,/Topología de árbol/);assert.match(section,/Topología híbrida estrella-árbol/);
 assert.equal((section.match(/Preguntas para su cuaderno/g)||[]).length,2);
});
test('practicas opcionales no tienen guardado, carga, campos, fechas o registro academico',()=>{
 assert.match(section,/No añade calificaciones, no modifica el avance ni el RAP oficial/);
 assert.doesNotMatch(section,/<(?:textarea|input|select)\b|data-store|data-track|data-act-std|data-drive-panel|subirPantallazo|guardarLab|subirEntregaFinal|DeadlineControls|style=/i);
 const guides=[];vm.runInNewContext(read('js/guide_declarations.js'),{window:{ActivityStandard:{registerGuide:c=>guides.push(c)}}});
 for(const g of ['11a','11b']){
  const f=`grupo-${g}-guia-09-redes-rap01.html`,cfg=guides.find(c=>c.files.includes(f));
  assert.equal(cfg.activities.length,13);assert.ok(!cfg.activities.some(a=>/complementary|lab2|lab3/i.test(a.id)));
 }
});
test('bundle compartido 11A/11B contiene exactamente el HTML fuente de las practicas',()=>{
 const w={};vm.runInNewContext(read('partials/guia-redes11-rap01-bundle.js'),{window:w});
 assert.equal(w.__PAGE_RUNTIME_PARTIALS__['partials/guia-redes11-rap01-content.html'],html);
 for(const g of ['11a','11b'])assert.match(read(`pages/guias/grupo-${g}-guia-09-redes-rap01.html`),/guia-redes11-rap01-bundle\.js\?v=20261109_2/);
});
