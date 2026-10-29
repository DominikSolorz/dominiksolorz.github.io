# Update channels

- Published Windows builds are checked by the release workflow on source changes and at four scheduled times daily. This publishes downloads; it does not install them on user PCs.
- Installed Windows checks at startup and every six hours while running. A current full package is downloaded/applied only after the unlocked user clicks Update. Existing hash verification, recording flush acknowledgement and rollback remain mandatory.
- Web/PWA has its own safe refresh mechanism. A running transmitter or unfinished form must not be reloaded automatically.
- Automatic installation of small native/UI delta packages is NOT implemented. The current manifest offers full Windows ZIP packages. Do not advertise unattended minor Windows updates until a bounded, verified delta format, compatibility checks, rollback and recorder-safe application exist.
- Browser layout is detected locally. Account entry no longer requires selecting an OS/device. Authentication, profile consent, existing PIN gate and folder permission remain separate.
