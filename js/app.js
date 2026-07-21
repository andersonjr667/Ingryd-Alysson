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

    ham?.addEventListener('click', () => {
      ham.classList.toggle('open');
      menu?.classList.toggle('open');
      document.body.style.overflow = menu?.classList.contains('open') ? 'hidden' : '';
    });

    links.forEach(a => {
      a.addEventListener('click', () => {
        ham?.classList.remove('open');
        menu?.classList.remove('open');
        document.body.style.overflow = '';
      });
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
