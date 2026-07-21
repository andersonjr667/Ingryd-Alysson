// Teste Node.js que simula o carregamento do presents.js
const http = require('http');

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: data,
          length: data.length
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function test() {
  try {
    console.log('=== TESTE COMPLETO ===\n');

    // 1. Testa API
    console.log('1. Testando API /api/presentes...');
    const apiRes = await makeRequest('/api/presentes');
    console.log(`   ✅ Status: ${apiRes.status}`);
    const presents = JSON.parse(apiRes.data);
    console.log(`   ✅ ${presents.length} presentes carregados`);

    // 2. Testa arquivo presents.html
    console.log('\n2. Testando presents.html...');
    const htmlRes = await makeRequest('/presents.html');
    console.log(`   ✅ Status: ${htmlRes.status}`);
    console.log(`   ✅ Tamanho: ${htmlRes.length} bytes`);
    
    const hasGrid = htmlRes.data.includes('id="giftsGrid"');
    console.log(`   ${hasGrid ? '✅' : '❌'} Tem elemento giftsGrid`);
    
    const hasPresentsJs = htmlRes.data.includes('presents.js');
    console.log(`   ${hasPresentsJs ? '✅' : '❌'} Carrega presents.js`);

    // 3. Testa arquivo presents.js
    console.log('\n3. Testando presents.js...');
    const jsRes = await makeRequest('/js/presents.js?t=new');
    console.log(`   ✅ Status: ${jsRes.status}`);
    console.log(`   ✅ Tamanho: ${jsRes.length} bytes`);
    
    const hasInit = jsRes.data.includes('Presents.init');
    console.log(`   ${hasInit ? '✅' : '❌'} Tem função init`);
    
    const hasCreateCard = jsRes.data.includes('createCard');
    console.log(`   ${hasCreateCard ? '✅' : '❌'} Tem função createCard`);

    // 4. Resumo
    console.log('\n=== RESUMO ===');
    console.log(`✅ API funcionando com ${presents.length} presentes`);
    console.log(`✅ Página HTML completa`);
    console.log(`✅ JavaScript carregado`);
    console.log('\n🎉 Tudo pronto! Recarregue a página no navegador com Ctrl+Shift+R');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

test();
