/* Layout only. Never grants owner access or starts a media device. */
(() => {
  function detectPlatform({userAgent='',maxTouchPoints=0}={}) {
    if(/Android/i.test(userAgent))return 'android';
    if(/iPhone|iPad|iPod/i.test(userAgent)||(/Macintosh/i.test(userAgent)&&maxTouchPoints>1))return 'ios';
    return 'unknown';
  }
  function resolveClientLayout({ native = false, transmitter = false, preference = 'auto', ui = '', view = '', legacyMobile = false, saved = '', mobile = false, compact = false } = {}) {
    // A transmitter must never mount an operator shell. The installed Windows
    // client remains desktop even when its window is narrow or a phone URL is used.
    if (transmitter) return 'transmitter';
    if (native) return 'desktop';
    // Old device choices and shared ?ui= links are not a persistent browser override.
    // Only an explicit current manual preference may override this device's screen.
    if (preference !== 'manual') return mobile || compact ? 'mobile' : 'desktop';
    if (ui === 'phone') return 'mobile';
    if (ui === 'computer') return 'desktop';
    if (view === 'desktop') return 'desktop';
    if (view === 'mobile' || legacyMobile) return 'mobile';
    if (saved === 'phone') return 'mobile';
    if (saved === 'computer') return 'desktop';
    return mobile || compact ? 'mobile' : 'desktop';
  }
  globalThis.HomeSecurityLayout = Object.freeze({ resolve: resolveClientLayout, detectPlatform });
})();
