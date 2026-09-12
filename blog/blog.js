(() => {
  'use strict';

  const list = document.getElementById('blog-list');
  const loading = document.getElementById('blog-loading');
  const empty = document.getElementById('blog-empty');
  const error = document.getElementById('blog-error');
  const retry = document.getElementById('blog-retry');
  const search = document.getElementById('blog-search');
  const category = document.getElementById('blog-category');
  const resultStatus = document.getElementById('blog-result-status');
  if (!list || !loading || !empty || !error) return;

  let posts = [];
  const fallbackUrl = '/blog/posts.json';
  const assetUrl = value => {
    if (!value) return '';
    if (/^(?:https?:|data:|\/)/i.test(value)) return value;
    return `../${value.replace(/^\.\//, '')}`;
  };
  const formatDate = value => {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value || '';
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  };
  const show = (element, visible) => { element.hidden = !visible; };
  const fetchWithTimeout = (url, options = {}, timeout = 6000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
  const revealCards = () => {
    const cards = [...list.querySelectorAll('.reveal-content')];
    if (!('IntersectionObserver' in window)) { cards.forEach(card => card.classList.add('is-visible')); return; }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    cards.forEach(card => observer.observe(card));
  };
  const render = () => {
    const term = String(search?.value || '').trim().toLowerCase();
    const selected = category?.value || 'all';
    const filtered = posts.filter(post => {
      const haystack = [post.title, post.excerpt, post.category, ...(post.tags || [])].join(' ').toLowerCase();
      return (selected === 'all' || post.category === selected) && (!term || haystack.includes(term));
    });
    list.replaceChildren();
    filtered.forEach((post, index) => {
      const card = document.createElement('article');
      card.className = 'article-card reveal-content';
      card.style.transitionDelay = `${Math.min(index, 5) * 45}ms`;
      const link = document.createElement('a');
      link.className = 'article-card__link';
      link.dataset.cursor = 'project';
      link.href = `./${encodeURIComponent(post.slug)}/`;
      const imageWrap = document.createElement('div');
      imageWrap.className = 'article-card__image-wrap';
      const image = document.createElement('img');
      image.className = 'article-card__image';
      image.src = assetUrl(post.featuredImage);
      image.alt = post.imageAlt || `${post.title} featured image`;
      image.width = 800;
      image.height = 500;
      image.loading = 'lazy';
      image.decoding = 'async';
      imageWrap.append(image);
      const body = document.createElement('div');
      body.className = 'article-card__body';
      const meta = document.createElement('div');
      meta.className = 'article-card__meta';
      const categoryText = document.createElement('strong');
      categoryText.textContent = post.category || 'Journal';
      const dateText = document.createElement('span');
      dateText.textContent = formatDate(post.date);
      meta.append(categoryText, dateText);
      if (post.readingMinutes || post.contentHtml) {
        const reading = document.createElement('span');
        const words = String(post.contentHtml || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
        reading.textContent = (post.readingMinutes || Math.max(1, Math.ceil(words / 220))) + ' min read';
        meta.append(reading);
      }
      const title = document.createElement('h3');
      title.textContent = post.title;
      const excerpt = document.createElement('p');
      excerpt.textContent = post.excerpt;
      const read = document.createElement('span');
      read.className = 'article-card__read';
      read.append(document.createTextNode('Read article'), Object.assign(document.createElement('span'), { textContent: '↗', ariaHidden: 'true' }));
      body.append(meta, title, excerpt, read);
      link.append(imageWrap, body);
      card.append(link);
      list.append(card);
    });
    show(empty, !filtered.length && posts.length > 0);
    show(list, filtered.length > 0);
    if (resultStatus) resultStatus.textContent = filtered.length ? `${filtered.length} ${filtered.length === 1 ? 'article' : 'articles'} shown` : '';
    revealCards();
  };
  const populateCategories = () => {
    const categories = [...new Set(posts.map(post => post.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    category?.querySelectorAll('option:not(:first-child)').forEach(option => option.remove());
    categories.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      category?.append(option);
    });
  };
  const applyPosts = payload => {
    const candidate = Array.isArray(payload) ? payload : payload.posts;
    posts = (Array.isArray(candidate) ? candidate : []).filter(post => post && post.status === 'published' && post.slug && post.title);
    populateCategories();
    show(loading, false);
    if (!posts.length) { show(empty, true); return; }
    render();
  };
  const load = async () => {
    show(loading, true); show(error, false); show(empty, false); show(list, false);
    if (resultStatus) resultStatus.textContent = '';
    try {
      const response = await fetchWithTimeout(fallbackUrl, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error(`Unable to load articles (${response.status})`);
      applyPosts(await response.json());
      fetchWithTimeout('/api/posts?status=published', { headers: { Accept: 'application/json' }, cache: 'no-store' }, 3000)
        .then(apiResponse => apiResponse.ok ? apiResponse.json() : null)
        .then(payload => { if (payload) applyPosts(payload); })
        .catch(() => {});
    } catch (loadError) {
      console.error(loadError);
      show(loading, false); show(error, true);
    }
  };
  search?.addEventListener('input', render);
  category?.addEventListener('change', render);
  retry?.addEventListener('click', load);
  load();
})();
