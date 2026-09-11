(() => {
  'use strict';

  document.documentElement.classList.add('js');
  requestAnimationFrame(() => document.body?.classList.add('page-ready'));

  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
  const menuButton = document.querySelector('.menu-toggle');
  const menu = document.getElementById('mobile-menu');
  const mobileWidth = window.matchMedia('(max-width: 980px)');
  const filterButtons = [...document.querySelectorAll('.portfolio-filter')];
  const portfolioItems = [...document.querySelectorAll('.project[data-category]')];
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The reference uses a small, playful pointer. Keep it desktop-only and stop the
  // animation loop once the pointer settles so touch and low-power devices are unaffected.
  const cursor = document.querySelector('.custom-cursor');
  const finePointer = window.matchMedia('(pointer: fine) and (hover: hover)').matches;
  if (cursor && finePointer && !prefersReducedMotion) {
    document.body.classList.add('has-custom-cursor');
    let targetX = -80;
    let targetY = -80;
    let currentX = targetX;
    let currentY = targetY;
    let frame = 0;
    let active = false;
    const renderCursor = () => {
      currentX += (targetX - currentX) * .22;
      currentY += (targetY - currentY) * .22;
      cursor.style.left = currentX + 'px';
      cursor.style.top = currentY + 'px';
      if (active && (Math.abs(targetX - currentX) > .15 || Math.abs(targetY - currentY) > .15)) frame = requestAnimationFrame(renderCursor);
      else frame = 0;
    };
    const scheduleCursor = () => { if (!frame) frame = requestAnimationFrame(renderCursor); };
    document.addEventListener('pointermove', event => {
      targetX = event.clientX;
      targetY = event.clientY;
      active = true;
      cursor.classList.add('is-visible');
      scheduleCursor();
    }, { passive: true });
    document.addEventListener('pointerover', event => {
      const interactive = event.target.closest?.('a, button, [data-cursor]');
      if (!interactive) return;
      cursor.classList.add('is-hovering');
      cursor.classList.toggle('is-project', interactive.matches('[data-cursor="project"]') || Boolean(interactive.closest('[data-cursor="project"]')));
    });
    document.addEventListener('pointerout', event => {
      const interactive = event.target.closest?.('a, button, [data-cursor]');
      if (!interactive || interactive.contains(event.relatedTarget)) return;
      cursor.classList.remove('is-hovering', 'is-project');
    });
    window.addEventListener('blur', () => { active = false; cursor.classList.remove('is-visible', 'is-hovering', 'is-project'); });
  }

  if (filterButtons.length && portfolioItems.length) {
    filterButtons.forEach(button => button.addEventListener('click', () => {
      const filter = button.dataset.filter;
      filterButtons.forEach(control => {
        const active = control === button;
        control.classList.toggle('is-active', active);
        control.setAttribute('aria-pressed', String(active));
      });
      portfolioItems.forEach(item => {
        const categories = item.dataset.category.split(/\s+/);
        item.hidden = filter !== 'all' && !categories.includes(filter);
      });
      window.ScrollTrigger?.refresh();
    }));
  }

  if (menuButton && menu && typeof menu.showModal === 'function') {
    menuButton.hidden = false;
    const closeMenu = () => { if (menu.open) menu.close(); };
    menuButton.addEventListener('click', () => {
      menu.showModal();
      menuButton.setAttribute('aria-expanded', 'true');
      document.body.classList.add('menu-open');
    });
    menu.querySelector('.menu-close').addEventListener('click', closeMenu);
    menu.addEventListener('close', () => {
      document.body.classList.remove('menu-open');
      menuButton.setAttribute('aria-expanded', 'false');
    });
    menu.addEventListener('click', event => {
      if (event.target !== menu) return;
      const rect = menu.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeMenu();
    });
    menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
      closeMenu();
      const target = link.hash && document.getElementById(link.hash.slice(1));
      if (target) {
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
        target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
      }
    }));
    mobileWidth.addEventListener('change', event => { if (!event.matches) closeMenu(); });
  }

  const contactForm = document.getElementById('contact-form');
  const contactFormStatus = document.getElementById('contact-form-status');
  if (contactForm) {
    contactForm.addEventListener('submit', event => {
      event.preventDefault();
      if (!contactForm.reportValidity()) return;

      const values = new FormData(contactForm);
      const name = String(values.get('name') || '').trim();
      const email = String(values.get('email') || '').trim();
      const project = String(values.get('project') || '').trim();
      const message = String(values.get('message') || '').trim();
      const subject = `Portfolio enquiry from ${name}`;
      const body = [
        `Name: ${name}`,
        `Email: ${email}`,
        project ? `Project type: ${project}` : '',
        '',
        message
      ].filter(Boolean).join('\n');
      const mailto = `mailto:buildwritesh@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      if (contactFormStatus) contactFormStatus.textContent = 'Opening your email app…';
      window.location.href = mailto;
      window.setTimeout(() => {
        if (contactFormStatus) contactFormStatus.textContent = 'If your email app did not open, email buildwritesh@gmail.com directly.';
      }, 900);
    });
  }

  const sections = [...document.querySelectorAll('main section[id]')];
  const navLinks = [...document.querySelectorAll('.desktop-nav a')];
  const progressDots = [...document.querySelectorAll('[data-progress-section]')];
  const setActiveSection = id => {
    navLinks.forEach(link => {
      if (link.hash === '#' + id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    progressDots.forEach(dot => dot.classList.toggle('is-active', dot.dataset.progressSection === id));
  };
  if (sections.length) {
    let progressFrame = 0;
    const updateSectionState = () => {
      progressFrame = 0;
      const marker = window.innerHeight * .42;
      let current = sections[0].id;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= marker) current = section.id;
      }
      setActiveSection(current);
    };
    const scheduleSectionState = () => { if (!progressFrame) progressFrame = requestAnimationFrame(updateSectionState); };
    window.addEventListener('scroll', scheduleSectionState, { passive: true });
    window.addEventListener('resize', scheduleSectionState, { passive: true });
    scheduleSectionState();
  }

  // Retain GSAP and ScrollTrigger for subtle, once-only movement.
  if (!window.gsap || !window.ScrollTrigger) return;
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  if (!prefersReducedMotion) {
    gsap.utils.toArray('.reveal-up').forEach(element => {
      gsap.from(element, {
        opacity: 0, y: 24, duration: .72, ease: 'power3.out', clearProps: 'transform,opacity',
        scrollTrigger: { trigger: element, start: 'top 94%', once: true }
      });
    });
  }
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
})();
