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
