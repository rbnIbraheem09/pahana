# Pahana: build plan

> **Pahana** (පහන, "lamp" in Sinhala). Florence Nightingale, "the Lady with the Lamp", walked the wards at night checking who needed care most. Pahana does the same job for rural chronic-disease patients.

## 1. What we are building

Two surfaces that ship as **one downloadable app** (macOS + Windows):

| Surface | Who | Where it runs | Job |
|---|---|---|---|
| **Pahana Field** | Estate medical assistants, PHMs, clinic staff | Desktop app (Electron), works fully offline | Record readings, show a live priority flag, store on device, sync when signal returns, print QR clinic cards |
| **Pahana Clinic** | Doctors / medical officers | Web portal, hosted by the Field app with one switch (prototype) | Red → amber → green review queue, trend graphs, one-click decisions, patient SMS, audit log |

For the prototype, the Field app contains the clinic server. Flip **Clinic portal → On** and it serves the portal on `http://localhost:4280`. An optional LAN mode lets the portal open on a phone or tablet via QR code. Sync is real HTTP with signed payloads, not a shortcut, so the architecture is the same one that would run on a real server.

```
┌────────────────── Pahana.app ───────────────────────────────────────────┐
│  Renderer: Field UI (React)          Main process (Node)                 │
│  ─ entry form, live triage   ◄─IPC─► ─ field store (JSON, on device)     │
│  ─ patients, cards, sync             ─ sync client  ──HTTP + HMAC──┐     │
│                                      ─ clinic server (http, SSE) ◄─┘     │
│                                         └─ clinic store (JSON)           │
└──────────────────────────────────────────────┬──────────────────────────┘
                                               │ http://localhost:4280 (or LAN)
                                   Browser: Clinic portal (React)
```

## 2. The five-step flow (from the brief), mapped to features

1. **Record**: Field entry form. BP auto-advances sys→dia, glucose fasting/random, symptom chips, missed-dose selector. The triage flag updates live as you type.
2. **Sync**: Online/Offline switch in the title bar. Offline records queue in an outbox. Going online auto-syncs, payloads are HMAC-signed with the device key, and doctor decisions flow back down.
3. **Flag**: Deterministic rule engine (`src/shared/triage.ts`), shared by both surfaces. It is not AI and never diagnoses. Every flag lists the exact rules that fired.
4. **Decide**: Clinic queue sorted by band, then priority score. Keyboard-first (↑↓, 1–4, ⌘↵). Green patients can be cleared in bulk ("skip the trip").
5. **Inform**: Decision → SMS in the patient's language (සිංහල / தமிழ் / EN) with no diagnosis and no numbers, previewed on a phone mockup (smartphone or basic phone).

Supporting features: QR clinic card (random ID only), access logging on every record open, consent capture at registration, rules transparency page.

## 3. Triage rules v0.3 (prototype, must be clinically validated)

| Area | RED (review first) | AMBER | GREEN |
|---|---|---|---|
| Blood pressure | ≥180 systolic or ≥110 diastolic; <90 systolic with dizziness/fainting | 160–179 / 100–109 (grade 2); 140–159 / 90–99 (above target); <90 systolic | <140/90 |
| Glucose (mg/dL) | ≥300; <54; <70 with hypo symptoms; ≥250 with hyperglycaemia symptoms | Fasting >130, random ≥180; 54–69 | Fasting 70–130, random <180 |
| Symptoms | Chest pain, breathlessness, one-sided weakness, confusion, fainting; any warning symptom with grade-2 BP or glucose ≥250/<70 | Dizziness, severe headache, blurred vision, vomiting, sweating/shaking, foot wound, ankle swelling | none |
| Medication | none | Missed ≥3 of 7 days; any missed dose with readings above target | none |
| Trend | none | Systolic up ≥20 mmHg or glucose up ≥50 mg/dL vs previous visits | none |

Thresholds follow WHO HEARTS / ISH 2020 BP grades and ADA glucose targets. **Before any real use they must be checked against Sri Lanka Ministry of Health NCD guidelines by a clinician.** The UI says so.

## 4. Demo data (deterministic, regenerated on "Reset demo")

- Clinic holds 478 patients across Hatton/Dickoya/Maskeliya estates, each with 3–8 months of history.
- The Field device (EMA S. Mahendran, Dickoya division) has today's round: **48 unsynced readings**.
- Before sync the queue shows RED 5 · AMBER 27 · GREEN 386. After sync it shows **RED 8 · AMBER 31 · GREEN 427**, matching Yashod's mockup.
- **Patient #0842** is the mockup patient: BP 168/102, glucose 140, dizziness, missed 2 days, upward trend, previous decision "routine". Flag: RED.

## 5. Tech stack and why

- **Electron 44 + electron-vite + React 19 + TypeScript**: one codebase gives a native macOS/Windows app *and* a web portal. The portal server is just Node's `http` inside the app. Swift was ruled out because it can't ship to Windows.
- **Tailwind v4 + hand-written CSS tokens (OKLCH)**, **Motion** for layout/spring animation, **lucide** icons.
- Fonts are bundled for offline use: **Atkinson Hyperlegible Next** (UI, designed by the Braille Institute for legibility, so a misread 168 vs 188 is less likely), **Bricolage Grotesque** (display), **Atkinson Hyperlegible Mono** (IDs), **Noto Sans Sinhala / Tamil**.
- Storage is in-memory with debounced atomic JSON writes: instant reads, no native modules, so cross-platform builds stay trivial.

## 6. Native window chrome (the part that usually goes wrong)

Verified on this Mac (macOS 26, Electron 44) with a live test: drag, corner resize, and double-click → *Fill* all work natively.

- `titleBarStyle: 'hidden'` on both OSes, so there is no title-bar ribbon.
  - macOS: native traffic lights repositioned with `trafficLightPosition` to sit centred in our 52px header. The inset collapses in full screen.
  - Windows: `titleBarOverlay` keeps the native min/max/close, Snap Layouts, and a native resize border. The overlay colour follows the theme.
- Drag regions (`app-region: drag`) cover the header and the sidebar top, and every control inside is `no-drag`. Double-click is **not** re-implemented in JS: Electron now honours the macOS "double-click title bar" setting natively, so a JS handler would fire twice.
- Menus are invisible but present, like Arc. Windows: menu removed entirely (it doesn't appear even on Alt); shortcuts are handled in-app. macOS: the menu exists only in the system menu bar at the top of the screen (Edit roles keep ⌘C/⌘V working).
- Custom thin scrollbars via `::-webkit-scrollbar`, deliberately **without** `scrollbar-color`/`scrollbar-width`, which override them in Chromium 121+.
- No white flash (`show:false` + `ready-to-show`), a remembered window size and position, a single-instance lock, a native context menu for text fields, and no page zoom.
- Signing: ad-hoc (`identity: "-"`). Unsigned arm64 apps show "damaged"; ad-hoc signed ones show the normal "unidentified developer" prompt (System Settings → Privacy & Security → Open Anyway).

## 7. Release

GitHub repo `rbnIbraheem09/pahana`. Pushing a `v*` tag runs GitHub Actions on macOS and Windows, builds a universal `.dmg` and a Windows `.exe` installer, and publishes a Release with install notes.

## 8. Build order

1. Shared core: types, triage engine + tests, seed generator, SMS templates, i18n
2. Main process: stores, clinic server, sync, window chrome, IPC
3. Field UI: shell, entry form, patients, sync, cards, portal host, settings
4. Clinic portal: pairing, queue workspace, review, decision + SMS, bulk green, scan, activity, rules
5. Motion and polish passes, both themes, responsive portal
6. Icon, DMG art, packaging, CI release
7. (Later) pitch deck
