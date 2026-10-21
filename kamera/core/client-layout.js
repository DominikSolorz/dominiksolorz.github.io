/* Layout only. Never grants owner access or starts a media device. */
(() => {
  function resolveClientLayout({ native = false, transmitter = false, ui = '', view = '', legacyMobile = false, saved = '', mobile = false, compact = false } = {}) {
    // A transmitter must never mount an operator shell. The installed Windows
    // client remains desktop even when its window is narrow or a phone URL is used.
    if (transmitter) return 'transmitter';
    if (native) return 'desktop';
    if (ui === 'phone') return 'mobile';
    if (ui === 'computer') return 'desktop';
    if (view === 'desktop') return 'desktop';
    if (view === 'mobile' || legacyMobile) return 'mobile';
    if (saved === 'phone') return 'mobile';
    if (saved === 'computer') return 'desktop';
    return mobile || compact ? 'mobile' : 'desktop';
  }
  globalThis.HomeSecurityLayout = Object.freeze({ resolve: resolveClientLayout });
})();
