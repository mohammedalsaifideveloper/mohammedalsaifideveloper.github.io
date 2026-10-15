/* Keep head metadata on SAIFI when the retained client refreshes SEO tags. */
(() => {
  const socialImage = location.origin + '/assets/brand/saifi-social.png';
  function refresh() {
    for (const meta of document.head.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]')) {
      if (meta.content !== socialImage) meta.content = socialImage;
    }
    for (const [key, value] of [['og:image:width', '1200'], ['og:image:height', '630']]) {
      for (const meta of document.head.querySelectorAll('meta[property="' + key + '"]')) if (meta.content !== value) meta.content = value;
    }
    for (const meta of document.head.querySelectorAll('meta[name="theme-color"]')) if (meta.content !== '#22366B') meta.content = '#22366B';
    for (const meta of document.head.querySelectorAll('meta[name="twitter:site"], meta[name="twitter:creator"]')) meta.remove();
  }
  refresh();
  new MutationObserver(refresh).observe(document.head, {childList: true, subtree: true, attributes: true, attributeFilter: ['content']});

  // Rebrand the download card after its client-rendered content is mounted.
  // The retained page data can still contain the previous app name or mark.
  const downloadLogo = '/assets/brand/saifi-icon-512.png';
  function refreshDownloadCard() {
    const section = document.querySelector('[aria-label="Download app section"]');
    if (!section) return;

    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
    let textNode;
    while ((textNode = walker.nextNode())) {
      if (textNode.nodeValue.includes('جيب')) textNode.nodeValue = textNode.nodeValue.replaceAll('جيب', 'صيفي');
    }

    const currentMark = section.querySelector('img, svg');
    if (!currentMark) return;
    let image = currentMark;
    if (currentMark.tagName.toLowerCase() === 'svg') {
      image = document.createElement('img');
      image.className = currentMark.getAttribute('class') || '';
      currentMark.replaceWith(image);
    }
    if (!image.src.endsWith(downloadLogo)) image.src = downloadLogo;
    image.removeAttribute('srcset');
    image.alt = 'شعار صيفي';
    image.classList.add('saifi-download-brand-logo');
  }

  refreshDownloadCard();
  new MutationObserver(refreshDownloadCard).observe(document.documentElement, {childList: true, subtree: true, characterData: true});
})();
