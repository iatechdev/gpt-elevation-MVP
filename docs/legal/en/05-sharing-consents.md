# Consents for sharing and for AI reading (professional bridge and related)

> **DRAFT WITHOUT LEGAL REVIEW** · working version `2026-11-v1` · ES-335 · 18 Nov 2026.
> Gathers the system’s per-purpose consent texts (contract 14, contract 19 and the current interface texts). Each permission is **independent**, **revocable** and recorded with purpose, scope, version and date. There is no global consent and no single box that gives them all.
> Markers: `[TO BE COMPLETED PC-nn]` and `[VERIFY VF-nn]`; list in `../POR-COMPLETAR.md`.

## Rules common to all permissions

1. **It is your decision and you can withdraw it at any time.** Withdrawing a permission does not change your access to Elevation or your other options.
2. **Each permission is independent.** Giving one does not give others; declining one does not block the necessary use of the application or the other features.
3. **Only what you authorise is shared, and only with whom you authorise.** The permission to share with a professional or reviewer is tied to **that person**: if they change, the new person does not inherit it.
4. **What is private stays private.** Your conversations, your journal and any sign of crisis **never** reach the professional engine or third parties through any permission.
5. **A copy already downloaded cannot be retrieved automatically.** If you downloaded your data, withdrawing a permission does not delete that copy.
6. **If something you authorised changes or disappears** (for example, you withdraw the source), what depended on it is marked “for review”.
7. You can see the history of your decisions (purpose, scope, version, date) in the application.

## 1. Professional bridge (`professional_bridge`)

**What you authorise:** that the **texts you choose** to move from your private exploration into your career work can be read by your professional. What crosses is chosen **text by text** (at most 12 texts in total and 3 per category).

**What happens if you give it:**
- Your professional can see only the fields you moved, with their version and the date you authorised them.
- Each read is recorded (which keys and who consumed them), never the text or a fingerprint.
- An idea proposed by the AI is a **hypothesis**: nothing crosses until you confirm each one.

**What does not happen:** your conversations, your journal and crisis indicators do not cross; a non-shareable text cannot be moved.

**How to withdraw:** “Revoke” a text or “Withdraw all”. From then on your professional stops seeing your authorised professional profile.

## 2. Share with my professional (`therapist_sharing`)

**What you authorise:** that **your assigned professional** sees **your email, your mood and your ratings**. They will **not** see your chats, your journal or your career map.
The permission is tied to that professional (`therapist-<id>`).
**How to withdraw:** from “Share my data with my professional”. If the change cannot be confirmed, the interface tells you and asks you to check before continuing.

## 3. Share with the facilitator (`facilitator_sharing`)

**What you authorise:** sharing with the facilitator what is defined for that purpose. [VERIFY VF-12: contract 14 lists this purpose but, at the time of writing, it is not clear that any feature consumes it in production; confirm with Mauricio and, if none exists, remove this section before launch.]

## 4. Review by a reviewer (`professional_review`)

**What you authorise:** that **a specific reviewer** sees material you marked and records a review, which you can **object to**. The permission is tied to that reviewer (`reviewer-<id>`) and withdrawn per reviewer.
**What happens if you withdraw it:** they can no longer see the material; reviews already recorded remain theirs and you keep the right to object to them. [VERIFY VF-13: confirm with Mauricio the exact behaviour of already-made reviews after withdrawal.]
The feature is “in validation”: your objections are saved and your reviewer can see them.

## 5. AI reading of my sources (`insights_chat`, `insights_diary`, `insights_resume`, `resume_ai_reading`)

**What you authorise (per source, separately):** that the AI reads **{your chat | your journal | your résumé}** in order to **suggest ideas** about who you are and what moves you.
- It reads **up to your 20 most recent messages** (not the assistant’s replies), **up to your 10 most recent journal entries**, or the text of the résumé version you choose (**without your contact details**).
- The text that is read is processed by the AI provider to generate the ideas. **Nothing reaches a professional.**
- Texts the system flags as risk **are skipped**.
- Each idea is a hypothesis with a sentence of yours as a quote. Nothing is saved or reaches your professional unless you confirm each idea.
- **Withdrawing the permission does not delete** your résumés; that is done separately. Withdrawing `resume_ai_reading` does delete your analysed résumés [VERIFY VF-14: the code comment says withdrawing it deletes the résumés, while the interface text says it does not; confirm with Mauricio the real behaviour and align the text].

## 6. Notifications (`notifications`)
Receive platform notices. Optional and revocable. [VERIFY VF-15: confirm with Mauricio which notifications are sent today and through which channel.]

## 7. Research (`research`)
Exists as a separate, optional choice, **independent** of “Your feedback” (document 06). Today no feature uses it. [VERIFY VF-06: confirm with Alejo whether there will be a research use; if so, draft it here before offering it.]

## 8. “Necessary” permission (`necessary`)
Covers the operation needed to use the application (account, session, security). It is mandatory and only ends by deleting the account.
