# “Your feedback” permission (pilot)

> **DRAFT WITHOUT LEGAL REVIEW** · ES-335 · 18 Nov 2026.
> **Current text approved by Mauricio on 17 Nov 2026 (ES-173; draft 12288 by UX/UI-Claude, “without legal review”). Reused as is** from `frontend/src/pilot/copy.ts` (`grant*` keys); it was not rewritten. Only what the lawyer needs to review it is added below.
> Markers: `[TO BE COMPLETED PC-nn]`, `[VERIFY VF-nn]`, `[LEGAL REVIEW RL-nn]`; list in `../POR-COMPLETAR.md`.

## Text the person sees

### Permission to save your feedback
To save your feedback we need your permission. It is separate from the research permission: you can give one and not the other.

**What happens if you give it**
- You can save and change your answers to the five questions. Each one has “Skip this question”.
- No one sees your individual answers.
- Only administration sees aggregated results (group counts), and only when there are 5 or more people. With fewer, they are not shown.
- We use those results to improve the pilot.
- Answering or not answering does not change your access or your options.

**What you can do afterwards**
- Withdraw the permission at any time. From then on no more answers are saved.
- Withdrawing the permission does not delete what you already answered.
- To delete what you answered, use “Withdraw my response” or delete your account.

This is not an assessment of your health or of you as a person, and it promises no outcome.

*Text without legal review.*

## Technical data for the legal review (verified against the code)
- Purpose of the permission: `pilot_feedback`, separate from `research`. It is recorded with version and date like any other permission.
- Answers are from a **closed catalogue** (five questions, no free text).
- Aggregates are shown **only from 5 people**, in bands of 5, without “no answer” categories, and are suppressed if all answers are equal (ES-325); an individual answer is never shown.
- “Withdraw my response” **deletes** the response; withdrawing the permission does not. Deleting the account deletes it (purge).
- [LEGAL REVIEW RL-04: the text says “only administration sees aggregated results” and “no one sees your individual answers”; confirm with the lawyer that this text is sufficient to treat feedback data as non-sensitive, and that “improve the pilot” is a sufficient purpose.]
- [TO BE COMPLETED PC-01: the controller of this processing is published with the privacy notice (document 01); it is not yet shown on the permission screen, and that is a launch blocker noted in ES-173.]
