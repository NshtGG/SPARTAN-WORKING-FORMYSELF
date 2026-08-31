# Spartan — build notes

App id `com.nsht.spartan` · version 2.0 · minSdk 21 (Android 5+)

## What's in this zip

- Vite + React + TypeScript source in `src/`
- `tests/` — 76 tests total, run with `npx tsx tests/engine.test.ts` and `npx tsx tests/ui.test.tsx`
- `.github/workflows/android.yml` — CI that builds a Gradle APK
- `TESTS.md` — what was verified and what wasn't

## Rebuilding the web bundle

```bash
npm install
npm run build      # -> dist/index.html (single file, everything inlined)
```

## Rebuilding the APK

The shipped APK was assembled directly with aapt2 + smali + a Python signer,
because Google's servers were unreachable from the build environment. On a
normal machine, use Capacitor and Gradle instead:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
```

Or push to GitHub and let `.github/workflows/android.yml` do it.

## Signing for the Play Store

The shipped APK is self-signed for sideloading. For the Play Store generate your
own keystore, add a `signingConfig` to `android/app/build.gradle`, and run
`./gradlew bundleRelease`.

## After any code change

`npm run build` then re-sync/rebuild, otherwise the APK keeps the old bundle.
