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

  // Convert the nine homepage service cards from a carousel to the compact
  // three-column menu shown in the supplied reference, with consistent icons.
  const serviceIcons = [
    [/تحويلات مالية|Money Transfers/i, 'transfers'],
    [/شبكة تحويل|Tehweel Network/i, 'network'],
    [/الشحن والسداد|Recharge and Bill Payment/i, 'recharge'],
    [/شراء أونلاين|Online Shopping/i, 'online-shopping'],
    [/دفع مشتريات|Purchase Payments/i, 'purchases'],
    [/سحب نقدي|Cash Withdrawal/i, 'cash-withdrawal'],
    [/المدفوعات|Payments/i, 'payments'],
    [/خدمات الترفيه|Entertainment Services/i, 'entertainment'],
    [/صيفي|SAIFI/i, 'saifi']
  ];
  function refreshServiceGrid() {
    const section = document.querySelector('[aria-label="Services section"]');
    const wrapper = section?.querySelector('.swiper-wrapper');
    if (!section || !wrapper) return;
    wrapper.classList.add('saifi-services-grid');
    wrapper.querySelectorAll('.swiper-slide').forEach((slide, index) => {
      slide.classList.add('saifi-service-tile');
      const card = slide.querySelector('.group > div');
      card?.classList.add('saifi-service-card');
      const icon = slide.querySelector('img');
      const label = slide.querySelector('h3')?.textContent?.trim() || '';
      const iconName = serviceIcons.find(([pattern]) => pattern.test(label))?.[1] || serviceIcons[index % serviceIcons.length][1];
      if (icon) {
        icon.src = `/assets/brand/service-icons/${iconName}.svg`;
        icon.removeAttribute('srcset');
        icon.alt = slide.querySelector('h3')?.textContent?.trim() || 'SAIFI';
        icon.classList.add('saifi-service-icon');
      }
      slide.querySelector('h3')?.classList.add('saifi-service-label');
    });
  }
  refreshServiceGrid();
  new MutationObserver(refreshServiceGrid).observe(document.documentElement, {childList: true, subtree: true});
})();
