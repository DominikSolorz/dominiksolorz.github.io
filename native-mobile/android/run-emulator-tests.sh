#!/usr/bin/env bash
set -u
mkdir -p emulator-evidence
adb shell getprop ro.build.version.release > emulator-evidence/android-version.txt
# Install the actual built APKs. Direct instrumentation retains screenshots until collected.
adb install -r -t native-mobile/android/app/build/outputs/apk/debug/app-debug.apk || exit 1
adb install -r -t native-mobile/android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk || exit 1
set +e
adb shell am instrument -w -r -e class pl.solorz.homesecurity.MobileEmulatorTest pl.solorz.homesecurity.preview.test/androidx.test.runner.AndroidJUnitRunner | tee emulator-evidence/instrumentation.txt
instrument_exit=${PIPESTATUS[0]}
mkdir -p emulator-evidence/emulator-proof
# API 30 scoped storage blocks shell reads; run-as uses this debuggable test app's own UID.
adb exec-out run-as pl.solorz.homesecurity.preview tar -C files/emulator-proof -cf - . > emulator-evidence/proof.tar
if tar -tf emulator-evidence/proof.tar >/dev/null 2>&1; then tar -xf emulator-evidence/proof.tar -C emulator-evidence/emulator-proof; fi
rm -f emulator-evidence/proof.tar
adb logcat -d -s System.out:I TestRunner:E chromium:E > emulator-evidence/media-diagnostics.txt
adb logcat -b crash -d > emulator-evidence/crashes.txt || true
adb shell uiautomator dump /sdcard/hs-final-ui.xml >/dev/null 2>&1
adb pull /sdcard/hs-final-ui.xml emulator-evidence/ >/dev/null 2>&1 || true
if [ "$instrument_exit" -ne 0 ]; then exit "$instrument_exit"; fi
grep -Eq '^OK \(5 tests\)' emulator-evidence/instrumentation.txt
