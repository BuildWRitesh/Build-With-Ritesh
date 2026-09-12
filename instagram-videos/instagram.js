(() => {
  'use strict';

  const grid = document.getElementById('instagram-grid');
  const loading = document.getElementById('instagram-loading');
  const empty = document.getElementById('instagram-empty');
  const error = document.getElementById('instagram-error');
  const retry = document.getElementById('instagram-retry');
  if (!grid || !loading || !empty || !error) return;

  const fallbackUrl = '../data/instagram-videos.json';
  const show = (element, visible) => { element.hidden = !visible; };
  const formatDate = value => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  };
  const isVideoMedia = item => {
    const type = String(item.media_type || item.mediaType || '').toUpperCase();
    const product = String(item.media_product_type || item.mediaProductType || '').toUpperCase();
    return String(item.kind || '').toLowerCase() === 'video' || type === 'VIDEO' || product === 'REELS' || item.is_video === true;
  };
  const hasVideoMedia = item => item && isVideoMedia(item) && (item.thumbnail_url || item.thumbnailUrl || item.media_url || item.mediaUrl) && item.permalink;
  const render = videos => {
    grid.replaceChildren();
    const items = videos.filter(hasVideoMedia);
    items.forEach((video, index) => {
      const card = document.createElement('article');
      card.className = 'social-card reveal-content';
      card.style.transitionDelay = `${Math.min(index, 5) * 45}ms`;
      const link = document.createElement('a');
      link.href = video.permalink || 'https://www.instagram.com/buildwritesh/';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.dataset.cursor = 'project';
      link.setAttribute('aria-label', `Open Instagram video${video.caption ? `: ${video.caption.slice(0, 60)}` : ''}`);
      const media = document.createElement('div');
      media.className = 'social-card__media';
      const mediaUrl = video.media_url || video.mediaUrl || '';
      const thumbnailUrl = video.thumbnail_url || video.thumbnailUrl || mediaUrl;
      if (mediaUrl) {
        const player = document.createElement('video');
        player.src = mediaUrl;
        if (thumbnailUrl) player.poster = thumbnailUrl;
        player.muted = true;
        player.playsInline = true;
        player.preload = 'metadata';
        player.controls = true;
        player.addEventListener('error', () => {
          player.remove();
          if (!thumbnailUrl) return;
          const image = document.createElement('img');
          image.src = thumbnailUrl;
          image.alt = video.imageAlt || (video.caption ? video.caption.slice(0, 120) : 'Ritesh Singh Instagram video preview');
          image.loading = 'lazy';
          image.decoding = 'async';
          media.prepend(image);
        }, { once: true });
        media.append(player);
      } else if (thumbnailUrl) {
        const image = document.createElement('img');
        image.src = thumbnailUrl;
        image.alt = video.imageAlt || (video.caption ? video.caption.slice(0, 120) : 'Ritesh Singh Instagram video preview');
        image.loading = 'lazy';
        image.decoding = 'async';
        image.width = 720;
        image.height = 960;
        image.addEventListener('error', () => image.remove(), { once: true });
        media.append(image);
      }
      const play = document.createElement('span');
      play.className = 'social-card__play';
      play.setAttribute('aria-hidden', 'true');
      play.textContent = '▶';
      media.append(play);
      const body = document.createElement('div');
      body.className = 'social-card__body';
      const caption = document.createElement('p');
      caption.textContent = video.caption || 'Watch the original video on Instagram.';
      const meta = document.createElement('div');
      meta.className = 'social-card__meta';
      const type = document.createElement('span');
      type.textContent = String(video.media_product_type || video.mediaProductType || 'Video').replaceAll('_', ' ');
      const date = document.createElement('span');
      date.textContent = formatDate(video.timestamp);
      meta.append(type, date);
      body.append(caption, meta);
      link.append(media, body);
      card.append(link);
      grid.append(card);
    });
    show(grid, items.length > 0);
    [...grid.querySelectorAll('.reveal-content')].forEach(card => {
      if (!('IntersectionObserver' in window)) { card.classList.add('is-visible'); return; }
      const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
      observer.observe(card);
    });
  };
  const load = async () => {
    show(loading, true); show(empty, false); show(error, false); show(grid, false);
    try {
      let response = await fetch('/api/instagram-videos', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) response = await fetch(fallbackUrl, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error(`Unable to load Instagram videos (${response.status})`);
      const payload = await response.json();
      const videos = Array.isArray(payload) ? payload : payload.videos;
      const verified = (Array.isArray(videos) ? videos : []).filter(hasVideoMedia);
      show(loading, false);
      if (!verified.length) { show(empty, true); return; }
      render(verified);
    } catch (loadError) {
      console.error(loadError);
      show(loading, false); show(error, true);
    }
  };
  retry?.addEventListener('click', load);
  load();
})();
