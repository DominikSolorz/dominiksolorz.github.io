# Update channels

- Published Windows builds are checked by the release workflow on source changes and at four scheduled times daily. This publishes downloads; it does not install them on user PCs.
- Installed Windows checks at startup and every six hours while running. After the account panel is unlocked, a current full package downloads automatically in the background and is verified with SHA-256. A pending request is committed atomically. The running program, camera and recorder are never stopped by this download. Installation and rollback occur only on the next normal program launch, before capture starts; the package is verified again before replacement. The button retries a failed download.
- Web/PWA has its own safe refresh mechanism. A running transmitter or unfinished form must not be reloaded automatically.
- Live replacement of a running native/UI bundle and automatic installation of small delta packages are NOT implemented. The current manifest offers full Windows ZIP packages. Do not advertise unattended minor Windows updates until a bounded, verified delta format, compatibility checks, rollback and recorder-safe application exist.
- Browser layout is detected locally. Account entry no longer requires selecting an OS/device. Authentication, profile consent, existing PIN gate and folder permission remain separate.
