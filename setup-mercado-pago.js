#!/usr/bin/env node
/**
 * Script para configurar o Mercado Pago
 * Obtém o access_token e atualiza o arquivo .env
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function setup() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║      Configuração - Mercado Pago                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('📌 Passo 1: Obtenha suas credenciais em:');
  console.log('   https://www.mercadopago.com.br/developers/panel/credentials\n');

  const clientId = await question('🔑 CLIENT_ID: ');
  const clientSecret = await question('🔐 CLIENT_SECRET: ');

  if (!clientId || !clientSecret) {
    console.error('❌ CLIENT_ID e CLIENT_SECRET são obrigatórios!');
    process.exit(1);
  }

  console.log('\n⏳ Gerando access token...');

  try {
    const token = await getAccessToken(clientId, clientSecret);
    
    console.log('✅ Token obtido com sucesso!\n');
    console.log('📝 Atualizando arquivo .env...');

    // Atualiza o arquivo .env
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = fs.readFileSync(envPath, 'utf-8');

    // Substitui o MP_ACCESS_TOKEN
    envContent = envContent.replace(
      /MP_ACCESS_TOKEN=.*/,
      `MP_ACCESS_TOKEN=${token}`
    );

    fs.writeFileSync(envPath, envContent, 'utf-8');

    console.log('✅ Arquivo .env atualizado!\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✨ Configuração concluída com sucesso!');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('Próximos passos:');
    console.log('  1. Reinicie o servidor: node server.js');
    console.log('  2. Teste a página: http://localhost:3000/presents.html');
    console.log('  3. Clique em "Presentear" para testar o Mercado Pago\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

function getAccessToken(clientId, clientSecret) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials'
    });

    const options = {
      hostname: 'api.mercadopago.com',
      port: 443,
      path: '/oauth/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (res.statusCode !== 200) {
            reject(new Error(response.message || `HTTP ${res.statusCode}`));
            return;
          }

          if (!response.access_token) {
            reject(new Error('Nenhum access_token retornado'));
            return;
          }

          resolve(response.access_token);
        } catch (e) {
          reject(new Error(`Erro ao processar resposta: ${e.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Erro de conexão: ${error.message}`));
    });

    req.write(payload);
    req.end();
  });
}

// Inicia o setup
setup().catch(error => {
  console.error('❌ Erro inesperado:', error.message);
  process.exit(1);
});
