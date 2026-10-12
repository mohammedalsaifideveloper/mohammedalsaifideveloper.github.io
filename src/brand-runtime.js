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
})();
