# Data retention and deletion policy

> **DRAFT WITHOUT LEGAL REVIEW** · working version `2026-11-v2` · ES-335 · 18 Nov 2026.
> Aligned with the implemented purge (contract 18, ES-274, ES-293; `backend/utils/personalData.js`, `backend/utils/deletionProcessor.js`, `backend/scripts/purgePersonalData.js`). **Periods are not decided**: the system does not promise a seven- or thirty-day closure and `deadlinesVerified` is still `false`. Markers: `[TO BE COMPLETED PC-nn]`, `[VERIFY VF-nn]`, `[LEGAL REVIEW RL-nn]`; list in `../POR-COMPLETAR.md`.

## 1. Principle
We keep your data only while it is needed to provide the service and meet legal obligations. You can ask for its deletion at any time.

## 2. While your account is active
| Data | Retention |
| --- | --- |
| Account, context, conversations, journal, mood, ratings, evidence, skills map, résumés, permissions | While the account is active [TO BE COMPLETED PC-06: maximum period for inactive accounts, if any]. |
| Sessions (access token) | Expire after **8 hours**. |
| Password-reset links | Single use; expire after **30 minutes** by default. |
| File download links | Signed, short-lived (15 minutes by default). |
| Preview and file of the personal export | [VERIFY VF-16: confirm with Mauricio how long a generated export lives before it expires]. |
| AI usage log (without content) | [TO BE COMPLETED PC-15]. |
| Revoked session tokens and security locks | [TO BE COMPLETED PC-15: operational retention to be agreed]. |
| Server logs | Do not contain links, tokens or email recipients. Provider retention: [TO BE COMPLETED PC-15]. |

## 3. When you ask to delete your account
1. **When your request is registered**, sessions and data transfer are blocked; the account becomes inactive.
2. Your request is recorded and you receive a **receipt**.
3. **The purge of your data is NOT automatic or immediate:** today it is a maintenance command that **the team runs manually** (with integrations stopped) after receiving the request. Time to run it: [TO BE COMPLETED PC-13: execution deadline; no immediacy or number of days is promised].
4. **When the purge runs, your content data is deleted**: conversations and turns, journal, mood, ratings, recommendations, evidence and its versions, professional-bridge context and versions, declared context, résumés and derived skills, plan requests, matching questionnaire, AI usage and permissions with their history, and generated exports.
5. Your **user remains as a “tombstone”**: name and email are replaced, the password is replaced, motivation and assignments are cleared, and the version and date of your acceptance of the terms are erased [LEGAL REVIEW RL-05: see question E301-2 in `../PREGUNTAS-ABOGADO.md`]. The internal identifier and a mark that the account was deleted are kept, to prevent reactivation and keep other records consistent.
6. From your **application as a professional** (if you made one) we only keep its status and dates; we delete name, email, licence, message, profile and résumé.

**It goes to prior review and is not purged automatically** if the account has records on the professional or administration side (notes, sessions or profiles the account wrote as a professional, assignments to other users…).

## 4. What is kept after a person is deleted
What a **professional wrote about you** as their own work record:
- the notes the professional wrote about you;
- live notes from their sessions;
- the session’s agenda row with the professional’s note (your data in it is cleared: mood after, cancellation reason, meeting and recording links, calendar identifier).

**Important:** the free text of those notes may contain data that identify you and cannot be cleaned automatically; **we do not claim that what is kept is anonymised or unlinked from you.** Period and basis for this retention: [TO BE COMPLETED PC-14: Mauricio’s decision on retention of human-service records; QA-23-02].

## 5. Backups, providers and logs
- Deletion in backups, caches, logs and data at providers (hosting, database, storage, language model, email) **depends on each provider and its period is not verified**. [TO BE COMPLETED PC-13: effective period for full deletion and procedure when restoring a backup].
- If a backup earlier than your request is restored, the purge is applied again before access is opened. [VERIFY VF-17: the deletion-request log independent of the backup is not provisioned yet; confirm with Infra before launch.]

## 6. How to exercise your rights
From the application (download your data, withdraw permissions, ask for deletion) or by writing to [TO BE COMPLETED PC-04]. [VERIFY VF-18: the export and deletion routes sit behind a switch (`DATA_RIGHTS_ENABLED`) and stay disabled until the operational dependencies are approved; confirm their state at launch.]
Response time: [TO BE COMPLETED PC-12].

## 7. Aggregated data
Aggregated pilot results (which identify no one and are shown only with 5 or more people) may be kept. [LEGAL REVIEW RL-06: confirm whether they count as anonymised data outside the scope of deletion.]
