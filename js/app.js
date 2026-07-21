/* ============================================================
   APP.JS — Módulo principal: navbar, scroll reveal, toast
   ============================================================ */

const App = (() => {
  /* --- NAVBAR --- */
  const initNav = () => {
    const nav      = document.getElementById('nav');
    const ham      = document.getElementById('ham');
    const menu     = document.getElementById('navMenu');
    const links    = menu?.querySelectorAll('a') ?? [];
    const sections = document.querySelectorAll('section[id]');
    const hasScrollSections = sections.length > 0;

    if (!nav) return;

    const updateActiveLink = () => {
      if (!hasScrollSections) return;
      const pos = window.scrollY + 100;
      sections.forEach(sec => {
        const link = menu?.querySelector(`a[href="#${sec.id}"]`);
        if (!link) return;
        link.classList.toggle('active', pos >= sec.offsetTop && pos < sec.offsetTop + sec.offsetHeight);
      });
    };

    const onScroll = () => {
      nav.classList.toggle('scrolled', window.scrollY > 40);
      updateActiveLink();
    };

    /** Abre/fecha o menu hamburger */
    const toggleMenu = (forceClose = false) => {
      const isOpen = menu?.classList.contains('open');
      // Se forceClose for true, sempre fecha
      if (forceClose && !isOpen) return;

      const willOpen = forceClose ? false : !isOpen;

      ham?.classList.toggle('open', willOpen);
      menu?.classList.toggle('open', willOpen);
      ham?.setAttribute('aria-expanded', willOpen ? 'true' : 'false');

      // Scroll lock com suporte a iOS (position: fixed + top)
      if (willOpen) {
        const scrollY = window.scrollY;
        document.documentElement.style.setProperty('--scroll-y', `-${scrollY}px`);
        document.body.classList.add('no-scroll');
        document.body.style.top = `-${scrollY}px`;
      } else {
        const top = parseInt(document.body.style.top || '0') * -1;
        document.body.classList.remove('no-scroll');
        document.body.style.top = '';
        window.scrollTo(0, top || 0);
      }
    };

    /** Fecha o menu e restaura o scroll */
    const closeMenu = () => toggleMenu(true);

    // Click no hamburger
    ham?.addEventListener('click', () => toggleMenu());

    // Fechar ao clicar em qualquer link do menu
    links.forEach(a => {
      a.addEventListener('click', closeMenu);
    });

    // Fechar com tecla Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && menu?.classList.contains('open')) {
        closeMenu();
        ham?.focus();
      }
    });

    // Fechar ao clicar no backdrop (overlay)
    menu?.addEventListener('click', e => {
      // Se clicou exatamente no menu (não nos filhos), é o backdrop
      if (e.target === menu) {
        closeMenu();
      }
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  };

  /* --- SMOOTH SCROLL --- */
  const initSmoothScroll = () => {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const target = document.querySelector(a.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      });
    });
  };

  /* --- SCROLL REVEAL --- */
  // Usa IntersectionObserver para capturar elementos adicionados dinamicamente
  let observer;
  const initReveal = () => {
    observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); observer.unobserve(e.target); } }),
      { threshold: 0.08 }
    );
    document.querySelectorAll('.rv').forEach(el => observer.observe(el));
  };

  // Permite que outros módulos registrem novos elementos no observer
  const observe = el => observer?.observe(el);

  /* --- TOAST --- */
  let toastTimer;
  const toast = (msg, duration = 3200) => {
    const el = document.getElementById('toast');
    if (!el) return;
    clearTimeout(toastTimer);
    el.textContent = msg;
    el.classList.add('show');
    toastTimer = setTimeout(() => el.classList.remove('show'), duration);
  };

  /* --- INIT --- */
  const init = () => {
    initNav();
    initSmoothScroll();
    initReveal();
  };

  return { init, toast, observe };
})();

document.addEventListener('DOMContentLoaded', App.init);
