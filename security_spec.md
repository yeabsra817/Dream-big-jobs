# Security Specification for DREAM BIG JOBS

## 1. Data Invariants
1. **Admin Control**: Only authenticated administrator (nexusitsoultion@gmail.com or designated admin in `/admins/{uid}`) can create, update, or delete vacancies, categories, duplicates, and site settings.
2. **Public Read Integrity**: Public anonymous visitors can ONLY read vacancies where `status == 'published'`. Non-published vacancies (draft, pending_review, archived, duplicate) are strictly restricted to administrators.
3. **Immutability of System Fields**: Fields such as `id`, `createdAt`, `createdBy` must not be tampered with on updates.
4. **Category Integrity**: Vacancies must belong to one of the 16 approved professional sectors.
5. **No Client Role Elevation**: Users cannot write to `/admins/{uid}` or make themselves administrators.

## 2. The Dirty Dozen Payloads (Designed to Fail)
1. **Unauthenticated Vacancy Creation**: An unauthenticated client attempting to `addDoc` to `/vacancies`.
2. **Unauthenticated Public Read of Draft/Duplicate**: An unauthenticated user querying `/vacancies` with status `draft`.
3. **Non-Admin Tampering with Vacancies**: An authenticated non-admin user attempting to delete a vacancy document.
4. **Self-Admin Escalation**: An authenticated user creating a document in `/admins/{uid}`.
5. **Settings Overwrite**: An anonymous user writing to `/siteSettings/general`.
6. **Ghost Key Injection in Vacancy**: An attacker sending arbitrary shadow fields (e.g. `__internal_bypass: true`).
7. **Malformed ID Injection**: Creating a document with non-alphanumeric junk string.
8. **Expired / Status Bypass**: Attempting to force publish without admin authorization.
9. **Duplicate Queue Poisoning**: Writing false duplicates to `/duplicates` as a public user.
10. **Admin Email Spoof without verification**: User presenting `email_verified == false` with admin address.
11. **Huge Payload / Denial of Wallet Attack**: Inserting >1MB string into vacancy description.
12. **Public Deletion of Published Jobs**: Anonymous client sending `deleteDoc` on `/vacancies/{id}`.

## 3. Enforcement Strategy
All the above 12 attack vectors are blocked by:
- Global default deny
- `isOwnerAdmin()` helper checking verified admin email and admin collection
- Strict status checking for public read queries: `resource.data.status == 'published'`
- String length limits and schema validation

## 4. International Expansion & Private Assistant Invariants
6. **Verified-Only Public Reads for International Expansion**: Public visitors may ONLY read `/international_jobs`, `/immigration_pathways`, and `/experience_scholarships` documents when `resource.data.verificationStatus == 'VERIFIED'` (and `applicationStatus != 'expired'` for jobs & scholarships). Documents marked `UNVERIFIED`, `SUSPENDED_BROKEN_LINK`, `EXPIRED`, or `REJECTED_SUSPICIOUS` are strictly restricted to `isOwnerAdmin()`.
7. **Admin-Only Research & Audit Logs**: `/research_history` and `/verification_logs` are readable and writable strictly by `isOwnerAdmin()`.
8. **Strict Private Assistant Isolation**: `/autoApplyProfile`, `/autoApplyDocuments`, and `/autoApplyApplications` remain strictly locked to `isOwnerAdmin()` and are never exposed to public visitors or standard job seekers.

## 5. Permanent Storage, Staff Profiles & Owner Control Invariants
9. **Staff Profile Ownership & Non-Escalation**: Authenticated staff and job seekers may ONLY read, create, and update their own `/job_seeker_profiles/{uid}` document where `request.auth.uid == userId` and `data.uid == userId`. Clients are blocked from injecting `isAdmin` or `role` fields, and `list` queries on `/job_seeker_profiles` remain restricted to `isOwnerAdmin()`.
10. **Owner-Only Permanent Deletion**: Only `isOwnerAdmin()` can delete profiles, backups, or settings. Backend `/api/admin/staff-profiles/:uid` requires verified owner headers and explicit confirmation tokens, taking a pre-delete safety backup first.
11. **Audit Logs & Backups Isolation**: `/audit_logs`, `/admin_notifications`, and `/system_backups` are readable and writable exclusively by `isOwnerAdmin()`.

## 6. Global Verified Opportunity Intelligence System Invariants
12. **Verified & Active-Only Public Reads**: Public visitors may ONLY read `/international_opportunities` documents where `resource.data.hasVerifiedBadge == true` and `resource.data.applicationStatus in ['open', 'closing_soon']`. Unverified, expired, withdrawn, or `< 3 full days` entries remain strictly restricted to `isOwnerAdmin()`.
13. **Strict User Ownership for Saved Opportunities & Recommendations**: `/user_saved_opportunities` and `/user_opportunity_recommendations` enforce `request.auth.uid == resource.data.userId` on reads, updates, and deletes, validate HTTPS-only application URLs, enforce field allow-lists (`hasOnly`) on saved items, and prevent `userId` reassignment.
14. **Admin-Only Verification & Discovery Job Logs**: `/opportunity_verification_logs` and `/discovery_job_logs` are readable and writable exclusively by `isOwnerAdmin()`.
15. **SSRF, URL & Website-Only Policy Enforcement**: Server-side official discovery and live verification strictly permit `https://` official domains, reject private/loopback/link-local hosts, respect `robots.txt`, and never dispatch email, SMS, WhatsApp, or push notifications for scholarships, trainings, or conferences.


