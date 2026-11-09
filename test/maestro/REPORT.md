# QA findings – NYC Icons Express booking demo

Tested on: Android emulator (Pixel 7, API 35, arm64), debug build, Maestro 2.12.1, Flutter stable.
Method: code read-through + manual exploration with Maestro + the automated flows in this folder.

Each bug is marked **[device]** (reproduced on the emulator) or **[code]**
(found in the source, not separately reproduced).

Severity: **High** = customer can't complete / pays wrong amount · **Medium** = wrong data or behaviour with a workaround · **Low** = cosmetic / UX.

## Summary

The assignment says the app "works correctly" and the flow ends on a *paid*
order. In practice **no order can be paid**: card payment is hard-wired to
fail, and the only way to the Success screen is a promo code that the UI
never reveals. It appears only in `adb logcat` hints. The automated flows
complete the order that way and document the rest.

## Bugs

### BUG-01 – Card payment always declined; the only way to finish an order is hidden (High) **[device]**
- **Steps:** any non-free order → Checkout → Pay → enter any valid-format card → Pay.
- **Actual:** "Processing…" → **Payment declined** every time, whatever the input. Logcat prints `[QA-HINT] Card payment is always declined in test mode` and tells you to use `MAESTROFREE`.
- The "Enter promo code / gift voucher" button on Checkout shows only an **"Error."** snackbar and disappears. The promo field then shows up on the *previous* step (Questions), with no hint in the UI.
- The declined page also shows an **order code** for a payment that failed, and an order later completed with the promo code gets a different code.
- **Expected:** a test card that succeeds (or a clearly flagged sandbox), and promo entry on Checkout or a clear pointer to it.
- **Automated:** `flows/card_payment_declined.yaml` pins the current behaviour.

### BUG-02 – Contact details are wiped by the promo round trip (Medium) **[device]**
- **Steps:** Checkout → fill in first/last name, country, state, tick both terms → "Enter promo code" → back to Questions → enter `MAESTROFREE` → Continue.
- **Actual:** the new Checkout screen is empty. The details are only saved when Pay/Confirm is pressed, although the code comment in `checkout_screen.dart` says to "prefill from already-confirmed state so that trip doesn't wipe out previously entered contact details".
- **Expected:** the details stay.
- **Workaround in the main flow:** apply the promo first, then fill in the contact form.

### BUG-03 – A "FREE" promo becomes a partial discount after the order changes (High) **[device]**
- **Steps:** 1 adult → … → apply `MAESTROFREE` (total 0.00 €) → go back to Tickets → add 1 adult → continue to Checkout.
- **Actual:** the "Promo (FREE)" chip is still shown, but the button reads **"Pay 33.00 €"**: 66.00 € minus the 33.00 € discount frozen when the code was applied. The discount is stored as a fixed amount (`AppliedDiscount.amount = preDiscountTotal` at apply time).
- **Expected:** a 100 % code keeps the order free, or the promo is re-validated and shown as invalid.
- **Automated:** `known_bugs/promo_stale_after_ticket_change.yaml` (fails).

### BUG-04 – Same-day timeslots: past times bookable, then everything closes at 15:00 (Medium) **[device]**
- **Steps:** at 14:56 local time, pick today → Madame Tussauds.
- **Actual:** 10:00–14:00 (already in the past) are offered and can be booked. At 15:00 *all* slots close, including 15:00 and 16:00, which are still in the future. A slot booked earlier (e.g. 10:00 today) stays confirmed after the cutoff.
- **Expected:** only future slots are offered, with a consistent cutoff rule.
- Not automated: it depends on the time of day. The main flow books next month to stay independent of it.

### Minor findings (Low)
- **Invalid promo code silently ignored** **[device]**: `NOTACODE` → Continue gives no error and no chip, so the customer can't tell the code was rejected.
- **Empty "Name on card"** **[code]**: Pay does nothing, with no error message (and no id for one).
- **Weak card validation** **[code]**: expiry accepts any 4 digits (`0000`, `1399`, past dates); no Luhn check on the card number.
- **Localization** **[device]**: the Czech (default) Home screen is in Slovak ("Vybrať tento zájazd"); country names stay Czech in English mode; title casing "Datum A Čas"; the Home description promises "three panoramic viewpoints, plus a sunset skyline cruise" while the package has 4 products and a daytime ferry.

### UX observations (requirements to clarify)

These are observations and proposed improvements, not confirmed requirement violations.

- **Calendar defaults to today [device].** Save without changing the date books today. Consider the first date with available mandatory-product slots; the desired default needs confirmation.
- **Success omits contact details and question answers [device].** Products, dates, times, prices and the order code are shown and asserted. Whether contact details and answers should also appear needs clarification.
- At 20 tickets the "+" buttons stay enabled and silently do nothing; there's no "max 20" message.
- The ferry button says "Select date and time" but confirms instantly with no dialog (it has no time).
- *Reset selection* also clears an applied promo code and re-hides the promo field (an unexpected side effect when coming back from Checkout).
- Debug hooks (`Debug_SetLive/ForceOpen/ForceClosed`) are real 12×12 px tap targets in the shipped UI, top-left of Date & Time.
- There are no weekday headers in the calendar.

## Testability findings (for whoever owns the ids)

| Issue | Impact | Workaround used |
|---|---|---|
| The id is on a `Semantics` wrapper that always reports `enabled=true` / `checked=false`. The real state is on the child node. | `assertVisible: {id: X, enabled: false}` is always wrong. | `text: …, enabled: …, childOf: {id: X}` |
| Right after *Reset selection*, the Android accessibility tree is briefly stale (some product ids missing, enabled flags old). | Flaky state assertions. | Check behaviour instead: tap → no dialog, no loading overlay. |
| **Missing ids:** Questions "select" error, per-ticket checkbox errors, Checkout terms errors, Questions dropdown options, timeslot **Close** button, calendar previous-month button and month label, order code, "Thank you" text, the "Error." snackbar, product names on Date & Time. | Can't assert those by id. | Visible text, or not asserted. |
| `Questions_ValidationError` is attached only to the text-area error. | Cannot target the select error by a dedicated id. | Independent validation can be checked by filling everything except the select and asserting navigation stays blocked; not yet automated. |
| Radio ids contain the **localized** label (`Questions_BookingRadio_Yes` vs `_Ano`). | Ids change with the language. | Tests run in English. |
| Past calendar days are exposed as `enabled=true`. | Can't assert that a past day is disabled. | Not asserted. |
| No test hook for a successful card payment. | A paid order can't be tested end to end. | Promo route. |

## Repository observations

- **No `ios/` folder.** `.metadata` lists iOS as a platform and the README talks about "Android/iOS", but the iOS project isn't in the repo. The app can only be run on Android (or web, which Maestro can't drive).
- **Flutter tooling edits app files.** With the tested Flutter version, `flutter pub get`/`build` rewrote `pubspec.lock` (4 dependency bumps) and `analysis_options.yaml`. These generated changes are excluded from the submission commit, which adds tests and documentation under `test/maestro/`, the `bin/test` wrapper, and a link from the root README. App code and build settings are unchanged.
- `android/gradle.properties` asks for an 8 GB Gradle heap (`-Xmx8G`), which can fail the build on smaller CI runners.
- The assignment says the app "works correctly" and ends on a *paid* order; see BUG-01.

## Stability

Final runs on 9 November 2026, Android emulator, random ticket quantities:

| Run | Result |
|---|---|
| `maestro test test/maestro` (emulator window) | 2/2 passed in 9m 13s |
| `./bin/test --headless maestro_pixel` | 2/2 passed in 7m 12s |
| `./bin/test --headless maestro_pixel` | 2/2 passed in 7m 6s; emulator shut down afterwards |

Earlier versions of the suite also passed 4 full runs in a row. One
real-world catch along the way: Flutter can merge the order code and the
"Order summary" heading into one accessibility label, so the order-code
check allows for that.

## Build compatibility observations

Observed with Flutter 3.47.9 and Java 17.
These are maintenance notices, not purchase-flow defects: `flutter build
apk --debug` completed successfully despite the warnings.

| Component | Version pinned in the starter project | Flutter's warning |
|---|---|---|
| Gradle | 8.14 (`android/gradle/wrapper/gradle-wrapper.properties`) | Support will soon be dropped; recommends at least 9.1.0. |
| Android Gradle Plugin | 8.11.1 (`android/settings.gradle.kts`) | Support will soon be dropped; recommends at least 9.0.1. |
| Kotlin Gradle Plugin | 2.2.20 (`android/settings.gradle.kts`) | Support will soon be dropped; recommends at least 2.3.20. |

The build versions were left unchanged to keep this submission focused on
Maestro tests. A future tooling upgrade should check compatibility across
Flutter, Gradle, AGP, Kotlin and Java together, then rebuild and rerun tests.

`flutter pub get` also reported newer dependency versions outside the
current constraints. This notice did not prevent dependency resolution or
the APK build.

## Not covered / next steps

What I'd automate next, in priority order:
- Ticket edge cases: removing the only adult brings the error back, a full 20-ticket order goes through.
- "All times closed" for Madame Tussauds, made deterministic with the `Debug_SetForceClosed` hook.
- Promo codes: invalid code, case-insensitivity (`cypressfree`), removing the promo restores the price.
- BUG-02 as its own failing flow.
- iOS: not possible yet, because the repo has no `ios/` project. Once it's added, the flows should need few changes since they select by id; the text-matched Back button is the first thing to check.
- Czech-language run of the main flow (ids are language-neutral except the radio buttons).
- Back-navigation matrix: changing the date for product 0 after later steps, changing Madame's time after Hop-on was picked (the app clears Hop-on – worth a flow).
- 52-week booking-window boundary (last bookable day, next-month button disabled).
- Double-tap protection on Continue/Confirm (`withSimulatedLatency` guard).
- Running on CI with an emulator (e.g. GitHub Actions + `reactivecircus/android-emulator-runner`) and `--format junit` reports.
