#!/usr/bin/env bash
set -u
mkdir -p emulator-evidence
adb shell getprop ro.build.version.release > emulator-evidence/android-version.txt
set +e
( cd native-mobile/android && gradle --no-daemon :app:connectedDebugAndroidTest )
test_result=$?
adb pull /sdcard/Android/data/pl.solorz.homesecurity.preview/files/emulator-proof emulator-evidence/ || true
adb logcat -b crash -d > emulator-evidence/crashes.txt || true
exit "$test_result"
