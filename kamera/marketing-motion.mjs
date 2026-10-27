// HOME SECURITY: progressive enhancement for public marketing pages only.
// No camera, account, recording or support state is read or changed here.
const site = document.querySelector('#publicHome.mktSite') || document.querySelector('body.marketingPage');
if (site) {
  const header = site.querySelector('.mktHeader');
  const navigation = header?.querySelector('nav[aria-label="Nawigacja strony"]');
  const internalLinks = [...(navigation?.querySelectorAll('a[href^="#"]') || [])];
  const navSections = internalLinks.map(link => {
    const id = link.getAttribute('href')?.slice(1) || '';
    return { link, section: document.getElementById(id) };
  }).filter(item => item.section && site.contains(item.section));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const backToTop = document.createElement('button');
  backToTop.type = 'button';
  backToTop.className = 'mktBackToTop';
  backToTop.setAttribute('aria-label', 'Wróć na początek strony');
  backToTop.hidden = true;
  const arrow = document.createElement('span');
  arrow.textContent = '↑';
  arrow.setAttribute('aria-hidden', 'true');
  backToTop.append(arrow, document.createTextNode('Na górę'));
  site.append(backToTop);

  const isPublicVisible = () => site === document.body || site.getClientRects().length > 0;
  const doc = document.documentElement;
  let frameScheduled = false;
  const refresh = () => {
    frameScheduled = false;
    if (!isPublicVisible()) {
      backToTop.hidden = true;
      return;
    }
    const y = Math.max(0, window.scrollY || 0);
    const scrollable = Math.max(1, doc.scrollHeight - window.innerHeight);
    const ratio = Math.min(1, y / scrollable);
    header?.style.setProperty('--mkt-scroll-progress', String(ratio));
    header?.classList.toggle('mktIsScrolled', y > 12);
    backToTop.hidden = y < 600;
    const threshold = (header?.getBoundingClientRect().height || 80) + 55;
    let active = null;
    for (const item of navSections) {
      if (item.section.getBoundingClientRect().top <= threshold) active = item.link;
    }
    for (const item of navSections) {
      if (item.link === active) item.link.setAttribute('aria-current', 'location');
      else item.link.removeAttribute('aria-current');
    }
  };
  const scheduleRefresh = () => {
    if (frameScheduled) return;
    frameScheduled = true;
    window.requestAnimationFrame(refresh);
  };
  window.addEventListener('scroll', scheduleRefresh, { passive: true });
  window.addEventListener('resize', scheduleRefresh, { passive: true });
  window.addEventListener('pageshow', scheduleRefresh);
  backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    const firstLink = header?.querySelector('.mktBrand');
    firstLink?.focus({ preventScroll: true });
  });

  // Focus remains visible even when keyboard users arrive before the observer fires.
  const revealTargets = [...site.querySelectorAll(
    '.mktSectionHead,.mktStageHeading,.mktFeature,.mktVisualFigure,.mktVisualCopy,' +
    '.mktScenarioCard,.mktPrivacyCopy,.mktPrivacyPanel,.mktRoadmap article,' +
    '.mktDecisionLead,.mktDecisionOptions article,.mktPost,.mktAiLayout > div,' +
    '.mktFaq details,.mktContactBand .mktContainer,.mktPageMain > .mktPageTitle,' +
    '.mktPageMain > .mktPageLead,.mktPageMain > .mktArticleLayout'
  )];
  let revealObserver = null;
  const reveal = element => {
    element.classList.add('mktIsVisible');
    revealObserver?.unobserve(element);
  };
  const configureReveals = () => {
    revealObserver?.disconnect();
    revealObserver = null;
    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
      for (const element of revealTargets) {
        element.classList.remove('mktWillReveal', 'mktIsVisible');
        element.style.removeProperty('--mkt-delay');
      }
      return;
    }
    revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) reveal(entry.target);
    }, { threshold: 0.07, rootMargin: '0px 0px -5% 0px' });
    let pendingIndex = 0;
    for (const element of revealTargets) {
      // Never hide something already in the reading viewport.
      const bounds = element.getBoundingClientRect();
      if (bounds.top < window.innerHeight * .93) {
        element.classList.remove('mktWillReveal', 'mktIsVisible');
        continue;
      }
      element.style.setProperty('--mkt-delay', String((pendingIndex % 3) * 65) + 'ms');
      element.classList.remove('mktIsVisible');
      element.classList.add('mktWillReveal');
      revealObserver.observe(element);
      pendingIndex++;
    }
  };
  configureReveals();
  const revealOnFocus = event => {
    const target = event.target?.closest?.('.mktWillReveal');
    if (target) reveal(target);
  };
  site.addEventListener('focusin', revealOnFocus);
  if (typeof reducedMotion.addEventListener === 'function') {
    reducedMotion.addEventListener('change', configureReveals);
  } else if (typeof reducedMotion.addListener === 'function') {
    reducedMotion.addListener(configureReveals);
  }
  if (site !== document.body && 'MutationObserver' in window) {
    new MutationObserver(scheduleRefresh).observe(site, {
      attributes: true,
      attributeFilter: ['hidden']
    });
  }
  scheduleRefresh();
}
