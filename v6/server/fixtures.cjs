'use strict';
// Fictitious identities only. Never use these fixture tokens outside loopback tests.
module.exports={directory:{
 'test-a':{enabled:true,role:'student',user:'APRENDIZ_A',ficha:'TEST_A'},
 'test-b':{enabled:true,role:'student',user:'APRENDIZ_B',ficha:'TEST_B'},
 'test-instructor':{enabled:true,role:'instructor',user:'INSTRUCTOR_PRUEBA',fichas:['TEST_A']}
},verifyToken:async token=>({'fixture-token-a':{uid:'test-a'},'fixture-token-b':{uid:'test-b'},'fixture-token-instructor':{uid:'test-instructor'}}[token]||null)};
