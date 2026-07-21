/* PRESENTS.JS - Versão simplificada e robusta */

const Presents = (() => {
  let allGifts = [];
  let currentFilter = 'all';
  let selectedGift = null;

  // Dados fallback
  const FALLBACK_GIFTS = [
    { id: 1, nome: 'Mini panela/bule com coador', preco: 1099, reservado: false, imagem: '/images/presents/panela.webp' },
    { id: 2, nome: 'Painel para TV até 19"', preco: 449, reservado: false, imagem: '/images/presents/painel.webp' },
  ];

  // Formata preço para BRL
  const formatPrice = (value) => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  // Cria um card de presente
  const createCard = (gift) => {
    const card = document.createElement('article');
    card.className = `gift-card ${gift.reservado ? 'reserved' : ''}`;
    card.innerHTML = `
      <div class="gift-img">
        ${gift.imagem ? `<img src="${gift.imagem}" alt="${gift.nome}" loading="lazy">` : '<div style="background:#eee;display:flex;align-items:center;justify-content:center;color:#999;height:100%">Sem imagem</div>'}
      </div>
      <div class="gift-body">
        <span class="gift-num">Nº ${String(gift.id).padStart(2, '0')}</span>
        <h3 class="gift-name">${gift.nome}</h3>
        <p class="gift-price">${formatPrice(gift.preco)}</p>
        <span class="gift-availability ${gift.reservado ? 'reserved-status' : 'available'}">
          <span class="dot"></span>${gift.reservado ? 'Reservado' : 'Disponível'}
        </span>
      </div>
      <div class="gift-footer">
        <button class="btn btn-o btn-w btn-reserve" data-id="${gift.id}" ${gift.reservado ? 'disabled' : ''}>
          ${gift.reservado ? 'Indisponível' : 'Presentear'}
        </button>
      </div>
    `;
    return card;
  };

  // Renderiza o grid
  const renderGrid = () => {
    const grid = document.getElementById('giftsGrid');
    if (!grid) return console.error('Grid não encontrado');

    let gifts = allGifts;
    if (currentFilter === 'available') gifts = allGifts.filter(g => !g.reservado);
    if (currentFilter === 'reserved') gifts = allGifts.filter(g => g.reservado);

    const countEl = document.getElementById('giftsCount');
    if (countEl) countEl.textContent = gifts.length;

    grid.innerHTML = '';
    gifts.forEach(gift => grid.appendChild(createCard(gift)));
  };

  // Atualiza estatísticas
  const updateStats = () => {
    const total = allGifts.length;
    const reserved = allGifts.filter(g => g.reservado).length;
    
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    
    set('statTotal', total);
    set('statAvailable', total - reserved);
    set('statReserved', reserved);
  };

  // Abre o modal
  const openModal = (gift) => {
    selectedGift = gift;
    document.getElementById('modalGiftName').textContent = gift.nome;
    document.getElementById('modalGiftPrice').textContent = formatPrice(gift.preco);
    document.getElementById('modalGuestName').value = '';
    document.getElementById('modalGuestEmail').value = '';
    document.getElementById('modalOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  // Fecha o modal
  const closeModal = () => {
    document.getElementById('modalOverlay').classList.remove('open');
    document.body.style.overflow = '';
    selectedGift = null;
  };

  // Toast notification
  const toast = (message) => {
    const el = document.getElementById('toast');
    if (el) {
      el.textContent = message;
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 3500);
    }
  };

  // Confirma reserva
  const confirmReserve = async () => {
    if (!selectedGift) return;
    
    const nome = document.getElementById('modalGuestName').value.trim();
    const email = document.getElementById('modalGuestEmail').value.trim();

    if (!nome || !email) {
      toast('Preencha seu nome e e-mail');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast('E-mail inválido');
      return;
    }

    const btn = document.getElementById('modalConfirmBtn');
    btn.disabled = true;
    btn.textContent = 'Aguarde…';

    try {
      const response = await fetch('/api/pagamento/criar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presenteId: selectedGift.id,
          presenteador: { nome, email }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        toast(data.erro || 'Erro ao iniciar pagamento');
        return;
      }

      // Redireciona para Mercado Pago
      window.location.href = data.checkoutUrl;
    } catch (error) {
      toast('Erro de conexão. Tente novamente.');
      console.error(error);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Ir para Pagamento';
    }
  };

  // Contribuição via Mercado Pago
  const initContributionSection = () => {
    const form = document.getElementById('contributionForm');
    const amountInput = document.getElementById('contributionAmount');
    const submitBtn = document.getElementById('contributionSubmitBtn');

    if (!form || !amountInput || !submitBtn) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const value = Number(amountInput.value || 0);

      if (!Number.isFinite(value) || value <= 0) {
        toast('Informe um valor maior que zero.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Aguarde…';

      try {
        const response = await fetch('/api/pagamento/contribuicao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ valor: value })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.erro || 'Erro ao gerar pagamento');

        window.location.href = data.checkoutUrl;
      } catch (error) {
        toast(error.message || 'Não foi possível gerar o pagamento.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Contribuir com Mercado Pago';
      }
    });
  };

  // Inicializa
  const init = async () => {
    console.log('[PRESENTS] Inicializando...');

    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('pagamento');
    const isContribution = params.get('contribuicao') === '1';

    if (paymentStatus === 'sucesso' && isContribution) {
      toast('Contribuição registrada com sucesso! Obrigado.');
    } else if (paymentStatus === 'sucesso') {
      toast('Presente reservado com sucesso! Obrigado.');
    } else if (paymentStatus === 'falha') {
      toast('Pagamento não concluído. Tente novamente.');
    } else if (paymentStatus === 'pendente') {
      toast('Pagamento pendente. Assim que for aprovado, o presente será reservado.');
    }

    // Carrega presentes
    try {
      const response = await fetch('/api/presentes');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      allGifts = await response.json();
      console.log('[PRESENTS] Carregados', allGifts.length, 'presentes da API');
    } catch (error) {
      console.warn('[PRESENTS] Usando dados locais:', error.message);
      allGifts = FALLBACK_GIFTS;
    }

    // Renderiza grid
    renderGrid();
    updateStats();

    // Filtros
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderGrid();
      });
    });

    // Clique nos cards
    document.getElementById('giftsGrid').addEventListener('click', e => {
      const btn = e.target.closest('.btn-reserve');
      if (btn && !btn.disabled) {
        const giftId = Number(btn.dataset.id);
        const gift = allGifts.find(g => g.id === giftId);
        if (gift) openModal(gift);
      }
    });

    // Modal
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
      overlay.addEventListener('click', e => {
        if (e.target === e.currentTarget) closeModal();
      });
    }

    document.getElementById('modalCloseBtn')?.addEventListener('click', closeModal);
    document.getElementById('modalCancelBtn')?.addEventListener('click', closeModal);
    document.getElementById('modalConfirmBtn')?.addEventListener('click', confirmReserve);
    
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });

    initContributionSection();

    console.log('[PRESENTS] ✅ Pronto!');
  };

  return { init };
})();

// Inicia quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Presents.init());
} else {
  Presents.init();
}
