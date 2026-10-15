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
    for (const meta of document.head.querySelectorAll('meta[name="theme-color"]')) if (meta.content !== '#1E3E89') meta.content = '#1E3E89';
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

  // Keep the original Swiper motion and links; replace only the service icons
  // and the Arabic labels that differ from the reference.
  const serviceCards = [
    {icon: 'trasfer_light'},
    {icon: 'saifi_cash', arabicName: 'الصيفي كاش'},
    {icon: 'recharg'},
    {icon: 'pay_puch'},
    {icon: 'trasfer_p2p', arabicName: 'دفع المشتريات'},
    {icon: 'whindraw'},
    {icon: 'payment'},
    {icon: 'geme', arabicName: 'خدمات ترفيه'},
    {icon: 'saifi'}
  ];
  function refreshServiceCards() {
    const section = document.querySelector('[aria-label="Services section"]');
    const wrapper = section?.querySelector('.swiper-wrapper');
    if (!wrapper) return;
    const slides = wrapper.querySelectorAll('.swiper-slide');
    slides.forEach((slide, fallbackIndex) => {
      const dataIndex = slide.getAttribute('data-swiper-slide-index');
      const slideIndex = dataIndex === null ? Number.NaN : Number(dataIndex);
      const index = Number.isInteger(slideIndex) && slideIndex >= 0 ? slideIndex : fallbackIndex % serviceCards.length;
      const item = serviceCards[index];
      if (!item) return;
      const card = slide.querySelector('.group > div');
      card?.classList.add('saifi-service-card');
      const heading = slide.querySelector('h3');
      if (item.arabicName && location.pathname.startsWith('/ar') && heading && heading.textContent !== item.arabicName) {
        heading.textContent = item.arabicName;
      }
      heading?.classList.add('saifi-service-label');
      const icon = slide.querySelector('img');
      if (icon && icon.dataset.saifiServiceIcon !== item.icon) {
        icon.src = `/assets/brand/service-icons/${item.icon}.svg`;
        icon.removeAttribute('srcset');
        icon.alt = heading?.textContent?.trim() || 'SAIFI';
        icon.dataset.saifiServiceIcon = item.icon;
      }
      icon?.classList.add('saifi-service-icon');
    });
  }
  refreshServiceCards();
  new MutationObserver(refreshServiceCards).observe(document.documentElement, {childList: true, subtree: true});
})();
