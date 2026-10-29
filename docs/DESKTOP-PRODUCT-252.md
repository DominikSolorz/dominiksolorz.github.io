# Desktop interface 252

Replaces rose gradients and emoji navigation with a compact charcoal/red desktop surface. The controls view keeps the same media nodes and handlers; the existing recording mode card is moved beside the preview. Removes the unavailable logo srcset that could show a broken logo in a locally bundled panel. Duplicate header links are hidden on desktop.

Validation: 362 frontend tests; isolated Chrome layout fixture at widths 1024, 1280, 1600 and 1920 without horizontal overflow or overlapping preview/device dock; source-link check 23 pages / 95 destinations. The fixture is not a real camera or a screenshot of the installed application. Mobile regressions checked separately. Publishing this source does not replace an already installed EXE; the desktop release workflow must build a new package, followed by the normal authenticated update flow. No recording, credentials or local archive data are removed.
