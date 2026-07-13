(function () {
  function initShare() {
    const shareBtn = document.getElementById('shareBtn');
    if (!shareBtn) return;

    shareBtn.addEventListener('click', async () => {
      const shareData = {
        title: 'XO Game',
        text: 'Join the XO game',
        url: window.location.href,
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch (error) {
          console.warn('Share canceled', error);
        }
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareData.url);
        alert('Link copied to clipboard');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShare, { once: true });
  } else {
    initShare();
  }
})();
