# Desktop interface 252

Replaces rose gradients and emoji navigation with a compact charcoal/red desktop surface. The controls view keeps the same media nodes and handlers; the existing recording mode card is moved beside the preview. Removes the unavailable logo srcset that could show a broken logo in a locally bundled panel. Duplicate header links are hidden on desktop.

Validation: 362 frontend tests; isolated Chrome production-markup checks for five real routed views at widths 1024, 1440 and 1920 without horizontal overflow or a collapsed device column; source-link check 23 pages / 95 destinations. The fixture is not a real camera or a screenshot of the installed application. Mobile regressions checked separately. Publishing this source does not replace an already installed EXE; the desktop release workflow must build a new package, followed by the normal authenticated update flow. No recording, credentials or local archive data are removed.

The refined screen uses a video caption with actual decoded resolution, a compact mode list, actions directly below the preview, shared visual tokens across operator views, red range accents and a help sidebar on wide screens. The full production markup exposed and now covers the inherited mode-card grid-area bug.
