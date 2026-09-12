(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const loginView = $('login-view');
  const dashboard = $('dashboard-view');
  const loginForm = $('login-form');
  const loginStatus = $('login-status');
  const editorStatus = $('editor-status');
  const listStatus = $('post-list-status');
  const postList = $('post-list');
  const postForm = $('post-form');
  const accountForm = $('account-form');
  const accountStatus = $('account-status');
  if (!loginView || !dashboard || !loginForm || !postForm) return;

  const fields = {
    title: $('post-title'), slug: $('post-slug'), excerpt: $('post-excerpt'), category: $('post-category'),
    status: $('post-status'), date: $('post-date'), imageUrl: $('post-image-url'), imageAlt: $('post-image-alt'),
    seoTitle: $('post-seo-title'), metaDescription: $('post-meta-description'), focusKeyword: $('post-focus-keyword'),
    canonical: $('post-canonical'), tags: $('post-tags'), editor: $('post-editor'), source: $('post-source-editor'), originalSlug: $('post-original-slug')
  };
  let posts = [];
  let currentPost = null;
  let slugManuallyChanged = false;
  let uploadMode = 'featured';
  let csrfToken = '';

  const setStatus = (element, message, isError = false) => {
    if (!element) return;
    element.textContent = message || '';
    element.classList.toggle('is-error', isError);
  };
  const api = async (url, options = {}) => {
    const method = String(options.method || 'GET').toUpperCase();
    const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) }, ...options });
    let payload = {};
    try { payload = await response.json(); } catch { /* empty response */ }
    if (!response.ok) throw Object.assign(new Error(payload.error || `Request failed (${response.status})`), { status: response.status, payload });
    return payload;
  };
  const slugify = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
  const today = () => new Date().toISOString().slice(0, 10);
  const setView = authenticated => {
    loginView.hidden = authenticated;
    dashboard.hidden = !authenticated;
  };
  const parseTags = value => String(value || '').split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 12);
  const previewUrl = url => {
    if (!url) return '';
    if (/^(?:https?:|data:|\/)/i.test(url)) return url;
    return `../${String(url).replace(/^\.\//, '')}`;
  };
  const setPreview = (url, alt) => {
    const wrapper = $('post-image-preview');
    const image = $('post-image-preview-image');
    if (!wrapper || !image) return;
    if (!url) { wrapper.hidden = true; image.removeAttribute('src'); return; }
    image.src = previewUrl(url);
    image.alt = alt || 'Featured image preview';
    wrapper.hidden = false;
  };
  const resetEditor = () => {
    currentPost = null;
    slugManuallyChanged = false;
    fields.originalSlug.value = '';
    fields.title.value = '';
    fields.slug.value = '';
    fields.excerpt.value = '';
    fields.category.value = '';
    fields.status.value = 'draft';
    fields.date.value = today();
    fields.imageUrl.value = '';
    fields.imageAlt.value = '';
    fields.seoTitle.value = '';
    fields.metaDescription.value = '';
    fields.focusKeyword.value = '';
    fields.canonical.value = '';
    fields.tags.value = '';
    fields.editor.innerHTML = '<p></p>';
    fields.source.value = '';
    fields.editor.hidden = false;
    fields.source.hidden = true;
    document.querySelector('[data-action="source"]')?.setAttribute('aria-pressed', 'false');
    $('editor-title').textContent = 'New article';
    $('delete-post-button').hidden = true;
    setPreview('', '');
    setStatus(editorStatus, '');
    postList?.querySelectorAll('.admin-post-item').forEach(item => item.classList.remove('is-active'));
  };
  const fillEditor = post => {
    currentPost = post;
    slugManuallyChanged = true;
    fields.originalSlug.value = post.slug || '';
    fields.title.value = post.title || '';
    fields.slug.value = post.slug || '';
    fields.excerpt.value = post.excerpt || '';
    fields.category.value = post.category || '';
    fields.status.value = post.status === 'published' ? 'published' : 'draft';
    fields.date.value = post.date || today();
    fields.imageUrl.value = post.featuredImage || '';
    fields.imageAlt.value = post.imageAlt || '';
    fields.seoTitle.value = post.seoTitle || '';
    fields.metaDescription.value = post.metaDescription || '';
    fields.focusKeyword.value = post.focusKeyword || '';
    fields.canonical.value = post.canonical || '';
    fields.tags.value = Array.isArray(post.tags) ? post.tags.join(', ') : '';
    fields.editor.innerHTML = post.contentHtml || '<p></p>';
    fields.source.value = fields.editor.innerHTML;
    fields.editor.hidden = false;
    fields.source.hidden = true;
    document.querySelector('[data-action="source"]')?.setAttribute('aria-pressed', 'false');
    $('editor-title').textContent = 'Edit article';
    $('delete-post-button').hidden = false;
    setPreview(post.featuredImage || '', post.imageAlt || 'Featured image preview');
    setStatus(editorStatus, `Editing ${post.title}`);
    postList?.querySelectorAll('.admin-post-item').forEach(item => item.classList.toggle('is-active', item.dataset.slug === post.slug));
  };
  const renderPosts = () => {
    if (!postList) return;
    const term = String($('post-search')?.value || '').trim().toLowerCase();
    const status = $('post-status-filter')?.value || 'all';
    const filtered = posts.filter(post => (!term || `${post.title || ''} ${post.excerpt || ''} ${post.category || ''}`.toLowerCase().includes(term)) && (status === 'all' || post.status === status));
    postList.replaceChildren();
    filtered.forEach(post => {
      const item = document.createElement('button');
      item.type = 'button'; item.className = 'admin-post-item'; item.dataset.slug = post.slug;
      if (currentPost?.slug === post.slug) item.classList.add('is-active');
      const title = document.createElement('strong'); title.textContent = post.title || 'Untitled';
      const meta = document.createElement('span'); meta.textContent = `${post.status || 'draft'} · ${post.category || 'Journal'} · ${post.date || ''}`;
      item.append(title, meta); item.addEventListener('click', () => fillEditor(posts.find(candidate => candidate.slug === post.slug) || post)); postList.append(item);
    });
    setStatus(listStatus, filtered.length ? `${filtered.length} ${filtered.length === 1 ? 'post' : 'posts'}` : 'No matching posts.');
  };
  const updateStats = () => {
    $('stat-total').textContent = String(posts.length);
    $('stat-published').textContent = String(posts.filter(post => post.status === 'published').length);
    $('stat-drafts').textContent = String(posts.filter(post => post.status === 'draft').length);
    const categories = [...new Set(posts.map(post => post.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const datalist = $('category-options');
    datalist?.replaceChildren(...categories.map(value => Object.assign(document.createElement('option'), { value })));
  };
  const loadPosts = async () => {
    try {
      const payload = await api('/api/admin/posts');
      posts = Array.isArray(payload.posts) ? payload.posts : [];
      updateStats(); renderPosts();
    } catch (error) {
      setStatus(listStatus, error.message, true);
      if (error.status === 401) { setView(false); setStatus(loginStatus, 'Your session has expired. Please sign in again.', true); }
    }
  };
  const loadAccount = async () => {
    if (!accountForm) return;
    const payload = await api('/api/admin/account');
    $('account-email').value = payload.user?.email || '';
  };
  const readFileAsDataUrl = file => new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.addEventListener('load', () => resolve(String(reader.result))); reader.addEventListener('error', reject); reader.readAsDataURL(file);
  });
  const uploadImage = async file => {
    if (!file) return null;
    if (file.size > 3 * 1024 * 1024) throw new Error('Choose an image smaller than 3 MB.');
    const data = await readFileAsDataUrl(file);
    const payload = await api('/api/admin/upload', { method: 'POST', body: JSON.stringify({ filename: file.name, mime: file.type, data }) });
    return payload.url ? String(payload.url).replace(/^\/+/, '') : null;
  };
  const getContentHtml = () => {
    if (!fields.source.hidden) fields.editor.innerHTML = fields.source.value;
    return fields.editor.innerHTML.trim();
  };
  const loadMedia = async () => {
    const list = $('media-list');
    if (!list) return;
    try {
      const payload = await api('/api/admin/media');
      const media = Array.isArray(payload.media) ? payload.media : [];
      list.replaceChildren(...media.map(item => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'admin-media-item'; button.title = `Use ${item.filename || 'image'}`;
        const image = document.createElement('img'); image.src = item.url; image.alt = item.alt_text || ''; image.loading = 'lazy';
        button.append(image);
        button.addEventListener('click', () => { fields.imageUrl.value = item.url; setPreview(item.url, fields.imageAlt.value); setStatus($('media-status'), 'Featured image selected.'); });
        return button;
      }));
      setStatus($('media-status'), media.length ? `${media.length} uploaded ${media.length === 1 ? 'image' : 'images'}.` : 'No uploaded images yet.');
    } catch (error) { setStatus($('media-status'), error.message, true); }
  };
  const savePost = async status => {
    const contentHtml = getContentHtml();
    const payload = {
      title: fields.title.value.trim(), slug: fields.slug.value.trim() || slugify(fields.title.value), excerpt: fields.excerpt.value.trim(), category: fields.category.value.trim(), status,
      date: fields.date.value || today(), featuredImage: fields.imageUrl.value.trim(), imageAlt: fields.imageAlt.value.trim(), seoTitle: fields.seoTitle.value.trim(), metaDescription: fields.metaDescription.value.trim(), focusKeyword: fields.focusKeyword.value.trim(), canonical: fields.canonical.value.trim(), tags: parseTags(fields.tags.value), contentHtml
    };
    if (!payload.title || !payload.excerpt || !payload.category || !payload.featuredImage || !payload.imageAlt || !payload.contentHtml) throw new Error('Title, excerpt, featured image, image ALT text and content are required.');
    const originalSlug = fields.originalSlug.value.trim();
    const endpoint = originalSlug ? `/api/admin/posts/${encodeURIComponent(originalSlug)}` : '/api/admin/posts';
    const response = await api(endpoint, { method: originalSlug ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    currentPost = response.post || null;
    setStatus(editorStatus, status === 'published' ? 'Article published.' : 'Draft saved.');
    await loadPosts();
    if (currentPost) fillEditor(currentPost);
  };

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!loginForm.reportValidity()) return;
    setStatus(loginStatus, 'Signing in…');
    try {
      const payload = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ email: $('login-email').value.trim(), password: $('login-password').value }) });
      csrfToken = payload.csrfToken || '';
      $('admin-user').textContent = payload.user?.email || '';
      $('account-email').value = payload.user?.email || '';
      $('login-password').value = '';
      setView(true); resetEditor(); await Promise.all([loadPosts(), loadMedia(), loadAccount()]);
    } catch (error) { setStatus(loginStatus, error.message, true); }
  });
  accountForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!accountForm.reportValidity()) return;
    const currentPassword = $('account-current-password').value;
    const newPassword = $('account-new-password').value;
    const confirmPassword = $('account-confirm-password').value;
    if ((newPassword || confirmPassword) && newPassword !== confirmPassword) { setStatus(accountStatus, 'New password and confirmation must match.', true); return; }
    setStatus(accountStatus, 'Updating credentials…');
    try {
      const payload = await api('/api/admin/account', { method: 'PUT', body: JSON.stringify({ email: $('account-email').value.trim(), currentPassword, newPassword, confirmPassword }) });
      csrfToken = '';
      accountForm.reset();
      $('login-email').value = payload.user?.email || '';
      setView(false);
      setStatus(loginStatus, 'Credentials updated. Please sign in again with the new details.');
    } catch (error) { setStatus(accountStatus, error.message, true); }
  });
  $('logout-button')?.addEventListener('click', async () => {
    try { await api('/api/admin/logout', { method: 'POST', body: '{}' }); } catch { /* show login even if the session already expired */ }
    csrfToken = ''; setView(false); setStatus(loginStatus, 'You have been signed out.');
  });
  $('new-post-button')?.addEventListener('click', resetEditor);
  $('refresh-media-button')?.addEventListener('click', loadMedia);
  $('post-search')?.addEventListener('input', renderPosts);
  $('post-status-filter')?.addEventListener('change', renderPosts);
  fields.title?.addEventListener('input', () => { if (!slugManuallyChanged) fields.slug.value = slugify(fields.title.value); });
  fields.slug?.addEventListener('input', () => { slugManuallyChanged = true; fields.slug.value = slugify(fields.slug.value); });
  $('post-image')?.addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      setStatus(editorStatus, 'Uploading image…');
      const url = await uploadImage(file);
      if (!url) throw new Error('Upload did not return an image path.');
      if (uploadMode === 'content') {
        if (!fields.source.hidden) fields.editor.innerHTML = fields.source.value;
        const articleImageUrl = /^https?:\/\//i.test(url) ? url : `/${url.replace(/^\/+/, '')}`;
        document.execCommand('insertHTML', false, `<img src="${articleImageUrl}" alt="${(fields.imageAlt.value || 'Article image').replaceAll('"', '&quot;')}">`);
        fields.source.value = fields.editor.innerHTML;
        setStatus(editorStatus, 'Image inserted into the article.');
      } else {
        fields.imageUrl.value = url; setPreview(url, fields.imageAlt.value); uploadMode = 'featured'; setStatus(editorStatus, 'Featured image uploaded.'); await loadMedia();
      }
    } catch (error) { setStatus(editorStatus, error.message, true); }
    uploadMode = 'featured';
    event.target.value = '';
  });
  document.querySelectorAll('.editor-toolbar [data-command]').forEach(button => button.addEventListener('click', () => {
    fields.editor.focus();
    const command = button.dataset.command;
    document.execCommand(command, false, button.dataset.value || null);
    fields.source.value = fields.editor.innerHTML;
  }));
  document.querySelector('.editor-toolbar [data-action="link"]')?.addEventListener('click', () => {
    fields.editor.focus();
    const url = window.prompt('Link URL');
    if (!url) return;
    document.execCommand('createLink', false, url);
    fields.source.value = fields.editor.innerHTML;
  });
  document.querySelector('.editor-toolbar [data-action="image"]')?.addEventListener('click', () => { uploadMode = 'content'; $('post-image').click(); });
  document.querySelector('.editor-toolbar [data-action="source"]')?.addEventListener('click', event => {
    if (fields.source.hidden) { fields.source.value = fields.editor.innerHTML; fields.editor.hidden = true; fields.source.hidden = false; event.currentTarget.setAttribute('aria-pressed', 'true'); fields.source.focus(); }
    else { fields.editor.innerHTML = fields.source.value; fields.editor.hidden = false; fields.source.hidden = true; event.currentTarget.setAttribute('aria-pressed', 'false'); fields.editor.focus(); }
  });
  postForm.addEventListener('submit', async event => {
    event.preventDefault();
    const status = event.submitter?.dataset.saveStatus || fields.status.value || 'draft';
    fields.status.value = status;
    setStatus(editorStatus, status === 'published' ? 'Publishing…' : 'Saving draft…');
    try { await savePost(status); } catch (error) { setStatus(editorStatus, error.message, true); }
  });
  $('delete-post-button')?.addEventListener('click', async () => {
    if (!currentPost?.slug || !window.confirm(`Delete “${currentPost.title}”? This cannot be undone.`)) return;
    try { await api(`/api/admin/posts/${encodeURIComponent(currentPost.slug)}`, { method: 'DELETE' }); resetEditor(); await loadPosts(); setStatus(editorStatus, 'Article deleted.'); }
    catch (error) { setStatus(editorStatus, error.message, true); }
  });

  (async () => {
    try {
      const payload = await api('/api/admin/session');
      if (payload.authenticated) { csrfToken = payload.csrfToken || ''; $('admin-user').textContent = payload.user?.email || ''; $('account-email').value = payload.user?.email || ''; setView(true); resetEditor(); await Promise.all([loadPosts(), loadMedia(), loadAccount()]); }
      else setView(false);
    } catch { setView(false); setStatus(loginStatus, 'The secure content service is unavailable. Check the production configuration.', true); }
  })();
})();
