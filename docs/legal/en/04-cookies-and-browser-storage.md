# Cookies and browser storage policy

> **DRAFT WITHOUT LEGAL REVIEW** · working version `2026-11-v1` · ES-335 · 18 Nov 2026.
> Checked against the frontend code (see `../VERIFICACION-CONTRA-CODIGO.md`). Markers: `[TO BE COMPLETED PC-nn]`, `[VERIFY VF-nn]`, `[LEGAL REVIEW RL-nn]`; list in `../POR-COMPLETAR.md`.

## Summary
- **Elevation does not set its own cookies** (the code neither writes nor reads `document.cookie`). [VERIFY VF-09: check in a browser on a deployed environment, in the storage tab, that no cookie appears, including any that the hosting provider might set.]
- We keep a few items **in browser storage** (localStorage and sessionStorage), only those needed for the application to work and to remember your preferences. We use no analytics, advertising or third-party tracking. [VERIFY VF-10: no analytics or advertising tool was found in the code; confirm on the deployed environment.]
- Since everything is strictly necessary or a preference you choose, **we do not ask for a cookie banner** in this version. [LEGAL REVIEW RL-03: confirm whether the applicable framework requires notice or consent for local storage of preferences.]

## What we keep in your browser

| Key | Where | Purpose | How long |
| --- | --- | --- | --- |
| `elevation_token` | localStorage | Keep you signed in. | Until you sign out, or until the server invalidates it (it expires after 8 hours). |
| `elevation_role`, `elevation_name` | localStorage | Show your name and role in the interface. **They do not decide your access**: the server verifies your role on every request. | Until you sign out. |
| `elv_lang` | localStorage | Remember your language (ES/EN). | Until you delete it. |
| `elv_theme` | localStorage | Remember your visual theme (light, dark or system). | Until you delete it. |
| `elevation_chat_enter_sends` | localStorage | Remember whether the Enter key sends the message. | Until you delete it. |
| `elevation_checkin_date` | localStorage | Remember whether you already did today’s mood check-in. | Until you sign out. |
| `elevation_pending_chat` | sessionStorage | Keep an unconfirmed chat message if you reload the tab. | Until the tab or session is closed. |
| `elevation_space_paused` | sessionStorage | Remember that you paused the conversation. | Until the tab is closed. |
| `elevation_return_to` | sessionStorage | Return to the screen you wanted to open after signing in (only an internal route of the application). | 30 minutes at most; deleted on arrival or on sign-out. |

None of this contains the text of your journal, of your already-sent conversations or your context data. Public forms (for example, the professional application) store nothing in the browser.

## Third-party resources
- The application’s typefaces are served from our own site.
- An old static page (`/privacy`) loads typefaces from a third-party service (Google Fonts), which sends your IP address to that third party. [VERIFY VF-11: decide with Mauricio whether that page is removed or served with own typefaces; also its content belongs to the previous product and contradicts this notice — see `../PREGUNTAS-ABOGADO.md`.]

## How to delete it
Signing out deletes your session and what is tied to it. You can delete the rest from your browser settings (site data).
