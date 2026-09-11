(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined';
  const header = document.querySelector('.site-header');
  const menuButton = document.querySelector('.menu-toggle');
  const mobileMenu = document.querySelector('.mobile-menu');
  const cursor = document.querySelector('.cursor');

  document.getElementById('year').textContent = new Date().getFullYear();

  let previousScroll = 0;
  window.addEventListener('scroll', () => {
    const currentScroll = window.scrollY;
    header.classList.toggle('scrolled', currentScroll > 24);
    header.classList.toggle('hide', currentScroll > previousScroll && currentScroll > 180 && !document.body.classList.contains('menu-open'));
    previousScroll = currentScroll;
  }, { passive: true });

  function toggleMenu(forceClose = false) {
    const isOpen = forceClose ? false : !document.body.classList.contains('menu-open');
    document.body.classList.toggle('menu-open', isOpen);
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    mobileMenu.setAttribute('aria-hidden', String(!isOpen));

    if (hasGSAP && !reduceMotion) {
      gsap.to(mobileMenu, { autoAlpha: isOpen ? 1 : 0, duration: .45, ease: 'power3.out' });
      gsap.fromTo('.mobile-menu a', { y: isOpen ? 40 : 0, opacity: isOpen ? 0 : 1 }, {
        y: isOpen ? 0 : -20,
        opacity: isOpen ? 1 : 0,
        stagger: .06,
        duration: .5,
        ease: 'power3.out'
      });
    } else {
      mobileMenu.style.visibility = isOpen ? 'visible' : 'hidden';
      mobileMenu.style.opacity = isOpen ? '1' : '0';
    }
  }

  menuButton.addEventListener('click', () => toggleMenu());
  mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => toggleMenu(true)));

  if (window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('mousemove', event => {
      cursor.classList.add('is-active');
      if (hasGSAP) gsap.to(cursor, { x: event.clientX, y: event.clientY, duration: .18, ease: 'power2.out' });
      else cursor.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    });

    document.querySelectorAll('.cursor-view').forEach(element => {
      element.addEventListener('mouseenter', () => cursor.classList.add('is-view'));
      element.addEventListener('mouseleave', () => cursor.classList.remove('is-view'));
    });

    document.querySelectorAll('.magnetic').forEach(element => {
      element.addEventListener('mousemove', event => {
        if (!hasGSAP || reduceMotion) return;
        const rect = element.getBoundingClientRect();
        gsap.to(element, {
          x: (event.clientX - rect.left - rect.width / 2) * .18,
          y: (event.clientY - rect.top - rect.height / 2) * .18,
          duration: .3
        });
      });
      element.addEventListener('mouseleave', () => hasGSAP && gsap.to(element, { x: 0, y: 0, duration: .6, ease: 'elastic.out(1, .4)' }));
    });
  }

  if (!hasGSAP || reduceMotion) {
    document.querySelector('.loader')?.remove();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  function splitWords(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.trim()) nodes.push(walker.currentNode);
    }
    nodes.forEach(node => {
      const fragment = document.createDocumentFragment();
      const parts = node.nodeValue.split(/(\s+)/);
      parts.forEach(part => {
        if (/^\s+$/.test(part)) fragment.appendChild(document.createTextNode(part));
        else if (part) {
          const wrap = document.createElement('span');
          wrap.className = 'word-wrap';
          const word = document.createElement('span');
          word.className = 'word';
          word.textContent = part;
          wrap.appendChild(word);
          fragment.appendChild(wrap);
        }
      });
      node.parentNode.replaceChild(fragment, node);
    });
  }

  document.querySelectorAll('.split-text').forEach(splitWords);

  const loaderTimeline = gsap.timeline({
    onComplete: () => document.querySelector('.loader')?.remove()
  });
  const count = { value: 0 };
  loaderTimeline
    .to(count, { value: 100, duration: 1.05, ease: 'power2.inOut', onUpdate: () => {
      document.querySelector('.loader__count').textContent = String(Math.round(count.value)).padStart(2, '0');
    }})
    .to('.loader__line span', { width: '100%', duration: 1.05, ease: 'power2.inOut' }, 0)
    .to('.loader', { yPercent: -100, duration: .8, ease: 'power4.inOut' })
    .from('.hero__title .title-line > span', { yPercent: 110, duration: 1, stagger: .1, ease: 'power4.out' }, '-=.15')
    .from('.hero__eyebrow, .hero__lower', { opacity: 0, y: 25, duration: .65, stagger: .12, ease: 'power3.out' }, '-=.65');

  gsap.utils.toArray('.split-text').forEach(element => {
    gsap.from(element.querySelectorAll('.word'), {
      scrollTrigger: { trigger: element, start: 'top 85%', once: true },
      yPercent: 115,
      duration: .8,
      stagger: .025,
      ease: 'power4.out'
    });
  });

  gsap.utils.toArray('.reveal-up, .reveal-row').forEach(element => {
    gsap.from(element, {
      scrollTrigger: { trigger: element, start: 'top 90%', once: true },
      y: 32,
      opacity: 0,
      duration: .75,
      ease: 'power3.out'
    });
  });

  gsap.utils.toArray('.services .reveal-card').forEach((element, index) => {
    gsap.from(element, {
      scrollTrigger: { trigger: '.services', start: 'top 82%', once: true },
      y: 70,
      opacity: 0,
      duration: .9,
      delay: index * .09,
      ease: 'power3.out'
    });
  });

  gsap.utils.toArray('.work-card').forEach((element, index) => {
    gsap.from(element, {
      scrollTrigger: { trigger: element, start: 'top 92%', once: true },
      y: 55,
      opacity: 0,
      duration: .8,
      delay: (index % 4) * .05,
      ease: 'power3.out'
    });
  });

  gsap.to('.hero__title', {
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 },
    yPercent: 18,
    opacity: .25,
    ease: 'none'
  });

  gsap.utils.toArray('.phone').forEach(phone => {
    const speed = Number(phone.dataset.speed || 1);
    gsap.fromTo(phone, { y: speed < 1 ? 80 : -50 }, {
      y: speed < 1 ? -55 : 55,
      ease: 'none',
      scrollTrigger: { trigger: '.case-study__visual', start: 'top bottom', end: 'bottom top', scrub: 1.2 }
    });
  });

  document.querySelectorAll('[data-count]').forEach(element => {
    const target = Number(element.dataset.count);
    const suffix = element.dataset.suffix || '';
    const decimals = target % 1 === 0 ? 0 : 1;
    const value = { current: 0 };
    gsap.to(value, {
      current: target,
      duration: 1.8,
      ease: 'power3.out',
      scrollTrigger: { trigger: element, start: 'top 90%', once: true },
      onUpdate: () => {
        element.textContent = value.current.toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        }) + suffix;
      }
    });
  });

  gsap.to('.contact__orb', {
    xPercent: -10,
    yPercent: 12,
    scale: 1.12,
    ease: 'none',
    scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'bottom bottom', scrub: 1 }
  });

  ScrollTrigger.refresh();
})();
