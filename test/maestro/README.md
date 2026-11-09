# Maestro E2E tests – NYC Icons Express purchase flow

Black-box Maestro tests for the booking demo app. No app code was changed.
Bugs, testability gaps and what I'd automate next are in [REPORT.md](REPORT.md).

## Run

Prerequisites: an Android emulator or device, and the
[Maestro CLI](https://docs.maestro.dev/getting-started/installing-maestro) on `PATH`.

```bash
flutter build apk --debug
adb install -r build/app/outputs/flutter-apk/app-debug.apk
maestro test test/maestro
```

From the repository root, the same suite is available through a wrapper:

```bash
./bin/test --ui
./bin/test --headless AVD_NAME
```

`--ui` uses your running device, with the app already installed.
`--headless` starts the named Android virtual device without a window,
waits for it to boot, installs the existing debug APK, runs Maestro against
that device, and stops the emulator on exit. Build the APK first and close
any running instance of the same AVD before using headless mode.

Find AVD names with `emulator -list-avds`. If there is only one AVD,
`./bin/test --headless` selects it automatically; otherwise pass its name
or set `MAESTRO_AVD`. Java, Maestro, `adb`, and `emulator` must be available
in your terminal environment. The wrapper reserves emulator port 5580.
The headless wrapper also passed a real emulator run on 9 November 2026:
2/2 flows passed in 7m 12s (see REPORT.md).

Ticket quantities are random. To repeat a specific run:

```bash
maestro test -e ADULTS=19 -e CHILDREN=0 -e MADAME_HOUR=14 test/maestro/flows/purchase_nyc_icons_express.yaml
```

The known-bug flow is excluded from the suite and is expected to **fail**:

```bash
maestro test test/maestro/known_bugs
```

## What's covered

| Flow | Covers |
|---|---|
| `flows/purchase_nyc_icons_express.yaml` | **Main scenario.** Clean launch → package → a child without an adult is rejected → 20-ticket cap → random adult/child quantities → only product 1 unlocked → **Reset selection** clears the selections and re-locks the products → all 4 products confirmed (Hop-on ≥ 2 h after Madame Tussauds) → Questions: empty submit blocked, only the required fields filled → Checkout: computed total, empty contact form rejected, promo applied → Success: tickets, every product's date/time, price breakdown, 0.00 € total. |
| `flows/card_payment_declined.yaml` | Bonus. Card form validation, number formatting, processing → **always declined** (BUG-01), "Try again" keeps the data. |
| `known_bugs/promo_stale_after_ticket_change.yaml` | BUG-03: a FREE promo turns into "Pay 33.00 €" after adding a ticket. |

The main flow also checks that Continue stays disabled while the mandatory
ferry date is missing, becomes enabled once it is confirmed, and that Reset
selection clears all four products, including optional Hop-on. On Success,
the order code must match the app's eight-character format.

## Layout

- `flows/` – what runs in the suite. The main flow reads like the
  assignment's steps; the detail lives in subflows.
- `subflows/` – `verify_*` files hold the checks (ticket rules, Reset
  selection, Success summary); the rest are reusable steps (`continue_to`,
  `go_back`, `set_ticket_quantities`, …).
- `scripts/test_data.js` – random test data and every expected value. Invalid
  `-e` values (e.g. `ADULTS=0` or more than 20 tickets) fail immediately with
  a clear message.
- `known_bugs/` – expected to fail; not part of the suite.

## Decisions and tradeoffs

- **Ids first.** Selectors use the app's `Semantics(identifier)` ids. Visible
  text is used only where no id exists (listed in the report).
- **No sleeps.** The app adds a random 3–8 s fake latency to every
  Continue/Confirm. `subflows/continue_to.yaml` waits for the next page's id
  instead (15 s timeout).
- **Going back.** `subflows/go_back.yaml` taps Back while the current page is
  still shown (max 3 tries), then requires the previous page. A single tap
  proved flaky right after a page transition.
- **Expressions.** JS expressions with string literals are written as
  `'${"text" + output.td.x}'`: YAML single quotes outside, JS double quotes
  inside, so a `: ` in the text can't break the YAML.
- **English UI.** The app starts in Czech; the tests switch to English for
  readable text assertions.
- **One source of expected values.** `scripts/test_data.js` picks the
  quantities and slots and computes every expected price (adult 30 €,
  child 15 €, +10 % fee) and date. Text selectors use escaped versions
  of literal prices and dates so decimal points cannot act as wildcards.
- **Success scrolling.** Each positive summary assertion scrolls to its
  target first, instead of assuming several rows fit on the screen.
- **Not time-of-day dependent.** The visit is booked for the 15th of next
  month, because same-day slots close at 15:00.
- **Disabled state via `childOf`.** The id wrapper always reports
  `enabled=true`, so state is asserted on its child. Right after *Reset
  selection* the tree is briefly stale, so the lock is checked by behaviour:
  tapping a locked product opens nothing.
- **Completion via a fully discounted order.** Successful card payment is
  unavailable in this build, so
  the main flow finishes with the `MAESTROFREE` promo code, applied *before*
  the contact form because the promo round trip wipes it (BUG-02).

## Known limitations

- Android only: the repo has no `ios/` project.
- The main flow takes about 6–8 min, mostly the app's fake latency and
  the 20-ticket cap check (about 40 taps).
- Flutter tooling rewrites `pubspec.lock` and `analysis_options.yaml` on
  build; those changes are not part of this submission.
- A run started seconds before midnight at a month's end could compute a
  different month than the device.
