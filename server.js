'use strict';

require('dotenv').config();

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');

const PORT      = process.env.PORT      || 3000;
const BASE_URL  = process.env.BASE_URL  || `http://localhost:${PORT}`;
const MP_TOKEN  = process.env.MP_ACCESS_TOKEN || '';
const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) throw new Error('MONGODB_URI não definido no .env');

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

// ============================================================
// SEED — upsert: insere novos E atualiza nome/preco/imagem dos existentes
// ============================================================

const IMG = f => `/images/presents/${encodeURIComponent(f)}`;

const GIFTS_SEED = [
  { id: 1,  nome: 'Mini panela/bule com coador em aço inox 1,3L (Margarida Louvre)', preco: 1099.00, imagem: IMG('Pipoqueira Brinox Ceramic Life Pic Poc Ø22x15,5cm 5,5L Tampa com Vidro Temperado Vanilla.webp') },
  { id: 2,  nome: 'Painel para TV até 19", 1 porta, prateleiras fixas',               preco: 449.00,  imagem: IMG('Rack para TV até 70 1 Porta DJ Móveis Flow.webp') },
  { id: 3,  nome: 'Cristaleira multicolorida em MDF',                                  preco: 2357.00, imagem: '' },
  { id: 4,  nome: 'Fogão 5 bocas inox, branco, top cook',                              preco: 1199.02, imagem: IMG('Fogão 5 Bocas Atlas Preto Mônaco Top Glass.webp') },
  { id: 5,  nome: 'Aparelho de jantar 12 peças, cristal com detalhe branco/verde esmeralda', preco: 239.00, imagem: IMG('Aparelho de Jantar Chá e Café 12 Peças Alleanza Cerâmica Branco e Verde Redondo Harmony.webp') },
  { id: 6,  nome: 'Aparelho de jantar 12 peças, cristal branco/verde',                 preco: 225.00,  imagem: IMG('Aparelho de Jantar-Chá Biona Donna Colb 20 Peças.webp') },
  { id: 7,  nome: 'Aparelho de jantar 20 peças, cristal com detalhe branco/verde',     preco: 292.00,  imagem: IMG('Aparelho de Jantar e Chá 20 Peças Oxford de Cerâmica Bege e Marrom Redondo Unni Brisa.webp') },
  { id: 8,  nome: 'Jogo de panelas antiaderente, alumínio, 5 peças',                   preco: 219.00,  imagem: IMG('Jogo de Panelas Eirilar Antiaderente de Alumínio Grafite 10 Peças Facility.webp') },
  { id: 9,  nome: 'Jogo de panelas coloridas, cerâmica, 5 peças',                      preco: 286.00,  imagem: IMG('Jogo de Panelas Tramontina Revestimento Cerâmico de Alumínio Cinza 5 Peças Glenz.webp') },
  { id: 10, nome: 'Batedeira de mão, manual, 110V',                                    preco: 344.00,  imagem: IMG('Batedeira Planetária Mondial Branco e Inox 700W.webp') },
  { id: 11, nome: 'Aspirador de pó vertical, aço inoxidável, 800W',                    preco: 131.00,  imagem: IMG('Aspirador de Pó Vertical WAP Silent Speed Max 1350W 220V.webp') },
  { id: 12, nome: 'Escorredor de louça, 3 peças',                                      preco: 42.00,   imagem: IMG('Escorredor de Louças Pia com Suporte para Talheres 2 Andar.webp') },
  { id: 13, nome: 'Kit 3 panelinhas de cerâmica',                                      preco: 54.00,   imagem: IMG('Conjunto 3peças Forma Assadeira Filetada Vidro Marinex Bolo.webp') },
  { id: 14, nome: 'Panela de água em aço inox com tampa de vidro',                     preco: 96.00,   imagem: IMG('Panela De Pressão Fechamento Externo Alumínio 4,5L Preto Nacional.webp') },
  { id: 15, nome: 'Toalha de mesa retangular, 8 lugares',                              preco: 34.90,   imagem: IMG('Toalha de Mesa Retangular 6 Lugares 2,00x1,50 m Oxford Premium.webp') },
  { id: 16, nome: 'Toalha de mesa jacquard, 6 lugares',                                preco: 37.90,   imagem: IMG('Toalha de Mesa Jacquard 4, 6, 8 Lugares Luxo Decoração Várias Cores.webp') },
  { id: 17, nome: 'Jogo de colheres em aço inox, 6 peças',                             preco: 42.74,   imagem: IMG('Jogo De Talheres Tramontina inox Colher Faca Garfo 24 Peças Inox.webp') },
  { id: 18, nome: 'Parafusadeira/furadeira 12V com bateria',                           preco: 109.00,  imagem: IMG('Parafusadeira Furadeira 12V Com 1 Bateria, Maleta e 24 Acessórios Fasterr FST006.webp') },
  { id: 19, nome: 'Mop giratório com balde',                                           preco: 70.99,   imagem: IMG('Mop Giratorio Cabo de 140 cm 2 Refis Balde Centrífuga Cesto Em Inox Nybc.webp') },
  { id: 20, nome: 'Aspirador de pó, 1200W',                                            preco: 154.00,  imagem: IMG('Aspirador de Pó Vertical WAP Silent Speed Max 1350W 220V.webp') },
  { id: 21, nome: 'Ventilador de mesa Mondial',                                        preco: 130.00,  imagem: IMG('Ventilador de Mesa Mondial Super Power VSP-30-W.webp') },
  { id: 22, nome: 'Jogo de cama percal 200 fios, estampado',                           preco: 115.00,  imagem: IMG('Jogo de Cama Lençol 4 peças PERCAL 100 ALGODÃO Casal Estampado.webp') },
  { id: 23, nome: 'Jogo de cama casal, 4 peças, percal 200 fios',                      preco: 165.00,  imagem: IMG('Jogo de Cama Lençol 4 peças PERCAL 100 ALGODÃO Casal Estampado.webp') },
  { id: 24, nome: 'Frigideira antiaderente, aço',                                      preco: 205.00,  imagem: IMG('Jogo de Frigideiras Antiaderente n16, 18 e 22 cm Diâmetro.webp') },
  { id: 25, nome: 'Barbeador elétrico 2 em 1 (Philips)',                               preco: 399.00,  imagem: IMG('Mixer Britânia 3 em 1 Preto 400W BMX400P.webp') },
  { id: 26, nome: 'Aparelho de jantar, branco com detalhes azuis',                     preco: 249.00,  imagem: IMG('Aparelho de Jantar e Chá 20 Peças Tramontina de Porcelana Branco Redondo Silvia.webp') },
  { id: 27, nome: 'Aparador de grama elétrico',                                        preco: 127.00,  imagem: IMG('Mangueira Mágica 30 metros Jardim Flexível Reforçada Azul.webp') },
  { id: 28, nome: 'Ferro de passar roupa a vapor vertical Mondial',                    preco: 85.90,   imagem: IMG('Ferro de Passar Roupa a Seco Black&Decker VFA-1110 Preto.webp') },
  { id: 29, nome: 'Conjunto de panelinhas de vidro refratário',                        preco: 157.00,  imagem: IMG('Conjunto de Assadeiras de Vidro Marinex 6 Peças.webp') },
  { id: 30, nome: 'Jogo de copos de vidro, 12 peças (Duralex)',                        preco: 99.90,   imagem: IMG('Jogo de Xicara 12 Peças Preto EM VIDRO TRABALHADO PRETO Chá Café Louça Moderno.webp') },
  { id: 31, nome: 'Kit mesa posta café da manhã (xícaras/bules)',                      preco: 170.00,  imagem: IMG('Kit Mesa Posta Café da Manhã em Bambu Boleira + Queijeira + Manteigueira.webp') },
  { id: 32, nome: 'Kit de ferramentas com maleta',                                     preco: 77.00,   imagem: IMG('Kit Chaves Jogo Catraca Reversível Soquetes 46 Peças Maleta Portatil Aço Cromo Vanádio.webp') },
  { id: 33, nome: 'Fita isolante/adesiva dupla face',                                  preco: 135.00,  imagem: IMG('Kit Chaves Jogo Catraca Reversível Soquetes 46 Peças Maleta Portatil Aço Cromo Vanádio.webp') },
  { id: 34, nome: 'Jogo de toalhas rosto e banho, 5 peças',                            preco: 40.90,   imagem: IMG('Jogo De Toalhas 4 Peças Teka Dry 100% Algodão.webp') },
  { id: 35, nome: 'Jogo de toalhas, fio 100 egípcio, bordado',                         preco: 96.90,   imagem: IMG('Jogo De Toalhas 4 Peças Teka Dry 100% Algodão.webp') },
  { id: 36, nome: 'Panela de pressão elétrica 4,5L',                                   preco: 158.03,  imagem: IMG('Panela de Pressão Elétrica 6L Mondial Digital Master Cooker PE-60-6L-I.webp') },
  { id: 37, nome: 'Tábua de corte/placa de vidro temperado',                           preco: 400.00,  imagem: IMG('Conjunto de Assadeiras de Vidro Marinex 6 Peças.webp') },
  { id: 38, nome: 'Conjunto de facas profissionais com bloco suporte',                 preco: 78.00,   imagem: IMG('Jogo De Facas Faqueiro Aço Inox 9 Peças Plenus Tramontina.webp') },
  { id: 39, nome: 'Jogo de talheres inox (Tramontina)',                                preco: 78.99,   imagem: IMG('Jogo De Talheres Tramontina inox Colher Faca Garfo 24 Peças Inox.webp') },
  { id: 40, nome: 'Ferro de passar roupas a vapor (Philco) 1200W',                     preco: 148.32,  imagem: IMG('Passadeira a Vapor Mondial Portátil 260ml 1270W Branco e Azul Fast Steam VP-09.webp') },
  { id: 41, nome: 'Ventilador de mesa turbo, bivolt',                                  preco: 189.90,  imagem: IMG('Ventilador de Mesa Mondial Super Power VSP-30-W.webp') },
  { id: 42, nome: 'Réchaud/suporte de vela',                                           preco: 300.00,  imagem: IMG('Kit Mesa Posta Café da Manhã em Bambu Boleira + Queijeira + Manteigueira.webp') },
];

// Upsert: insere se não existe, atualiza nome/preco/imagem se já existe
// Nunca toca em reservado/pagamento/presenteador
async function seedDatabase() {
  const ops = GIFTS_SEED.map(g => ({
    updateOne: {
      filter: { id: g.id },
      update: {
        $set:         { nome: g.nome, preco: g.preco, imagem: g.imagem },
        $setOnInsert: { quantidade: 1, reservado: false },
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
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── GET /api/presentes ──────────────────────────────────────
app.get('/api/presentes', async (req, res) => {
  try {
    const presentes = await Presente.find().sort({ id: 1 }).lean();
    res.json(presentes);
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
  if (!mpEnabled)
    return res.status(503).json({ erro: 'Pagamentos não configurados. Adicione MP_ACCESS_TOKEN no .env.' });

  const { presenteId, presenteador } = req.body;
  if (!presenteId || !presenteador?.nome || !presenteador?.email)
    return res.status(400).json({ erro: 'presenteId, presenteador.nome e presenteador.email são obrigatórios.' });

  try {
    const presente = await Presente.findOne({ id: Number(presenteId) });
    if (!presente)          return res.status(404).json({ erro: 'Presente não encontrado.' });
    if (presente.reservado) return res.status(409).json({ erro: 'Este presente já foi reservado.' });

    const pref     = new Preference(mp);
    const response = await pref.create({
      body: {
        items: [{
          id:          String(presente.id),
          title:       presente.nome,
          quantity:    1,
          unit_price:  presente.preco,
          currency_id: 'BRL',
        }],
        payer:              { name: presenteador.nome, email: presenteador.email },
        back_urls: {
          success: `${BASE_URL}/pagamento/sucesso?presenteId=${presente.id}`,
          failure: `${BASE_URL}/pagamento/falha?presenteId=${presente.id}`,
          pending: `${BASE_URL}/pagamento/pendente?presenteId=${presente.id}`,
        },
        auto_return:          'approved',
        notification_url:     `${BASE_URL}/api/pagamento/webhook`,
        external_reference:   String(presente.id),
        statement_descriptor: 'CASAMENTO',
      },
    });

    await Presente.findOneAndUpdate({ id: presente.id }, {
      $set: {
        'pagamento.preferenceId': response.id,
        'pagamento.status':       'pending',
        'presenteador.nome':      presenteador.nome,
        'presenteador.email':     presenteador.email,
      },
    });

    res.json({ checkoutUrl: response.init_point, sandboxUrl: response.sandbox_init_point });
  } catch (err) {
    console.error('[PAGAMENTO/CRIAR]', err);
    res.status(500).json({ erro: 'Erro ao criar pagamento.' });
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

// ── Retornos do Mercado Pago ────────────────────────────────
app.get('/pagamento/sucesso',  (req, res) => res.redirect(`/presents.html?pagamento=sucesso&id=${req.query.presenteId  || ''}`));
app.get('/pagamento/falha',    (req, res) => res.redirect(`/presents.html?pagamento=falha&id=${req.query.presenteId    || ''}`));
app.get('/pagamento/pendente', (req, res) => res.redirect(`/presents.html?pagamento=pendente&id=${req.query.presenteId || ''}`));

// ── GET /api/estoque ────────────────────────────────────────
app.get('/api/estoque', async (req, res) => {
  try {
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
    const p = await Presente.findOneAndUpdate(
      { id: Number(req.params.id) },
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
  await mongoose.connect(MONGO_URI);
  console.log('✅ MongoDB conectado.');
  await seedDatabase();
  app.listen(PORT, () => {
    console.log(`🚀 Servidor em ${BASE_URL}`);
    console.log(`   Presentes: ${BASE_URL}/api/presentes`);
  });
}

start().catch(err => { console.error('❌ Falha ao iniciar:', err); process.exit(1); });
