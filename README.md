# Maestro Booking Demo

A Flutter demo app for a booking/checkout flow (tickets → date/time → questions → payment → success).

## Prerequisites

- [Flutter SDK](https://docs.flutter.dev/get-started/install) (channel: stable). Verify with:
  ```
  flutter doctor
  ```

### Android (emulator or physical device) — required for Maestro tests

Maestro drives the app through its native Android/iOS accessibility tree, so an
Android emulator or physical device is the supported way to run this project.

Needs the Android SDK installed (via whichever IDE/tooling you prefer — Android Studio, VS Code with the Flutter extension, or the command-line tools), plus either a running emulator (`flutter emulators --launch <id>`) or a physical device connected with USB debugging enabled.

```bash
flutter pub get
flutter devices        # confirm your emulator/device shows up
flutter run             # picks the first available device
```

`flutter doctor` will tell you exactly what's missing — follow its instructions if something is red/yellow.

### Web / Chrome — quick manual preview only

```bash
flutter pub get
flutter run -d chrome
```

Useful for eyeballing the UI quickly, but **not** a target for the Maestro
flow — Maestro cannot drive a web build, only a native Android/iOS one.

## Project structure

```
lib/
  main.dart              # app entry point, theming
  models/                # app/booking state
  screens/                # each step of the booking flow
  widgets/                # shared UI pieces
  utils/, ids/, l10n/     # helpers, id generation, strings
```

## Tests

Maestro purchase-flow tests, run commands, and QA findings are documented in
[test/maestro/README.md](test/maestro/README.md). Both the visible and headless
Android emulator suites passed; results are recorded in
[test/maestro/REPORT.md](test/maestro/REPORT.md).

With the app installed on a running Android device:

```bash
./bin/test --ui
```

For a headless emulator (build the debug APK first):

```bash
./bin/test --headless AVD_NAME
```

Flutter tests:

```bash
flutter test
```
