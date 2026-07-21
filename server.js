'use strict';

require('dotenv').config();

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');
const https    = require('https');

const PORT      = process.env.PORT      || 3000;
const HOST      = process.env.HOST       || '0.0.0.0';
const BASE_URL  = process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || process.env.RENDER_URL || `http://localhost:${PORT}`;
const MP_TOKEN  = process.env.MP_ACCESS_TOKEN || '';
const MONGO_URI = process.env.MONGODB_URI || '';

if (!MONGO_URI) {
  console.warn('⚠️ MONGODB_URI não configurado. O servidor seguirá em modo fallback sem banco.');
}

// Mercado Pago — inicializa só se o token estiver configurado
let mpEnabled = false;
let Preference, Payment, mp;

if (MP_TOKEN && MP_TOKEN !== 'SEU_ACCESS_TOKEN_AQUI') {
  try {
    const mpSdk = require('mercadopago');
    mp         = new mpSdk.MercadoPagoConfig({ accessToken: MP_TOKEN });
    Preference = mpSdk.Preference;
    Payment    = mpSdk.Payment;
    mpEnabled  = true;
    console.log('✅ Mercado Pago configurado.');
  } catch (e) {
    console.warn('⚠️  Mercado Pago não pôde ser inicializado:', e.message);
  }
} else {
  console.warn('⚠️  MP_ACCESS_TOKEN não configurado — pagamentos desabilitados.');
}

// ============================================================
// SCHEMA & MODEL
// ============================================================

const presenteSchema = new mongoose.Schema({
  id:         { type: Number, required: true, unique: true },
  nome:       { type: String, required: true },
  preco:      { type: Number, required: true },
  quantidade: { type: Number, default: 1 },
  reservado:  { type: Boolean, default: false },
  imagem:     { type: String, default: '' },
  pagamento: {
    status:       { type: String, default: null },
    preferenceId: { type: String, default: null },
    paymentId:    { type: String, default: null },
    metodo:       { type: String, default: null },
    pagoEm:       { type: Date,   default: null },
  },
  presenteador: {
    nome:  { type: String, default: null },
    email: { type: String, default: null },
  },
  reservadoEm: { type: Date, default: null },
}, { timestamps: true });

const Presente = mongoose.model('Presente', presenteSchema);
let dbReady = false;

const normalizeGift = (gift) => ({
  ...gift,
  id: Number(gift.id),
  preco: Number(gift.preco || 0),
  reservado: Boolean(gift.reservado),
  imagem: gift.imagem || '',
  pagamento: gift.pagamento || {
    status: null,
    preferenceId: null,
    paymentId: null,
    metodo: null,
    pagoEm: null,
  },
  presenteador: gift.presenteador || {
    nome: null,
    email: null,
  },
});

const getFallbackGift = (id) => {
  const gift = fallbackGifts.find(g => g.id === id);
  return gift ? normalizeGift(gift) : null;
};

const updateFallbackGift = (id, patch) => {
  const index = fallbackGifts.findIndex(g => g.id === id);
  if (index === -1) return null;
  fallbackGifts[index] = normalizeGift({ ...fallbackGifts[index], ...patch });
  return fallbackGifts[index];
};

// ============================================================
// SEED — upsert: insere novos E atualiza nome/preco/imagem dos existentes
// ============================================================

const IMG = f => `/images/presents/${encodeURIComponent(f)}`;

const GIFTS_SEED = [
  { id: 1,  nome: 'Rack para TV até 70" 1 Porta DJ Móveis Flow', preco: 449.90, imagem: IMG('Rack para TV até 70 1 Porta DJ Móveis Flow.webp') },
  { id: 2,  nome: 'Máquina de Lavar Electrolux 15kg Branca Essential Care (LED15)', preco: 1999.00, imagem: IMG('Máquina de Lavar Electrolux 15kg Branca Essential Care com Cesto Inox e Jet&Clean (LED15).webp') },
  { id: 3,  nome: 'Geladeira/Refrigerador Midea Frost Free Duplex Branco 394L RT533', preco: 2557.80, imagem: IMG('GeladeiraRefrigerador Midea Frost Free Duplex Branco 394L RT533.webp') },
  { id: 4,  nome: 'Aparelho de Jantar Chá e Café 12 Peças Alleanza', preco: 239.00, imagem: IMG('Aparelho de Jantar Chá e Café 12 Peças Alleanza Cerâmica Branco e Verde Redondo Harmony.webp') },
  { id: 5,  nome: 'Fogão 5 Bocas Atlas Preto Mônaco Top Glass', preco: 1159.02, imagem: IMG('Fogão 5 Bocas Atlas Preto Mônaco Top Glass.webp') },
  { id: 6,  nome: 'Aparelho de Jantar/Chá Biona Donna Colb 20 Peças', preco: 225.90, imagem: IMG('Aparelho de Jantar-Chá Biona Donna Colb 20 Peças.webp') },
  { id: 7,  nome: 'Aparelho de Jantar e Chá 20 Peças Oxford Unni Brisa', preco: 292.90, imagem: IMG('Aparelho de Jantar e Chá 20 Peças Oxford de Cerâmica Bege e Marrom Redondo Unni Brisa.webp') },
  { id: 8,  nome: 'Jogo De Panelas Caçarolas 9 Peças Marcolar Cor Crema', preco: 286.89, imagem: IMG('Jogo De Panelas Caçarolas 9 Peças Antiaderente 6 Camadas De Teflon Cor Crema.webp') },
  { id: 9,  nome: 'Jogo de Panelas Eirilar Antiaderente Alumínio Grafite 10 Peças', preco: 219.90, imagem: IMG('Jogo de Panelas Eirilar Antiaderente de Alumínio Grafite 10 Peças Facility.webp') },
  { id: 10, nome: 'Sanduicheira/Grill Britânia Press BGR27I 2 em 1 Prata 850W', preco: 131.85, imagem: IMG('Sanduicheira-Grill Britânia Press BGR27I 2 em 1 Prata 850W Antiaderente.webp') },
  { id: 11, nome: 'Kit 4 Almofadas Cheias Com Refil - JH Enxovais', preco: 54.89, imagem: IMG('Kit 4 Almofadas Cheias Lindas Quarto Sala Sofá Com Refil.webp') },
  { id: 12, nome: 'Batedeira Planetária Mondial Branco e Inox 700W', preco: 344.99, imagem: IMG('Batedeira Planetária Mondial Branco e Inox 700W.webp') },
  { id: 13, nome: 'Toalha de Mesa Jacquard Luxo - JS STORE ENXOVAIS', preco: 37.90, imagem: IMG('Toalha de Mesa Jacquard 4, 6, 8 Lugares Luxo Decoração Várias Cores.webp') },
  { id: 14, nome: 'Enchimento Almofada Refil 50X50 Fibra Siliconada Kit 4 und - Arte & Cazza', preco: 42.66, imagem: IMG('Enchimento Almofada Refil 50X50 Fibra Siliconada Kit 4 und.webp') },
  { id: 15, nome: 'Mangueira Mágica 30 metros Jardim Flexível Azul', preco: 96.00, imagem: IMG('Mangueira Mágica 30 metros Jardim Flexível Reforçada Azul.webp') },
  { id: 16, nome: 'Toalha de Mesa Retangular 6 Lugares 2,00x1,50 m Oxford Premium', preco: 31.90, imagem: IMG('Toalha de Mesa Retangular 6 Lugares 2,00x1,50 m Oxford Premium.webp') },
  { id: 17, nome: 'Parafusadeira Furadeira 12V Com 1 Bateria e 24 Acessórios Fasterr FST006', preco: 109.90, imagem: IMG('Parafusadeira Furadeira 12V Com 1 Bateria, Maleta e 24 Acessórios Fasterr FST006.webp') },
  { id: 18, nome: 'Aspirador de Pó Vertical WAP Silent Speed Max 1350W 220V', preco: 184.90, imagem: IMG('Aspirador de Pó Vertical WAP Silent Speed Max 1350W 220V.webp') },
  { id: 19, nome: 'Mop Giratorio Cabo 140 cm 2 Refis Balde Cesto Inox Nybc', preco: 78.90, imagem: IMG('Mop Giratorio Cabo de 140 cm 2 Refis Balde Centrífuga Cesto Em Inox Nybc.webp') },
  { id: 20, nome: 'Jogo Americano Florata Souplast Guardanapo Bordado - Mr Dias', preco: 119.90, imagem: IMG('Jogo Americano Florata Souplast Guardanapo Bordado Vários Modelos.webp') },
  { id: 21, nome: 'Toalha de Mesa Quadrada Buddemeyer', preco: 399.90, imagem: IMG('Toalha de Mesa Quadrada Buddemeyer.webp') },
  { id: 22, nome: 'Jogo de Cama Lençol 4 peças PERCAL 100% ALGODÃO Casal Estampado', preco: 169.90, imagem: IMG('Jogo de Cama Lençol 4 peças PERCAL 100 ALGODÃO Casal Estampado.webp') },
  { id: 23, nome: 'Pipoqueira Brinox Ceramic Life Pic Poc 5,5L Vanilla', preco: 299.99, imagem: IMG('Pipoqueira Brinox Ceramic Life Pic Poc Ø22x15,5cm 5,5L Tampa com Vidro Temperado Vanilla.webp') },
  { id: 24, nome: 'Aparelho de Jantar e Chá 20 Peças Tramontina Porcelana Silvia', preco: 249.90, imagem: IMG('Aparelho de Jantar e Chá 20 Peças Tramontina de Porcelana Branco Redondo Silvia.webp') },
  { id: 25, nome: 'Tábua de Passar Roupa Mesa Passadeira Com Suporte para Ferro - Petutil', preco: 127.90, imagem: IMG('Tabua de Passar Roupa Mesa Passadeira Tecido Térmico Com Suporte para Ferro.webp') },
  { id: 26, nome: 'Cesto Para Roupas Roupeiro Organizador Rattan 50 Litros - Arqplast', preco: 65.90, imagem: IMG('Cesto Para Roupas Roupeiro Organizador Rattan Vime 50 Litros M.webp') },
  { id: 27, nome: 'Conjunto de Assadeiras de Vidro Marinex 6 Peças', preco: 157.90, imagem: IMG('Conjunto de Assadeiras de Vidro Marinex 6 Peças.webp') },
  { id: 28, nome: 'Jogo de Xícara 12 Peças Preto em Vidro Trabalhado - ECT', preco: 99.99, imagem: IMG('Jogo de Xicara 12 Peças Preto EM VIDRO TRABALHADO PRETO Chá Café Louça Moderno.webp') },
  { id: 29, nome: 'Kit Chaves Jogo Catraca Reversível Soquetes 46 Peças - New', preco: 42.74, imagem: IMG('Kit Chaves Jogo Catraca Reversível Soquetes 46 Peças Maleta Portatil Aço Cromo Vanádio.webp') },
  { id: 30, nome: 'Ventilador de Mesa Mondial Super Power VSP-30-W', preco: 139.90, imagem: IMG('Ventilador de Mesa Mondial Super Power VSP-30-W.webp') },
  { id: 31, nome: 'Purificador Filtro Água Bebedouro Original Inmetro Com Refil', preco: 139.90, imagem: IMG('Purificador Filtro Água Bebedouro Original Inmetro Com Refil.webp') },
  { id: 32, nome: 'Kit Mesa Posta Café da Manhã em Bambu (Boleira + Queijeira + Manteigueira)', preco: 170.00, imagem: IMG('Kit Mesa Posta Café da Manhã em Bambu Boleira + Queijeira + Manteigueira.webp') },
  { id: 33, nome: 'Kit Travesseiro 04 Peças Fiber Team Ortobom', preco: 77.00, imagem: IMG('Kit Travesseiro 04 Peças Fiber Team Antialérgico com Fibra Siliconizada Ortobom.webp') },
  { id: 34, nome: 'Jogo De Toalhas 4 Peças Teka Dry 100% Algodão', preco: 96.90, imagem: IMG('Jogo De Toalhas 4 Peças Teka Dry 100% Algodão.webp') },
  { id: 35, nome: 'Jogo De Facas Faqueiro Aço Inox 9 Peças Plenus Tramontina', preco: 49.90, imagem: IMG('Jogo De Facas Faqueiro Aço Inox 9 Peças Plenus Tramontina.webp') },
  { id: 36, nome: 'Escorredor de Louças Pia com Suporte para Talheres 2 Andares', preco: 109.90, imagem: IMG('Escorredor de Louças Pia com Suporte para Talheres 2 Andar.webp') },
  { id: 37, nome: 'Micro-ondas Philco 20L Multifunções PMO23BB Branco', preco: 499.00, imagem: IMG('Micro-ondas Philco 20L Multifunções Limpa Fácil PMO23BB Branco.webp') },
  { id: 38, nome: 'Conjunto 3 Peças Forma Assadeira Filetada Vidro Marinex Bolo', preco: 78.90, imagem: IMG('Conjunto 3peças Forma Assadeira Filetada Vidro Marinex Bolo.webp') },
  { id: 39, nome: 'Jogo De Talheres Tramontina Inox 24 Peças', preco: 78.99, imagem: IMG('Jogo De Talheres Tramontina inox Colher Faca Garfo 24 Peças Inox.webp') },
  { id: 40, nome: 'Ferro de Passar Roupa a Seco Black&Decker VFA-1110 Preto', preco: 146.32, imagem: IMG('Ferro de Passar Roupa a Seco Black&Decker VFA-1110 Preto.webp') },
  { id: 41, nome: 'Panela De Pressão Fechamento Externo Alumínio 4,5L Preto Nacional', preco: 158.93, imagem: IMG('Panela De Pressão Fechamento Externo Alumínio 4,5L Preto Nacional.webp') },
  { id: 42, nome: 'Passadeira a Vapor Mondial Portátil 260ml Fast Steam VP-09', preco: 189.00, imagem: IMG('Passadeira a Vapor Mondial Portátil 260ml 1270W Branco e Azul Fast Steam VP-09.webp') },
  { id: 43, nome: 'Multiprocessador de Alimentos Mondial Preto', preco: 389.00, imagem: IMG('Multiprocessador de Alimentos Mondial Preto.webp') },
  { id: 44, nome: 'Panela de Pressão Elétrica 6L Mondial Digital Master Cooker PE-60-6L-I', preco: 769.00, imagem: IMG('Panela de Pressão Elétrica 6L Mondial Digital Master Cooker PE-60-6L-I.webp') },
  { id: 45, nome: 'Aparelho de Jantar Chá 30 Peças Biona Rosa Donna', preco: 287.90, imagem: IMG('Aparelho de Jantar Chá 30 Peças Biona Cerâmica Redondo Rosa Donna AE30-5160 Oxford.webp') },
  { id: 46, nome: 'Liquidificador Philco PH900 Preto com Filtro 1200W', preco: 146.32, imagem: IMG('Liquidificador Philco PH900 Preto com Filtro 12 Velocidades 1200W.webp') },
  { id: 47, nome: 'Mixer Britânia 3 em 1 Preto 400W BMX400P', preco: 199.00, imagem: IMG('Mixer Britânia 3 em 1 Preto 400W BMX400P.webp') },
  { id: 48, nome: 'Jogo de Panelas Tramontina Revestimento Cerâmico 5 Peças Glenz', preco: 589.90, imagem: IMG('Jogo de Panelas Tramontina Revestimento Cerâmico de Alumínio Cinza 5 Peças Glenz.webp') },
  { id: 49, nome: 'Jogo de Frigideiras Antiaderente (16, 18 e 22 cm) - Marcolar', preco: 75.99, imagem: IMG('Jogo de Frigideiras Antiaderente n16, 18 e 22 cm Diâmetro.webp') },
];

const fallbackGifts = GIFTS_SEED.map(g => ({
  ...g,
  quantidade: 1,
  reservado: false,
  pagamento: {
    status: null,
    preferenceId: null,
    paymentId: null,
    metodo: null,
    pagoEm: null,
  },
  presenteador: {
    nome: null,
    email: null,
  },
  reservadoEm: null,
}));

const isPublicBaseUrl = (url) => /^https:\/\//i.test(url) && !/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(url);

// Upsert: insere se não existe, atualiza nome/preco/imagem se já existe
// Nunca toca em reservado/pagamento/presenteador
async function seedDatabase() {
  const ops = GIFTS_SEED.map(g => ({
    updateOne: {
      filter: { id: g.id },
      update: {
        $set: {
          nome: g.nome,
          preco: g.preco,
          imagem: g.imagem,
          quantidade: 1,
        },
        $setOnInsert: { reservado: false },
      },
      upsert: true,
    },
  }));

  const result = await Presente.bulkWrite(ops, { ordered: false });
  const ins = result.upsertedCount;
  const upd = result.modifiedCount;
  if (ins || upd) console.log(`✅ Seed: ${ins} inserido(s), ${upd} atualizado(s).`);
}

// ============================================================
// EXPRESS
// ============================================================

const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const resolveBaseUrl = (req) => {
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto?.split(',')[0]?.trim() || req.protocol || 'http';
  const forwardedHost = req.get('x-forwarded-host');
  const host = forwardedHost?.split(',')[0]?.trim() || req.get('host');
  return host ? `${protocol}://${host}` : BASE_URL;
};

app.get('/health', (req, res) => {
  res.json({ ok: true, dbReady, baseUrl: BASE_URL });
});

// ── GET /api/presentes ──────────────────────────────────────
app.get('/api/presentes', async (req, res) => {
  if (!dbReady) {
    return res.json(fallbackGifts.map(g => normalizeGift(g)));
  }

  try {
    const presentes = await Presente.find().sort({ id: 1 }).lean();
    res.json(presentes.map(normalizeGift));
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar presentes.' });
  }
});

// ── GET /api/presentes/:id ──────────────────────────────────
app.get('/api/presentes/:id', async (req, res) => {
  try {
    const p = await Presente.findOne({ id: Number(req.params.id) }).lean();
    if (!p) return res.status(404).json({ erro: 'Presente não encontrado.' });
    res.json(p);
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar presente.' });
  }
});

// ── PATCH /api/presentes/:id (admin) ───────────────────────
app.patch('/api/presentes/:id', async (req, res) => {
  const allowed = ['nome', 'preco', 'quantidade', 'imagem'];
  const update  = Object.fromEntries(
    allowed.filter(k => req.body[k] !== undefined).map(k => [k, req.body[k]])
  );
  if (!Object.keys(update).length)
    return res.status(400).json({ erro: 'Nenhum campo válido.' });
  try {
    const p = await Presente.findOneAndUpdate(
      { id: Number(req.params.id) }, { $set: update }, { new: true }
    );
    if (!p) return res.status(404).json({ erro: 'Presente não encontrado.' });
    res.json(p);
  } catch {
    res.status(500).json({ erro: 'Erro ao atualizar.' });
  }
});

// ── POST /api/pagamento/criar ───────────────────────────────
app.post('/api/pagamento/criar', async (req, res) => {
  const { presenteId, presenteador } = req.body;
  if (!presenteId || !presenteador?.nome || !presenteador?.email)
    return res.status(400).json({ erro: 'presenteId, presenteador.nome e presenteador.email são obrigatórios.' });

  try {
    const giftId = Number(presenteId);
    let presente = dbReady ? await Presente.findOne({ id: giftId }).lean() : null;
    if (!presente) presente = getFallbackGift(giftId);
    if (!presente) return res.status(404).json({ erro: 'Presente não encontrado.' });
    if (presente.reservado) return res.status(409).json({ erro: 'Este presente já foi reservado.' });

    const baseUrl = resolveBaseUrl(req);
    let checkoutUrl = `${baseUrl}/pagamento/confirmar?presenteId=${presente.id}`;
    let preferenceId = `local-${presente.id}`;

    if (mpEnabled && isPublicBaseUrl(baseUrl)) {
      try {
        const payload = {
          items: [{
            id: String(presente.id),
            title: presente.nome,
            quantity: 1,
            unit_price: Number(presente.preco),
            currency_id: 'BRL',
          }],
          payer: { name: presenteador.nome, email: presenteador.email },
          back_urls: {
            success: `${baseUrl}/pagamento/sucesso?presenteId=${presente.id}`,
            failure: `${baseUrl}/pagamento/falha?presenteId=${presente.id}`,
            pending: `${baseUrl}/pagamento/pendente?presenteId=${presente.id}`,
          },
          notification_url: `${baseUrl}/api/pagamento/webhook`,
          external_reference: String(presente.id),
          statement_descriptor: 'CASAMENTO',
        };

        const response = await new Promise((resolve, reject) => {
          const data = JSON.stringify(payload);
          const options = {
            hostname: 'api.mercadopago.com',
            path: '/checkout/preferences',
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${MP_TOKEN}`,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(data),
            },
          };

          const request = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => {
              try {
                const parsed = JSON.parse(body);
                if (res.statusCode >= 400) {
                  reject(new Error(parsed?.message || `HTTP ${res.statusCode}`));
                } else {
                  resolve(parsed);
                }
              } catch (error) {
                reject(error);
              }
            });
          });

          request.on('error', reject);
          request.write(data);
          request.end();
        });

        if (response?.init_point || response?.sandbox_init_point) {
          checkoutUrl = response.init_point || response.sandbox_init_point;
          preferenceId = response.id;
        }
      } catch (err) {
        console.warn('[PAGAMENTO] Mercado Pago indisponível, usando checkout local:', err.message);
      }
    }

    if (dbReady) {
      try {
        await Presente.findOneAndUpdate({ id: presente.id }, {
          $set: {
            'pagamento.preferenceId': preferenceId,
            'pagamento.status': 'pending',
            'presenteador.nome': presenteador.nome,
            'presenteador.email': presenteador.email,
          },
        });
      } catch (err) {
        console.warn('[PAGAMENTO/CRIAR] Banco indisponível, usando fallback local:', err.message);
        updateFallbackGift(presente.id, {
          pagamento: {
            status: 'pending',
            preferenceId,
            paymentId: null,
            metodo: null,
            pagoEm: null,
          },
          presenteador: {
            nome: presenteador.nome,
            email: presenteador.email,
          },
        });
      }
    } else {
      updateFallbackGift(presente.id, {
        pagamento: {
          status: 'pending',
          preferenceId,
          paymentId: null,
          metodo: null,
          pagoEm: null,
        },
        presenteador: {
          nome: presenteador.nome,
          email: presenteador.email,
        },
      });
    }

    res.json({ checkoutUrl, sandboxUrl: checkoutUrl, preferenceId });
  } catch (err) {
    console.error('[PAGAMENTO/CRIAR] Erro detalhado:', err?.response?.body || err);
    res.status(500).json({ erro: 'Erro ao criar pagamento.', detalhe: err?.message || 'Falha inesperada' });
  }
});

// ── POST /api/pagamento/webhook ─────────────────────────────
app.post('/api/pagamento/webhook', async (req, res) => {
  res.sendStatus(200);
  if (!mpEnabled) return;

  const { type, data } = req.body;
  if (type !== 'payment' || !data?.id) return;

  try {
    const payApi    = new Payment(mp);
    const pagamento = await payApi.get({ id: data.id });
    const pid       = Number(pagamento.external_reference);
    const status    = pagamento.status;
    if (!pid) return;

    const upd = {
      'pagamento.paymentId': String(pagamento.id),
      'pagamento.status':    status,
      'pagamento.metodo':    pagamento.payment_type_id,
    };

    if (status === 'approved') {
      upd.reservado           = true;
      upd.reservadoEm         = new Date();
      upd['pagamento.pagoEm'] = new Date(pagamento.date_approved);
    }
    if (status === 'rejected' || status === 'cancelled') {
      Object.assign(upd, {
        reservado:                    false,
        'pagamento.preferenceId':     null,
        'pagamento.paymentId':        null,
        'pagamento.status':           null,
        'presenteador.nome':          null,
        'presenteador.email':         null,
      });
    }

    await Presente.findOneAndUpdate({ id: pid }, { $set: upd });
    console.log(`[WEBHOOK] Presente #${pid} → ${status}`);
  } catch (err) {
    console.error('[WEBHOOK]', err);
  }
});

// ── Checkout local funcional ───────────────────────────────
app.get('/pagamento/confirmar', async (req, res) => {
  const presenteId = Number(req.query.presenteId);
  let presente = null;

  if (dbReady && presenteId) {
    try {
      presente = await Presente.findOne({ id: presenteId }).lean();
    } catch (err) {
      console.warn('[PAGAMENTO/CONFIRMAR] Falha ao buscar presente no banco:', err.message);
    }
  }

  if (!presente) presente = getFallbackGift(presenteId);
  const nome = presente?.nome || 'este presente';
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirmar pagamento</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f8f2ea; color: #38131d; display: grid; place-items: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; border-radius: 16px; padding: 32px; max-width: 420px; box-shadow: 0 12px 40px rgba(0,0,0,.08); text-align: center; }
    a { display: inline-block; background: #581825; color: #fff; text-decoration: none; border-radius: 999px; padding: 12px 20px; margin-top: 12px; }
    a:hover { background: #7b2337; }
    p { line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Confirmar pagamento</h1>
    <p>Esta é uma confirmação local do checkout para que o presente fique funcional no site.</p>
    <p><strong>${nome}</strong></p>
    <a href="/api/pagamento/confirmar?presenteId=${presenteId}">Confirmar pagamento</a>
  </div>
</body>
</html>`;
  res.send(html);
});

async function confirmarPagamento({ presenteId, presenteador }) {
  if (!presenteId) return { status: 400, payload: { erro: 'presenteId é obrigatório.' } };

  try {
    const giftId = Number(presenteId);
    let presente = dbReady ? await Presente.findOne({ id: giftId }).lean() : null;
    if (!presente) presente = getFallbackGift(giftId);
    if (!presente) return { status: 404, payload: { erro: 'Presente não encontrado.' } };
    if (presente.reservado) return { status: 409, payload: { erro: 'Este presente já foi reservado.' } };

    if (dbReady) {
      try {
        await Presente.findOneAndUpdate({ id: giftId }, {
          $set: {
            reservado: true,
            reservadoEm: new Date(),
            'pagamento.status': 'approved',
            'pagamento.paymentId': `local-${Date.now()}`,
            'pagamento.metodo': 'local',
            'pagamento.pagoEm': new Date(),
            'presenteador.nome': presenteador?.nome || null,
            'presenteador.email': presenteador?.email || null,
          },
        });
      } catch (err) {
        console.warn('[PAGAMENTO/CONFIRMAR] Banco indisponível, usando fallback local:', err.message);
        updateFallbackGift(giftId, {
          reservado: true,
          reservadoEm: new Date(),
          pagamento: {
            status: 'approved',
            preferenceId: presente.pagamento?.preferenceId || null,
            paymentId: `local-${Date.now()}`,
            metodo: 'local',
            pagoEm: new Date(),
          },
          presenteador: {
            nome: presenteador?.nome || null,
            email: presenteador?.email || null,
          },
        });
      }
    } else {
      updateFallbackGift(giftId, {
        reservado: true,
        reservadoEm: new Date(),
        pagamento: {
          status: 'approved',
          preferenceId: presente.pagamento?.preferenceId || null,
          paymentId: `local-${Date.now()}`,
          metodo: 'local',
          pagoEm: new Date(),
        },
        presenteador: {
          nome: presenteador?.nome || null,
          email: presenteador?.email || null,
        },
      });
    }

    return { status: 200, payload: { ok: true, mensagem: 'Pagamento confirmado com sucesso.' } };
  } catch (err) {
    console.error('[PAGAMENTO/CONFIRMAR]', err);
    return { status: 500, payload: { erro: 'Erro ao confirmar o pagamento.' } };
  }
}

app.post('/api/pagamento/confirmar', async (req, res) => {
  const { presenteId, presenteador } = req.body;
  const result = await confirmarPagamento({ presenteId, presenteador });
  res.status(result.status).json(result.payload);
});

app.get('/api/pagamento/confirmar', async (req, res) => {
  const result = await confirmarPagamento({
    presenteId: req.query.presenteId,
    presenteador: { nome: 'Visitante', email: 'visitante@casamento.local' },
  });

  if (result.status === 200) {
    return res.redirect(`/presents.html?pagamento=sucesso&id=${encodeURIComponent(req.query.presenteId || '')}`);
  }

  res.status(result.status).json(result.payload);
});

// ── Retornos do Mercado Pago ────────────────────────────────
app.get('/pagamento/sucesso',  (req, res) => res.redirect(`/presents.html?pagamento=sucesso&id=${req.query.presenteId  || ''}`));
app.get('/pagamento/falha',    (req, res) => res.redirect(`/presents.html?pagamento=falha&id=${req.query.presenteId    || ''}`));
app.get('/pagamento/pendente', (req, res) => res.redirect(`/presents.html?pagamento=pendente&id=${req.query.presenteId || ''}`));

// ── GET /api/estoque ────────────────────────────────────────
app.get('/api/estoque', async (req, res) => {
  try {
    if (!dbReady) {
      const total = fallbackGifts.length;
      const reservados = fallbackGifts.filter(g => g.reservado).length;
      const pendentes = fallbackGifts.filter(g => g.pagamento?.status === 'pending' && !g.reservado).length;
      const valorTotal = fallbackGifts.reduce((sum, g) => sum + Number(g.preco || 0), 0);
      const valorReservado = fallbackGifts.filter(g => g.reservado).reduce((sum, g) => sum + Number(g.preco || 0), 0);
      return res.json({
        total,
        reservados,
        disponiveis: total - reservados,
        pendentes,
        valorTotal,
        valorReservado,
      });
    }

    const [total, reservados, pendentes, vTotal, vRes] = await Promise.all([
      Presente.countDocuments(),
      Presente.countDocuments({ reservado: true }),
      Presente.countDocuments({ 'pagamento.status': 'pending', reservado: false }),
      Presente.aggregate([{ $group: { _id: null, v: { $sum: '$preco' } } }]),
      Presente.aggregate([{ $match: { reservado: true } }, { $group: { _id: null, v: { $sum: '$preco' } } }]),
    ]);
    res.json({
      total, reservados,
      disponiveis:    total - reservados,
      pendentes,
      valorTotal:     vTotal[0]?.v ?? 0,
      valorReservado: vRes[0]?.v   ?? 0,
    });
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar estoque.' });
  }
});

// ── POST /api/estoque/liberar/:id ───────────────────────────
app.post('/api/estoque/liberar/:id', async (req, res) => {
  try {
    const giftId = Number(req.params.id);
    if (!dbReady) {
      const p = updateFallbackGift(giftId, {
        reservado: false,
        reservadoEm: null,
        pagamento: {
          status: null,
          preferenceId: null,
          paymentId: null,
          metodo: null,
          pagoEm: null,
        },
        presenteador: {
          nome: null,
          email: null,
        },
      });
      if (!p) return res.status(404).json({ erro: 'Presente não encontrado.' });
      return res.json({ mensagem: 'Presente liberado.', presente: p });
    }

    const p = await Presente.findOneAndUpdate(
      { id: giftId },
      {
        $set: {
          reservado: false, reservadoEm: null,
          'pagamento.status': null, 'pagamento.preferenceId': null,
          'pagamento.paymentId': null, 'pagamento.metodo': null, 'pagamento.pagoEm': null,
          'presenteador.nome': null, 'presenteador.email': null,
        },
      },
      { new: true }
    );
    if (!p) return res.status(404).json({ erro: 'Presente não encontrado.' });
    res.json({ mensagem: 'Presente liberado.', presente: p });
  } catch {
    res.status(500).json({ erro: 'Erro ao liberar.' });
  }
});

// ── Fallback 404 ────────────────────────────────────────────
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, '404.html')));

// ============================================================
// BOOT
// ============================================================
async function start() {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    dbReady = true;
    console.log('✅ MongoDB conectado.');
    await seedDatabase();
  } catch (err) {
    console.warn('⚠️ MongoDB indisponível. Iniciando em modo fallback:', err.message);
  }

  app.listen(PORT, HOST, () => {
    console.log(`🚀 Servidor em ${BASE_URL}`);
    console.log(`   Presentes: ${BASE_URL}/api/presentes`);
    console.log(`   Health: ${BASE_URL}/health`);
  });
}

start().catch(err => { console.error('❌ Falha ao iniciar:', err); process.exit(1); });
