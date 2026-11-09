#!/usr/bin/env python3
"""Fail closed if a Play AAB contains the direct APK installation channel."""
import sys
import zipfile


def verify(path):
    with zipfile.ZipFile(path) as bundle:
        names = bundle.namelist()
        if 'BundleConfig.pb' not in names or 'base/manifest/AndroidManifest.xml' not in names:
            raise ValueError('Not an Android App Bundle with a base manifest')
        dex_names = [name for name in names if '/dex/' in name and name.endswith('.dex')]
        if not dex_names:
            raise ValueError('Bundle contains no compiled application code')
        forbidden = (
            b'android.permission.REQUEST_INSTALL_PACKAGES',
            b'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
            b'pl/solorz/homesecurity/AppUpdater;',
            b'pl/solorz/homesecurity/UpdatePolicy;',
            b'https://dominiksolorz.github.io/kamera/android-update.json',
        )
        for name in names:
            if name.endswith('/emulator-panel.html') or name.endswith('/update_paths.xml'):
                raise ValueError('Unexpected direct/debug resource: ' + name)
            if name.endswith('/manifest/AndroidManifest.xml') or name in dex_names:
                data = bundle.read(name)
                for marker in forbidden:
                    if marker in data:
                        raise ValueError('Forbidden updater marker in ' + name + ': ' + marker.decode())
        print('PASS: Play AAB contains compiled code and no direct APK update channel')


if __name__ == '__main__':
    verify(sys.argv[1])
