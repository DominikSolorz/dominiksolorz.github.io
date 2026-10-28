# Public hosting review

This is an isolated review of the public homepage, not a production migration.

Live review: https://home-security-public-review.vercel.app/kamera/?ui=phone

Google PageSpeed validation, 28 October 2026, 09:01 CET:

- Mobile: https://pagespeed.web.dev/analysis/https-home-security-public-review-vercel-app-kamera/ft2zak0r1y?form_factor=mobile
- Desktop: https://pagespeed.web.dev/analysis/https-home-security-public-review-vercel-app-kamera/ft2zak0r1y?form_factor=desktop
- Both: performance 100, accessibility 100, best practices 100, SEO 100.
- Active cache and CSP/HSTS/COOP/framing warnings are absent. Remaining DOM/network/LCP and long-task entries are diagnostics, not a declaration of zero rendering work.

The public review uses content-hashed immutable images and scripts. It sends CSP, HSTS, COOP, X-Frame-Options, nosniff, referrer and permissions policies as real HTTP response headers. Static hashes and SRI authorize the exact script bytes. The HTTPS/unsafe-inline compatibility fallback is ignored by modern browsers that enforce strict-dynamic and hashes; the review contains no personal input forms or account runtime.

The original GitHub Pages site, accounts, OAuth callbacks, contact form, AI endpoint, PWA, installer and camera permissions remain unchanged. Account, contact, download, article and AI links go to the existing original origin. The review is a frozen homepage snapshot; it deliberately does not auto-reload or pretend to migrate backend sessions. Its canonical remains the original homepage until a production-address decision.

Rebuild from a checkout with the existing sharp/esbuild deployment dependencies installed:

```sh
node scripts/optimize-marketing-images.mjs /tmp/home-security-review-images
node hosting/public-preview/build.mjs /tmp/home-security-public-review /tmp/home-security-review-images
node hosting/public-preview/verify.mjs /tmp/home-security-public-review
```

Upload only the generated directory, excluding the local review-manifest.json, to the isolated Vercel review project. Do not upload repository credentials, private application state, installer binaries or the full repository. Do not replace the existing ds-stream-support deployment.

Before production adoption, decide the public URL, establish automatic publication and current installer metadata, update public canonical/sitemap links, and recheck account/contact/AI entry links. The old .github.io hostname cannot receive custom response headers from a Vercel deployment.
