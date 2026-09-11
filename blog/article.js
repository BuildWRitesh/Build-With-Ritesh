(() => {
  'use strict';

  const copyButton = document.querySelector('[data-share-copy]');
  const status = document.querySelector('[data-share-status]');
  const announce = message => { if (status) status.textContent = message; };
  copyButton?.addEventListener('click', async () => {
    const value = document.body.dataset.articleUrl || window.location.href;
    try {
      await navigator.clipboard.writeText(value);
      announce('Article link copied.');
    } catch {
      announce('Copy is unavailable here. You can copy the URL from your browser.');
    }
  });
})();
