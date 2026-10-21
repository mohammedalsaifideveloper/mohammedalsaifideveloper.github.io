/* Keep head metadata on SAIFI when the retained client refreshes SEO tags. */
(() => {
  // This file has its own IIFE; variables declared in runtime.js are not
  // available here. Keep the page snapshot and locale local to this script.
  const snapshot = window.__SAIFI_SNAPSHOT__ || {mainServices: [], routes: []};
  const locale = () => location.pathname.split('/')[1] === 'en' ? 'en' : 'ar';
  const isServicesPage = /^\/(?:ar|en)\/services\/?$/.test(location.pathname);

  // The server sends the loading overlay as HTML. React normally removes it
  // after 600 ms; avoid trapping visitors on a black screen if hydration
  // fails or is delayed on the static deployment.
  setTimeout(() => document.getElementById('saifi-loading-screen')?.remove(), 3000);

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

  // The services page has no download card. Avoid observing every React
  // mutation on that route for a component that cannot appear there.
  if (!isServicesPage) {
    refreshDownloadCard();
    new MutationObserver(refreshDownloadCard).observe(document.documentElement, {childList: true, subtree: true, characterData: true});
  }

  // Keep the original Swiper motion and links; replace only the service icons
  // and the Arabic labels that differ from the reference.
  const serviceCards = [
    {id: 1, icon: 'trasfer_light'},
    {id: 69, icon: 'saifi_cash', englishName: 'Saifi Cash', arabicName: 'الصيفي كاش'},
    {id: 2, icon: 'recharg'},
    {id: 3, icon: 'pay_puch'},
    {id: 4, icon: 'trasfer_p2p', arabicName: 'دفع المشتريات'},
    {id: 35, icon: 'whindraw'},
    {id: 6, icon: 'payment'},
    {id: 7, icon: 'geme', arabicName: 'خدمات ترفيه'},
    {id: 8, icon: 'saifi'}
  ];
  const servicesPageOrder = [1, 69, 2, 35, 4, 3, 8, 7, 6];
  const serviceName = item => {
    const record = snapshot.mainServices.find(service => Number(service.id) === item.id);
    return item.arabicName || record?.title || '';
  };
  const normalizeServiceText = value => String(value || '').toLocaleLowerCase().normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670]/g, '').replace(/\s+/g, ' ').trim();
  function serviceForElement(element) {
    const slide = element.closest?.('.swiper-slide');
    const rawIndex = slide?.getAttribute('data-swiper-slide-index');
    if (rawIndex !== null && rawIndex !== undefined && Number.isInteger(Number(rawIndex))) {
      return serviceCards[Number(rawIndex)];
    }
    const text = normalizeServiceText(element.getAttribute?.('aria-label') || element.innerText || element.textContent);
    return serviceCards.find(item => {
      const record = snapshot.mainServices.find(service => Number(service.id) === item.id);
      return [serviceName(item), record?.title, record?.enTitle].some(name => {
        const normalized = normalizeServiceText(name);
        return normalized && text.includes(normalized);
      });
    });
  }
  function refreshLinkedServiceCards() {
    for (const element of document.querySelectorAll('a[href], button, [role="button"]')) {
      const item = serviceForElement(element);
      if (!item) continue;
      const icon = element.querySelector('img');
      if (icon && icon.dataset.saifiServiceIcon !== item.icon) {
        icon.src = `/img/${item.icon}.svg`;
        icon.removeAttribute('srcset');
        icon.alt = serviceName(item) || 'SAIFI';
        icon.dataset.saifiServiceIcon = item.icon;
      }
      const heading = element.querySelector('h1, h2, h3, h4');
      if (heading && item.arabicName && location.pathname.startsWith('/ar')) heading.textContent = item.arabicName;
    }
  }
  function serviceRecordForText(value) {
    const text = normalizeServiceText(value);
    return snapshot.mainServices.find(record => {
      const item = serviceCards.find(candidate => candidate.id === Number(record.id));
      return [record.title, record.enTitle, item?.arabicName].some(name => {
        const normalized = normalizeServiceText(name);
        return normalized && text.includes(normalized);
      });
    });
  }
  function refreshServicesPageCards() {
    if (!/^\/(?:ar|en)\/services\/?$/.test(location.pathname)) return;
    const cardsById = new Map();
    for (const card of document.querySelectorAll('.cursor-pointer')) {
      const record = serviceRecordForText(card.innerText || card.textContent);
      const item = record && serviceCards.find(candidate => candidate.id === Number(record.id));
      if (!item) continue;

      // Keep a stable service ID on each actual card so labels and order never
      // depend on the order React happens to render the tiles.
      card.dataset.saifiServiceId = String(item.id);
      card.classList.add('saifi-services-page-card');
      const mappedAncestor = card.parentElement?.closest('.cursor-pointer[data-saifi-service-id]');
      if (!mappedAncestor && !cardsById.has(item.id)) cardsById.set(item.id, card);

      const heading = [...card.querySelectorAll('span, h1, h2, h3, h4, p')].find(element => {
        const value = normalizeServiceText(element.textContent);
        return [record.title, record.enTitle, item.arabicName].some(name => value && value === normalizeServiceText(name));
      });
      if (heading) {
        heading.classList.add('saifi-services-page-label');
        heading.textContent = location.pathname.startsWith('/ar')
          ? (Number(record.id) === 69 ? record.title : serviceName(item))
          : (Number(record.id) === 69 ? record.enTitle : (item.englishName || record.enTitle));
      }

      const arrow = card.querySelector('svg');
      if (arrow) {
        arrow.classList.add('saifi-services-page-arrow');
        (arrow.closest('button, [role="button"]') || arrow.parentElement)
          ?.classList.add('saifi-services-page-arrow-control');
      }

      const icon = card.querySelector('img');
      if (icon) {
        const expectedIcon = `/img/${item.icon}.svg`;
        // React may reuse the same <img> after hydration/error-state updates,
        // restoring its original mainIconUrl while leaving our data marker in
        // place. Compare the rendered source as well as the marker so the
        // corrected wallet icon wins after every client re-render.
        if (icon.dataset.saifiServiceIcon !== item.icon || icon.getAttribute('src') !== expectedIcon || icon.hasAttribute('srcset')) {
          icon.src = expectedIcon;
          icon.removeAttribute('srcset');
          icon.alt = heading?.textContent?.trim() || record.enTitle;
          icon.dataset.saifiServiceIcon = item.icon;
        }
      }
    }

    // Reorder the existing cards by stable service ID, retaining their DOM,
    // links, classes, animations, and the page's existing grid styling.
    const orderedCards = servicesPageOrder.map(id => cardsById.get(id));
    if (orderedCards.every(Boolean)) {
      const parent = orderedCards[0].parentElement;
      if (parent && orderedCards.every(card => card.parentElement === parent)) {
        const currentCards = [...parent.children].filter(child =>
          orderedCards.includes(child));
        if (currentCards.some((card, index) => card !== orderedCards[index])) {
          orderedCards.forEach(card => parent.appendChild(card));
        }
      }
    }
  }
  function refreshServiceCards() {
    // On the services route, only the service listing needs reconciliation.
    // The homepage carousel and linked service controls are not mounted here.
    if (isServicesPage) {
      refreshServicesPageCards();
      return;
    }
    const section = document.querySelector('[aria-label="Services section"]');
    const wrapper = section?.querySelector('.swiper-wrapper');
    if (wrapper) wrapper.querySelectorAll('.swiper-slide').forEach((slide, fallbackIndex) => {
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
        icon.src = `/img/${item.icon}.svg`;
        icon.removeAttribute('srcset');
        icon.alt = heading?.textContent?.trim() || 'SAIFI';
        icon.dataset.saifiServiceIcon = item.icon;
      }
      icon?.classList.add('saifi-service-icon');
    });
    refreshLinkedServiceCards();
    refreshServicesPageCards();
  }
  refreshServiceCards();
  let serviceRefreshQueued = false;
  const scheduleServiceRefresh = () => {
    if (serviceRefreshQueued) return;
    serviceRefreshQueued = true;
    const run = () => {
      serviceRefreshQueued = false;
      refreshServiceCards();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else run();
  };
  new MutationObserver(scheduleServiceRefresh).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'srcset']
  });

  // Open service tiles on their detail page even when the original control
  // was rendered as a non-navigating button/card.
  document.addEventListener('click', event => {
    const control = event.target.closest?.('a[href], button, [role="button"], .swiper-slide');
    if (!control) return;
    const item = serviceForElement(control);
    if (!item) return;
    const destination = `/${locale()}/services/${item.id}`;
    if (!snapshot.routes.includes(destination)) return;
    const link = control.closest('a[href]');
    if (link) {
      const current = new URL(link.href, location.origin);
      if (current.pathname === `${destination}/` && current.searchParams.get('source') === 'services') return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    // Match the Services page card behavior and use GitHub Pages' directory
    // URL so the static index.html is resolved rather than a path 404.
    sessionStorage.setItem('navigationSource', 'services');
    location.assign(`${destination}/?source=services`);
  }, true);
})();
