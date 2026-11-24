# Security Specification — CCN (Creative Craft Nation)

## 1. Data Invariants
1. A `UserProfile` document at `/users/{userId}` can only be read, created, or updated by the authenticated owner (`request.auth.uid == userId` & `email_verified == true`) or verified Admin (`isAdmin()`). Users cannot list `/users` or read another user's PII.
2. On `UserProfile` update by owner, `uid`, `email`, and `createdAt` are immutable; only `name`, `addr`, and `updatedAt == request.time` may change.
3. An `Order` document at `/users/{userId}/orders/{orderId}` can only be created by its verified owner under an existing `/users/{userId}` parent document, with `no == orderId`, bounded `items`, and `createdAt == request.time`. Only `isAdmin()` may list orders across users or update the `status` field.
4. `site_config`, `site_products`, and `faq_items` are publicly readable (`get` and filtered `list`), and writable exclusively by `isAdmin()`.
5. `forum_posts` can be created only by verified signed-in users with `authorUid == request.auth.uid` and empty answer `a == ""`; only `isAdmin()` can update `a` (admin reply) or `visible` or delete posts.
6. `/admins/{userId}` cannot be self-created or modified by non-admins.

## 2. Adversarial Payloads ("Dirty Dozen")
1. **Unauthenticated Profile/Site Write**: Writing `/site_config/main` or `/site_products/p0` with `auth = null` -> `PERMISSION_DENIED`.
2. **Unverified Admin Email Spoof**: User with `email: "www.charlesindigo@gmail.com"` and `email_verified: false` writes `/site_config/main` -> `PERMISSION_DENIED`.
3. **Customer Edits Website Content**: Verified non-admin user writes `/site_config/main`, `/site_products/p0`, or `/faq_items/f1` -> `PERMISSION_DENIED`.
4. **Privilege Escalation via `/admins`**: Non-admin creates `/admins/$(uid)` to grant self admin access -> `PERMISSION_DENIED`.
5. **Customer Tampers Own Order Status**: Verified customer updates `/users/$(uid)/orders/CCN-123456` setting `status: "Sudah dibayar (QRIS)"` -> `PERMISSION_DENIED`.
6. **Cross-User Order Read**: Non-admin reads or lists `/users/otherUid/orders` -> `PERMISSION_DENIED`.
7. **Users Collection Scrape**: Non-admin queries `collection(db, "users")` -> `PERMISSION_DENIED`.
8. **Shadow Field Injection on SiteConfig**: Admin or attacker writes `{ ..., extraScript: "<script>" }` to `/site_config/main` -> `PERMISSION_DENIED`.
9. **Forum Reply Spoofing by Non-Admin**: Regular user creates `/forum_posts/p1` with `a: "Official reply"` or updates another user's post -> `PERMISSION_DENIED`.
10. **Fake Server Timestamp**: Writing `createdAt` or `updatedAt` != `request.time` -> `PERMISSION_DENIED`.
11. **Oversized String / Resource Poisoning**: Writing 5000-char `heroTitle` or 500-char `productId` -> `PERMISSION_DENIED`.
12. **Blanket List Scrape Attempt on Orders**: Non-admin runs `collectionGroup(db, "orders")` without owner `userId` constraint -> `PERMISSION_DENIED`.
