/* Adapter for the recovered Next.js client. Public content is served locally. */
(() => {
  'use strict';
  const snapshot = window.__SAIFI_SNAPSHOT__;
  const originalFetch = window.fetch.bind(window);
  const locale = () => location.pathname.split('/')[1] === 'en' ? 'en' : 'ar';
  const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status, headers: {'Content-Type': 'application/json; charset=utf-8'}
  });
  const normalize = text => String(text || '').toLocaleLowerCase().normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670]/g, '').replace(/[أإآ]/g, 'ا').trim();
  const matches = (record, query) => Object.values(record).some(value =>
    typeof value === 'string' && normalize(value).includes(normalize(query)));

  const search = query => ({
    services: {
      mainServices: snapshot.mainServices.filter(item => matches(item, query)),
      subServices: snapshot.subServices.filter(item => matches(item, query))
    },
    faQs: snapshot.faqs.filter(item => matches(item, query))
  });

  window.fetch = async (input, options = {}) => {
    const requestUrl = new URL(typeof input === 'string' ? input : input.url, location.origin);
    const isLocalContent = requestUrl.origin === location.origin && requestUrl.pathname.startsWith('/api/content/');
    const isProxy = requestUrl.origin === location.origin && requestUrl.pathname === '/api/proxy';
    if (isLocalContent || isProxy) {
      let body = options.body;
      if (!body && typeof input !== 'string' && input.clone) body = await input.clone().text();
      let args;
      try { args = JSON.parse(body || '{}'); } catch { args = {}; }
      const endpoint = (isProxy ? requestUrl.searchParams.get('endpoint') : requestUrl.pathname.replace(/^\/api\/content\//, ''))?.replace(/^\//, '');
      if (endpoint === 'Pages/Search') return json(search(args.Query));
      if (endpoint === 'Pages/GetSubServiceParentId') {
        const parentID = snapshot.parents[args.ID];
        return parentID ? json({parentID, mainServiceId: parentID}) : json({error: 'Not found'}, 404);
      }
      if (endpoint === 'Pages/LoadMoreFAQs') {
        return json(snapshot.faqs.filter(item => (item.order || 0) > Number(args.lastorder || 0)));
      }
      const key = endpoint + '|' + (args.ID ?? 'all');
      if (Object.prototype.hasOwnProperty.call(snapshot.responses, key)) return json(snapshot.responses[key]);
      return json({error: 'This operation is not configured.'}, 503);
    }
    if (requestUrl.origin === location.origin && ['/api/visitor', '/api/visitor-problem'].includes(requestUrl.pathname)) {
      return json({error: 'Submission service is not configured.'}, 503);
    }
    return originalFetch(input, options);
  };

  // All exported routes load directly, including refreshes. Keep locale on links
  // whose original homepage handler omitted it.
  const routeUrl = input => {
    const url = new URL(input, location.origin);
    if (url.origin !== location.origin) return url;
    if (/^\/services\//.test(url.pathname)) url.pathname = '/' + locale() + url.pathname;
    return url;
  };
  document.addEventListener('click', event => {
    const button = event.target.closest?.('button');
    const label = button?.getAttribute?.('aria-label');
    if (label === 'Switch to English' || label === 'التبديل إلى العربية') {
      const destination = location.pathname.replace(/^\/(ar|en)(?=\/|$)/, locale() === 'ar' ? '/en' : '/ar');
      if (snapshot.routes.includes(destination.replace(/\/$/, ''))) {
        event.preventDefault(); event.stopImmediatePropagation();
        location.assign(destination + location.search + location.hash);
        return;
      }
    }
    const anchor = event.target.closest?.('a[href]');
    if (!anchor || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button > 0) return;
    const url = routeUrl(anchor.href);
    if (url.hash === '#saifi-link-pending') {
      event.preventDefault(); event.stopImmediatePropagation(); showLinkUnavailable(); return;
    }
    if (url.origin !== location.origin || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    if ((anchor.textContent || '').match(/Privacy Policy|سياسة الخصوصية/)) {
      event.preventDefault(); event.stopImmediatePropagation(); showPrivacy(); return;
    }
    if (url.pathname === location.pathname && url.hash) return;
    if (snapshot.routes.includes(url.pathname.replace(/\/$/, ''))) {
      event.preventDefault(); event.stopImmediatePropagation();
      location.assign(url.pathname + url.search + url.hash);
    }
  }, true);

  const nativeOpen = window.open?.bind(window);
  window.open = (url, target, features) => {
    if (String(url).endsWith('#saifi-link-pending')) { showLinkUnavailable(); return null; }
    return nativeOpen?.(url, target, features) ?? null;
  };

  function showLinkUnavailable() {
    const isArabic = locale() === 'ar';
    const dialog = document.createElement('dialog');
    dialog.className = 'saifi-policy-dialog';
    const heading = document.createElement('h2');
    heading.textContent = isArabic ? 'رابط صيفي قيد التحديث' : 'SAIFI link update';
    const message = document.createElement('p');
    message.textContent = isArabic ? 'سيُضاف الرابط الرسمي الجديد بعد اعتماده. يمكنك التواصل معنا عبر صفحة الدعم.' : 'The new official link will be added once confirmed. Please contact our support team.';
    const contact = document.createElement('a');
    contact.href = '/' + locale() + '/support';
    contact.textContent = isArabic ? 'الدعم والمساعدة' : 'Contact Support';
    const close = document.createElement('button');
    close.type = 'button'; close.textContent = isArabic ? 'إغلاق' : 'Close';
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    dialog.append(heading, message, contact, close); document.body.append(dialog); dialog.showModal();
  }

  // Next's client navigation fetches RSC; this export uses complete documents.
  // Intercept actual transitions while keeping background prefetches harmless.
  const fetchWithContent = window.fetch;
  window.fetch = async (input, options = {}) => {
    const url = routeUrl(typeof input === 'string' ? input : input.url);
    const headers = new Headers(options.headers || (typeof input === 'string' ? undefined : input.headers));
    if (url.origin === location.origin && headers.get('RSC') === '1') {
      const path = url.pathname.replace(/\/$/, '');
      if (headers.get('Next-Router-Prefetch') === '1') return new Response('', {status: 204});
      if (snapshot.routes.includes(path) && path !== location.pathname.replace(/\/$/, '')) {
        location.assign(path + url.search.replace(/([?&])_rsc=[^&]*&?/, '$1').replace(/[?&]$/, '') + url.hash);
        return new Promise(() => {});
      }
    }
    return fetchWithContent(input, options);
  };

  function showPrivacy() {
    const isArabic = locale() === 'ar';
    const dialog = document.createElement('dialog');
    dialog.className = 'saifi-policy-dialog';
    const title = document.createElement('h2');
    title.textContent = isArabic ? 'سياسة الخصوصية' : 'Privacy Policy';
    const paragraph = document.createElement('p');
    paragraph.textContent = isArabic ? 'يرجى التواصل مع صيفي للحصول على سياسة الخصوصية.' : 'Please contact SAIFI to request the privacy policy.';
    const contact = document.createElement('a');
    contact.href = '/' + locale() + '/support';
    contact.textContent = isArabic ? 'الدعم والمساعدة' : 'Contact Support';
    const close = document.createElement('button');
    close.type = 'button'; close.textContent = isArabic ? 'إغلاق' : 'Close';
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    dialog.append(title, paragraph, contact, close); document.body.append(dialog); dialog.showModal();
  }
})();
