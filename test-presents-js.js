// Test if presents.js can be loaded
const fs = require('fs');
const path = require('path');

try {
  const presentsPath = path.join(__dirname, 'js', 'presents.js');
  const code = fs.readFileSync(presentsPath, 'utf8');
  
  // Try to execute it (will fail because it needs DOM, but will check syntax)
  console.log('✅ presents.js carregado');
  console.log('Tamanho:', code.length, 'bytes');
  
  // Check for common issues
  console.log('\n=== Verificações ===');
  console.log('1. Contém "const Presents":', code.includes('const Presents') ? '✅' : '❌');
  console.log('2. Contém "DOMContentLoaded":', code.includes('DOMContentLoaded') ? '✅' : '❌');
  console.log('3. Contém "Presents.init":', code.includes('Presents.init') ? '✅' : '❌');
  console.log('4. Contém console.log:', code.includes('console.log') ? '✅' : '❌');
  
  // Check for syntax errors
  try {
    new Function(code);
    console.log('5. Sintaxe válida: ✅');
  } catch (e) {
    console.log('5. Sintaxe válida: ❌', e.message.split('\n')[0]);
  }
  
} catch (err) {
  console.error('❌ Erro:', err.message);
}
