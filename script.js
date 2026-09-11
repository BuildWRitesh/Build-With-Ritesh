(() => {
  'use strict';

  document.documentElement.classList.add('js');
  requestAnimationFrame(() => document.body?.classList.add('page-ready'));

  const bootSequence = document.querySelector('.boot-sequence');
  if (bootSequence) {
    const completeBoot = () => {
      bootSequence.classList.add('is-complete');
      window.setTimeout(() => bootSequence.remove(), 260);
    };
    window.setTimeout(completeBoot, 760);
  }

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
  const cursorMedia = window.matchMedia('(pointer: fine) and (hover: hover) and (min-width: 981px) and (prefers-reduced-motion: no-preference)');
  if (cursor) {
    const syncCursor = () => {
      document.body.classList.toggle('has-custom-cursor', cursorMedia.matches);
      if (!cursorMedia.matches) cursor.classList.remove('is-visible', 'is-hovering', 'is-project', 'is-code');
    };
    syncCursor();
    cursorMedia.addEventListener('change', syncCursor);
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
      if (!cursorMedia.matches || event.pointerType === 'touch') return;
      targetX = event.clientX;
      targetY = event.clientY;
      active = true;
      cursor.classList.add('is-visible');
      scheduleCursor();
    }, { passive: true });
    document.addEventListener('pointerover', event => {
      const interactive = event.target.closest?.('a, button, [data-cursor]');
      if (!interactive) return;
      if (!cursorMedia.matches) return;
      cursor.classList.add('is-hovering');
      cursor.classList.toggle('is-project', interactive.matches('[data-cursor="project"]') || Boolean(interactive.closest('[data-cursor="project"]')));
      cursor.dataset.label = interactive.closest('.social-card') ? 'PLAY' : interactive.closest('.article-card') ? 'READ' : 'VIEW';
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
    contactForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (!contactForm.reportValidity()) return;
      const button = contactForm.querySelector('[type="submit"]');
      const payload = Object.fromEntries(new FormData(contactForm));
      contactForm.setAttribute('aria-busy', 'true');
      if (contactFormStatus) contactFormStatus.dataset.state = 'sending';
      if (contactFormStatus) contactFormStatus.textContent = 'Sending securely…';
      if (button) button.disabled = true;
      try {
        const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Message delivery failed.');
        contactForm.reset();
        if (contactFormStatus) contactFormStatus.dataset.state = 'success';
        if (contactFormStatus) contactFormStatus.textContent = result.message || 'Thanks — your message has been sent.';
      } catch (error) {
        if (contactFormStatus) contactFormStatus.dataset.state = 'error';
        if (contactFormStatus) contactFormStatus.textContent = `${error.message} You can email buildwritesh@gmail.com directly.`;
      } finally { if (button) button.disabled = false; contactForm.removeAttribute('aria-busy'); }
    });
  }

  const sections = [...document.querySelectorAll('main section[id]')];
  const navLinks = [...document.querySelectorAll('.desktop-nav a')];
  const progressDots = [...document.querySelectorAll('[data-progress-section]')];
  const setActiveSection = id => {
    navLinks.forEach(link => {
      if (link.getAttribute('aria-current') === 'page') return;
      if (link.hash === '#' + id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    progressDots.forEach(dot => dot.classList.toggle('is-active', dot.dataset.progressSection === id));
    const index = progressDots.findIndex(dot => dot.dataset.progressSection === id);
    const readout = document.querySelector('.section-progress__readout');
    if (readout && index >= 0) readout.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(progressDots.length).padStart(2, '0');
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

// Small pointer responses reinforce the developer UI without changing layout.
(() => {
  const motionPointer = matchMedia('(prefers-reduced-motion: no-preference) and (pointer: fine) and (hover: hover) and (min-width: 981px)');
  const magneticItems = document.querySelectorAll('.hero__actions a, .header-contact, .project__arrow');
  magneticItems.forEach(item => {
    item.addEventListener('pointermove', event => {
      if (!motionPointer.matches) return;
      const rect = item.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - .5) * 8;
      const y = ((event.clientY - rect.top) / rect.height - .5) * 8;
      item.style.translate = `${x}px ${y}px`;
    }, { passive: true });
    item.addEventListener('pointerleave', () => { item.style.translate = ''; });
  });

  document.querySelectorAll('.project__preview').forEach(preview => {
    preview.addEventListener('pointermove', event => {
      if (!motionPointer.matches) return;
      const rect = preview.getBoundingClientRect();
      preview.style.setProperty('--project-shift-x', `${((event.clientX - rect.left) / rect.width - .5) * 7}px`);
      preview.style.setProperty('--project-shift-y', `${((event.clientY - rect.top) / rect.height - .5) * 7}px`);
    }, { passive: true });
    preview.addEventListener('pointerleave', () => {
      preview.style.removeProperty('--project-shift-x');
      preview.style.removeProperty('--project-shift-y');
    });
  });
})();

// A small, real command interface. No evaluation or external commands run here.
(() => {
  const form = document.getElementById('terminal-form');
  if (!form) return;
  const input = document.getElementById('terminal-command');
  const output = document.getElementById('terminal-output');
  const commands = {
    whoami: ['Ritesh Singh — web developer & digital marketer. 4+ years connecting websites, search and campaigns.', '#about', 'Meet Ritesh'],
    skills: ['WordPress · HTML · CSS · JavaScript · SEO · Google Ads · Meta Ads. Build, reach, measure and improve.', '#expertise', 'Explore expertise'],
    projects: ['Explore twelve website, e-commerce and digital marketing projects in the portfolio.', '#work', 'View projects'],
    contact: ['Let’s discuss your website or campaign: buildwritesh@gmail.com', '#contact', 'Start a conversation'],
    help: ['Available commands: whoami, skills, projects, contact. Curious? Try “source”.'],
    source: ['Behind this page: semantic HTML, CSS, JavaScript and carefully considered motion. Small details matter.']
  };
  const run = value => {
    const command = String(value).trim().toLowerCase().replace(/^\$\s*/, '');
    const result = commands[command] || ['Command not found. Try help, whoami, skills, projects or contact.'];
    output.replaceChildren(document.createTextNode(result[0]));
    if (result[1]) { const link = document.createElement('a'); link.href = result[1]; link.textContent = result[2] + ' ↗'; output.append(document.createElement('br'), link); }
    document.querySelectorAll('[data-terminal]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.terminal === command)));
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) output.animate([{opacity:.35,transform:'translateY(4px)'},{opacity:1,transform:'none'}],{duration:230,easing:'ease-out'});
  };
  document.querySelectorAll('[data-terminal]').forEach(button => button.addEventListener('click', () => run(button.dataset.terminal)));
  form.addEventListener('submit', event => { event.preventDefault(); run(input.value); input.value = ''; });
  document.addEventListener('keydown', event => { if (event.altKey && event.key.toLowerCase() === 't') { event.preventDefault(); input.focus(); } });
})();
(() => {
  const cursor = document.querySelector('.custom-cursor');
  document.querySelectorAll('.terminal-commands button').forEach(button => {
    button.addEventListener('pointerenter', () => cursor?.classList.add('is-code'));
    button.addEventListener('pointerleave', () => cursor?.classList.remove('is-code'));
  });
})();

// Pointer feedback is confined to a small decorative panel and stops on touch.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(pointer: fine) and (hover: hover) and (min-width: 981px)');
  const panel = document.querySelector('.hero__perspective');
  if (!panel) return;
  panel.addEventListener('pointermove', event => {
    if (reduce.matches || !fine.matches) return;
    const rect = panel.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1,(event.clientY-rect.top)/rect.height));
    panel.style.setProperty('--scan-position', `${ratio*100}%`);
    panel.style.setProperty('--bracket-shift', `${(ratio-.5)*10}px`);
  }, {passive:true});
  panel.addEventListener('pointerleave', () => { panel.style.removeProperty('--scan-position'); panel.style.removeProperty('--bracket-shift'); });
})();

// Shared interactions also cover cards inserted by the blog and media feeds.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(pointer: fine) and (hover: hover) and (min-width: 981px)');
  const surfaceSelector = '.service-card, .timeline__item, .approach li, .skills dl>div, .social-links a, .contact__links a, .contact-form, .developer-terminal, .education article, .certifications article, .article-card, .social-card, .content-state, .article-aside>div, .admin-stats>div, .admin-post-item, .admin-media-item';
  document.querySelectorAll(surfaceSelector).forEach(element => element.classList.add('interactive-surface'));
  let pointerFrame = 0;
  let hoverSurface = null;
  let coordinates = null;
  document.addEventListener('pointermove', event => {
    if (reduced.matches || !pointer.matches || event.pointerType === 'touch') return;
    const surface = event.target.closest?.(surfaceSelector);
    if (!surface) return;
    hoverSurface = surface;
    coordinates = { x: event.clientX, y: event.clientY };
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      if (!hoverSurface?.isConnected) return;
      const rect = hoverSurface.getBoundingClientRect();
      hoverSurface.style.setProperty('--spot-x', (coordinates.x - rect.left) + 'px');
      hoverSurface.style.setProperty('--spot-y', (coordinates.y - rect.top) + 'px');
    });
  }, { passive: true });

  const header = document.querySelector('.site-header');
  const progress = document.createElement('div');
  progress.className = 'reading-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.append(progress);
  let scrollFrame = 0;
  let previousY = scrollY;
  const updateScroll = () => {
    scrollFrame = 0;
    const y = Math.max(0, scrollY);
    const distance = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = 'scaleX(' + (distance > 0 ? Math.min(1, y / distance) : 0) + ')';
    header?.classList.toggle('is-compact', y > 40);
    if (!reduced.matches && !header?.contains(document.activeElement) && !document.body.classList.contains('menu-open')) {
      if (y < 180 || previousY - y > 5) header?.classList.remove('is-hidden');
      else if (y - previousY > 5) header?.classList.add('is-hidden');
    }
    previousY = y;
  };
  const scheduleScroll = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll); };
  addEventListener('scroll', scheduleScroll, { passive: true });
  addEventListener('resize', scheduleScroll, { passive: true });
  header?.addEventListener('focusin', () => header.classList.remove('is-hidden'));
  updateScroll();

  // A short departure transition only on ordinary internal page navigation.
  const transition = document.createElement('div');
  transition.className = 'page-transition';
  transition.setAttribute('aria-hidden', 'true');
  document.body.append(transition);
  let navigating = false;
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || reduced.matches || document.body.classList.contains('admin-page')) return;
    const link = event.target.closest?.('a[href]');
    if (!link || link.hasAttribute('download') || link.target || link.closest('[contenteditable]')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname || /\.[a-z0-9]+$/i.test(url.pathname)) return;
    if (url.pathname.startsWith('/api/')) return;
    event.preventDefault();
    if (navigating) return;
    navigating = true;
    transition.setAttribute('data-route', '$ loading ' + url.pathname + '...');
    transition.classList.add('is-active');
    setTimeout(() => location.assign(url.href), 450);
  });
  addEventListener('pageshow', () => { navigating = false; transition.classList.remove('is-active'); });

  // Observe only supplemental elements; existing GSAP and feed reveals retain ownership.
  const revealTargets = document.querySelectorAll('.approach li, .education article, .certifications article, .skills dl>div, .content-main__heading, .related, .article-aside>div');
  if (!reduced.matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.animate([{ opacity: .5, translate: '0 12px' }, { opacity: 1, translate: '0 0' }], { duration: 420, easing: 'cubic-bezier(.2,.75,.25,1)' });
        observer.unobserve(entry.target);
      });
    }, { threshold: .08 });
    revealTargets.forEach(element => observer.observe(element));
  }
})();
