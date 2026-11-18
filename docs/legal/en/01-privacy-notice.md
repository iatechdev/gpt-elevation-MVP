# Privacy notice and personal data processing policy

> **DRAFT WITHOUT LEGAL REVIEW** · working version `2026-11-v2` · ES-335 · 18 Nov 2026.
> Written from what the system does today (verified against the code; see `../VERIFICACION-CONTRA-CODIGO.md`). This is not legal advice and must not be published to real people without the lawyer's review and without completing the markers.
> Markers: `[TO BE COMPLETED PC-nn]` = information only the company can provide; `[VERIFY VF-nn]` = a fact that could not be confirmed. Full list in `../POR-COMPLETAR.md`.

**Last updated:** [TO BE COMPLETED PC-05: effective date]

## 1. Who is responsible for your data

[TO BE COMPLETED PC-01: legal name] ([TO BE COMPLETED PC-02: tax ID]) is the controller of your personal data.

- Address: [TO BE COMPLETED PC-03: address].
- Contact for data matters (questions, complaints, exercising rights): [TO BE COMPLETED PC-04: data contact email].
- Person or team in charge of data protection: [TO BE COMPLETED PC-10: if applicable].

## 2. What Elevation is and is not

Elevation helps you get to know yourself, organise your skills and try small steps forward in your career. It is **non-clinical** emotional support and self-knowledge.

**It is not therapy, it does not diagnose, it prescribes nothing, and it does not promise results or a job.** Details are in the *Non-clinical product notice* (document 03).

## 3. What data we process

| Category | What it includes | How it is stored |
| --- | --- | --- |
| Account | Name, email, password, role on the platform (person, professional, administration…), chosen plan, creation and access dates, failed sign-in attempts and temporary locks. | The password is stored as a hash, never in readable text. |
| Acceptance of this notice and the terms | The version you accepted and the acceptance date (set by the server). | Users table. |
| Your professional context | What you declare when you start: country of residence, target market, time zone, preferred language, profession, interests, weekly availability, career goal and constraints, sector, years of experience, experience, education, skills and languages. | Application-level encryption. |
| Your conversations | The messages you write to the assistant and its replies. | Application-level encryption. |
| Your journal | The entries you write. | Application-level encryption. |
| Your mood and ratings | Mood records (start and end of a session) and session ratings. | Database. |
| Your evidence and skills map | Situations, results and skills you record or confirm, with their versions. | Application-level encryption. |
| Your résumés | The PDF files you upload and the analysis you authorise. | File in private storage; encrypted content. |
| Your permissions | Each permission you give or withdraw (purpose, scope, version and date), with its history. | Database. |
| AI usage | Call type, model, period, tokens, cost, latency and error code; **without** the text of your messages or of the replies. | Database. |
| Pilot feedback | Your answers to the “Your feedback” questions, only if you gave that permission (document 06). | Database. |
| Invitations | If you were invited: your email, the role and language of the invitation, and an irreversible digest of the link (not the link itself). | Database. |
| Professional application | If you apply to be a professional: name, email, licence, message, profile and résumé. If you delete your account, only its status and dates are kept. | Database and private storage. |
| Minimal technical data | What is needed to keep your session (see document 04) and for security: attempt limits, revoked session tokens. | Browser and database. |

**Please do not write health information or other people’s data** (for example, names or contact details of third parties) in your texts.

[VERIFY VF-04: confirm with Mauricio whether the account name and email are stored encrypted or in clear; today they are assumed to be in clear because administration sees them to operate the account.]

## 4. What we use your data for

- To provide the service: talk with you, keep your journal, build your skills map and suggest small experiments.
- To keep your account and the platform secure (access control, attempt limits, session revocation).
- To answer your requests about your data (view, download, correct, withdraw permissions, delete).
- To improve the pilot with **aggregated** results, only if you gave the “Your feedback” permission (see document 06). Groups of fewer than 5 people are not shown.

**We do not use your data for advertising and we do not sell it.** [VERIFY VF-05: confirm with Alejo that no other commercial use exists or is planned.]

The **research** permission (`research`) exists as a separate, optional choice in the system, but today no feature uses it. [VERIFY VF-06: confirm with Alejo whether there will be a research use and, if so, draft it before launch.]

## 5. What is private

- **Your conversations and your journal are yours alone.** The professional team, administration and super-administration do not see them.
- **Anything that could point to a crisis is shared with no one.** The detected risk level lives only during that request: it is not stored, not logged and does not reach any professional, administrator or third party. There are no automatic alerts to anyone.
- **A professional only sees what you authorise**, and only that (document 05). You can withdraw each permission at any time.
- Administration sees the account data needed to operate the platform (name, email, role, status, plan, locks) and **aggregated results**; never your journal or your conversations.

## 6. Who your data is shared with

Only in these cases, always with your express permission, given separately:

1. **Your assigned professional (therapist or facilitator)**, if you authorise sharing your email, mood and ratings with them (they will not see your chats, your journal or your career map). The permission is tied to **that person**: if your professional changes, the new one does not inherit it.
2. **The professional bridge**: what you choose to move from your private exploration into your career work, text by text.
3. **A reviewer** you designate to see material you mark, with the possibility of objecting to their review.
4. **The AI**, to read your chat, journal or résumé in order to suggest ideas to you, only if you give that permission per source (see section 7).

There is no transfer to employers or commercial third parties.

## 7. Artificial intelligence and providers

The assistant’s replies are generated by a language model from **Anthropic** (Claude model), to which the server sends only what is strictly necessary:

- **Chat:** up to your last 20 messages of the conversation and the journal entries you choose for that conversation. We do not send your name or email.
- **If a message of yours shows a serious sign of crisis,** that turn is not sent to the model: we reply with a fixed safety message (it is not resent in later messages either).
- **Wellbeing suggestions:** a summary of your last 7 mood entries (how many there are, average and trend), with no text of yours.
- **Skills analysis:** the evidence you confirmed (among other data: title, situation, responsibility, actions, goal, result, learning and the autonomy you declared) and the catalog rubric, when you ask for the analysis of your map. Your journal, mood and conversations are not sent.
- **Skills proposals from your professional context** (server feature, no screen of its own today): the fields of the professional context you approved in The Bridge (motivations, values, interests, energy, desired conditions and constraints). [VERIFY VF-19: confirm with Mauricio whether this feature will be enabled for users and when; if not, remove this bullet.]
- **Reading your sources (only if you allow it, source by source):** up to 20 messages from your chat, up to 10 entries from your journal or the text of your résumé without contact details, to suggest ideas to you.
- **Matching with a professional:** the short answers you chose, without your mood.
- **If you share with your professional:** at the end of a session, a label of your mood; and, when your professional asks for a summary, only aggregate figures (how many entries, average mood and average rating), without your name or your texts.
- Before sending, we mask keys, tokens and connection strings you may have pasted. The model’s replies may contain mistakes; check them before relying on them for something important.

Besides Anthropic, we use providers that process data on our behalf (processors):

| Function | Provider | Country / transfer |
| --- | --- | --- |
| Language model | Anthropic | [TO BE COMPLETED PC-11: country and basis for transfer] |
| Application hosting | [TO BE COMPLETED PC-11: provider in force at launch] | [TO BE COMPLETED PC-11] |
| Database and private file storage | [TO BE COMPLETED PC-11: provider in force at launch] | [TO BE COMPLETED PC-11] |
| Transactional email (password reset, invitations) | [TO BE COMPLETED PC-11: provider not yet defined] | [TO BE COMPLETED PC-11] |

[VERIFY VF-01: the code and deployment documents mention hosting on Railway, Supabase (file storage and database) and a planned Vercel + Supabase deployment. Infra must confirm the real production environment.]
[VERIFY VF-02: confirm contractually that the AI provider does not use the data sent to train its models and how long it keeps it.]
[VERIFY VF-03: confirm each provider’s country and whether there is international data transfer.]

## 8. How long we keep it

Summary (details in document 07): we keep your data while your account is active. If you ask to delete your account, **we purge your content data** (conversations, journal, evidence, résumés, mood, ratings, permissions, plan requests…), leave your user as a record without name or email, and **keep what a professional wrote about you** (clinical or session notes) because it is their professional record [PC-14]. Exact periods are still to be defined: [TO BE COMPLETED PC-06].

## 9. Your rights and how to exercise them

At any time you can:

- **Know and download** your data (personal export in the application).
- **Correct** your account and context data.
- **Withdraw** each sharing or AI-reading permission. A copy you already downloaded cannot be retrieved automatically.
- **Ask for deletion** of your account and data.
- **Submit questions or complaints** to the contact in section 1.

Response time: [TO BE COMPLETED PC-12: legal and own deadlines]. Applicable legal framework: [TO BE COMPLETED PC-08: to be defined with the lawyer; Colombian data-protection law, e.g. Law 1581 of 2012, is assumed but to be confirmed].

## 10. Security

- Hashed passwords; sessions that **expire after 8 hours** and can be closed on all devices; single-use reset links that expire (30 minutes by default).
- Sensitive content encrypted at application level; files in private storage with short-lived signed links.
- Sign-in attempt limits and temporary lock; every access by a professional or administrator checks the role and the ownership of the data **on the server**.
- No system is infallible: tell us about any incident you notice (contact in section 1).

## 11. Minors

The service is designed for adults changing careers. Minimum age to create an account: [TO BE COMPLETED PC-07: minimum age; legal review].

## 12. Changes to this notice

This notice has a version and a date. When you create your account we record the version you accepted and the date of acceptance. If we make a substantive change to the notice, we will publish the new version; existing accounts keep the version they accepted on record. How changes are notified to people who already have an account: [TO BE COMPLETED PC-17: channel and notice period for changes; decision pending, see ES-339 and question Q21 for the lawyer].
