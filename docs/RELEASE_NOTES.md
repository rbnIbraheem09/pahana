**Pahana** is offline triage for chronic disease in rural Sri Lanka. Health workers record readings with no signal, Pahana flags who is getting worse, and the doctor sees who to review first.

**New in 1.0.1:** clearer triage explanations (no repeated reasons), and the Rules page now cites Sri Lanka's national hypertension guideline (MoH 2021) and ADA targets, marking which cut-offs are prototype choices.

### Downloads

| | File |
|---|---|
| **macOS** (Apple Silicon and Intel) | `Pahana-…-mac.dmg` |
| **Windows 10 / 11** | `Pahana-…-windows-setup.exe` |

### First launch

**macOS:** drag Pahana into Applications and open it. macOS will say it can't verify the developer (the app isn't notarised). Go to **System Settings → Privacy & Security → Open Anyway**. Or run `xattr -cr /Applications/Pahana.app` in Terminal once.

**Windows:** if **Windows protected your PC** appears, click **More info → Run anyway**.

### Try the demo

1. The app opens **offline**, with 48 readings from today's round waiting to sync.
2. **Clinic portal → Start clinic portal → Open in browser** opens the doctor's portal.
3. Click **No signal** to bring signal back, and watch the portal fill to **Red 8 · Amber 31 · Green 427**.
4. Review a red patient, press **3** then **⌘/Ctrl ↵**, and see the SMS arrive on the patient's phone.

**Settings → Reset demo data** starts it over. The full walkthrough is in the [README](https://github.com/rbnIbraheem09/pahana#demo-in-5-minutes).

> Prototype. Not for clinical use. Triage thresholds must be validated against Sri Lanka MoH NCD guidelines by a clinician before any pilot.
