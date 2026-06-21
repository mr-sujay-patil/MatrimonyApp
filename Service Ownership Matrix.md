# Service Ownership Matrix — Matrimony Platform

This document defines the service boundaries, system-of-record ownership, external dependencies, and allowed communication paths for the Matrimony Platform services. It ensures strict data isolation and defines the architectural boundaries from a logical and business perspective before physical implementation begins.

---

## 1. Service Overview

To build a scalable and maintainable platform, we enforce a **Database-per-Service** architecture. Each microservice is the exclusive system-of-record for its designated domain entities. 
* **Zero Shared Databases**: No service may directly read or write to another service's private database.
* **Strict Boundary Isolation**: Inter-service communication must happen strictly via public APIs (synchronous queries) or event-driven messages (asynchronous notifications).
* **Decoupled Data Updates**: When a service requires information from another domain, it must consume events and build local read-only projections or request the data dynamically.

---

## 2. Service Catalog

### 1. API Gateway (BFF Layer)
* **Purpose**: Serves as the single client entry point to route traffic and enforce edge security boundaries.
* **Responsibilities**: Authentication checking, rate limiting, payload sanitization, and contact details masking.
* **Owned Entities**: None.
* **Consumed Entities**: User (for token check), Profile (for output masking).
* **External Dependencies**: Edge network CDNs (e.g. Cloudflare).
* **Published Events**: None.
* **Consumed Events**: None.
* **Business Rules**: Apply client masking rules on phone numbers and email variables if connection status is not verified.

---

### 2. Auth Service
* **Purpose**: Manages user registration credentials, authentication sessions, and identity keys.
* **Responsibilities**: Signup account creation, credential hashing, login, token emission, and session deactivation.
* **Owned Entities**: User.
* **Consumed Entities**: None.
* **External Dependencies**: None.
* **Published Events**:
  * `user.auth.created` (when account is registered)
  * `user.auth.deleted` (when account is permanently removed)
* **Consumed Events**: None.
* **Business Rules**: Restrict token lifecycle to short-lived durations; handle password hashing policies.

---

### 3. Profile Service
* **Purpose**: Coordinates profile onboarding wizard, personal/family profile details, and edit configurations.
* **Responsibilities**: Managing wizard progress data, profile details editing, and profile completion tracking.
* **Owned Entities**: Profile, FamilyProfile.
* **Consumed Entities**: User (verifies account link).
* **External Dependencies**: None.
* **Published Events**:
  * `user.profile.created` (on onboarding wizard submission)
  * `user.profile.updated` (on dashboard modification)
* **Consumed Events**:
  * `user.auth.created` (triggers initial profile record stub)
* **Business Rules**: Require at least one photo before allowing profile completion status to hit 100%. Age calculated >= 18.

---

### 4. Search Service
* **Purpose**: Delivers fast, structured filters and geolocation queries.
* **Responsibilities**: Storing active profiles search metadata and responding to filtered queries.
* **Owned Entities**: None (maintains a denormalized read-only search cache index).
* **Consumed Entities**: Profile, Photo.
* **External Dependencies**: Geolocation indexing libraries.
* **Published Events**: None.
* **Consumed Events**:
  * `user.profile.updated` (re-indexes profile coordinates)
  * `media.photo.visibility_changed` (removes hidden photos from index)
  * `user.auth.status_changed` (excludes inactive profiles)
* **Business Rules**: Exclude profiles inactive for more than 90 days from index queries.

---

### 5. Matchmaking Service
* **Purpose**: Ranks profile compatibility based on partner preferences and scores.
* **Responsibilities**: Providing compatibility scoring and generating daily recommendations lists.
* **Owned Entities**: Match.
* **Consumed Entities**: Profile, PartnerPreference.
* **External Dependencies**: None.
* **Published Events**:
  * `match.recommendations.served` (when daily lists are compiled)
* **Consumed Events**:
  * `interest.status.accepted` (triggers creation of mutual Match object)
* **Business Rules**: Limit daily match list to exactly 10 recommendations with compatibility score > 80%.

---

### 6. Interest Service
* **Purpose**: Manages double-opt-in connection request pipelines.
* **Responsibilities**: Dispatching interests, processing acceptances/rejections, and managing inbox categories.
* **Owned Entities**: Interest.
* **Consumed Entities**: Profile.
* **External Dependencies**: None.
* **Published Events**:
  * `interest.request.sent` (when interest is initiated)
  * `interest.status.accepted` (when receiver approves interest)
  * `interest.status.declined` (when receiver declines interest)
* **Consumed Events**: None.
* **Business Rules**: Block interest creation if a pending interest request already exists between target profiles.

---

### 7. Chat Service
* **Purpose**: Enables direct, real-time messaging between matched partners.
* **Responsibilities**: Handling real-time messaging, message storage, and delivery receipts.
* **Owned Entities**: Conversation, Message.
* **Consumed Entities**: Match.
* **External Dependencies**: Real-time websocket gateway components.
* **Published Events**:
  * `chat.message.sent` (when message passes verification checks)
* **Consumed Events**:
  * `interest.status.accepted` (creates conversation thread)
* **Business Rules**: Verify active Match exists before allowing message delivery; scan for contact details patterns to enforce early masking.

---

### 8. Notification Service
* **Purpose**: Handles outbound communications (email, SMS, push alerts).
* **Responsibilities**: Queueing, rendering, and routing transactional alerts.
* **Owned Entities**: Notification.
* **Consumed Entities**: User.
* **External Dependencies**: SendGrid (email client), Twilio (SMS provider), FCM (push client).
* **Published Events**: None.
* **Consumed Events**:
  * `user.auth.created` (routes welcome/verification link)
  * `verification.otp.generated` (routes SMS payload)
  * `interest.request.sent` (routes connection alert)
  * `chat.message.sent` (routes offline alert)
* **Business Rules**: Suppress alert delivery if recipient is currently active inside the targeted conversation.

---

### 9. Media Service
* **Purpose**: Manages raw image uploads, content validation checks, and visibility scopes.
* **Responsibilities**: Image uploader validations, S3 bucket storage management, and blurred placeholder rendering.
* **Owned Entities**: Photo.
* **Consumed Entities**: Profile.
* **External Dependencies**: Amazon S3 (storage bucket).
* **Published Events**:
  * `media.photo.uploaded` (when image uploads to storage)
  * `media.photo.visibility_changed` (when user alters visibility configurations)
* **Consumed Events**: None.
* **Business Rules**: Max image limit strictly capped at 5 per user profile. Reject file uploads exceeding 5MB or non-image types.

---

### 10. Verification Service
* **Purpose**: Manages identity validation workflows.
* **Responsibilities**: OTP code generation, email verification validation check, and ID badge processing.
* **Owned Entities**: Verification.
* **Consumed Entities**: User.
* **External Dependencies**: SMS carriers and verification partners.
* **Published Events**:
  * `verification.otp.generated` (triggers SMS dispatch)
  * `verification.status.success` (triggers profile activation)
  * `verification.status.locked` (notifies operations of block)
* **Consumed Events**: None.
* **Business Rules**: OTP codes expire in 5 minutes; 3 failures trigger 1-hour brute force lock.

---

### 11. Subscription Service
* **Purpose**: Governs monetized feature gates and membership tiers.
* **Responsibilities**: Managing tier plans, renewal dates, and billing access permissions.
* **Owned Entities**: Subscription.
* **Consumed Entities**: User.
* **External Dependencies**: Payments integrations.
* **Published Events**:
  * `subscription.status.changed` (notifies tier changes)
* **Consumed Events**: None.
* **Business Rules**: Restrict premium queries instantly upon subscription expiration deactivation.

---

## 3. Ownership Matrix

This matrix ensures every domain model entity maps to exactly one system-of-record service.

| Entity | Owning Service (System of Record) | Verification Check |
| :--- | :--- | :--- |
| **User** | Auth Service | Verified - Owns core login and user state |
| **Profile** | Profile Service | Verified - Owns personal demographic variables |
| **FamilyProfile** | Profile Service | Verified - Owns parent & collaborative data |
| **PartnerPreference** | Profile Service | Verified - Owns target preferences metadata |
| **Photo** | Media Service | Verified - Owns S3 links and visibility scopes |
| **Verification** | Verification Service | Verified - Owns security OTP and token states |
| **Interest** | Interest Service | Verified - Owns connection requests pipelines |
| **Match** | Matchmaking Service | Verified - Owns mutual connection states |
| **Conversation** | Chat Service | Verified - Owns chat sessions metadata |
| **Message** | Chat Service | Verified - Owns text exchanges history |
| **Notification** | Notification Service | Verified - Owns outbound alerts queue |
| **Subscription** | Subscription Service | Verified - Owns gated membership levels |

---

## 4. Dependency Matrix

Enforces service dependency directions. Under this microservices plan, calling directions are strictly regulated.

```
[Allowed Direct API Call Paths]
Client -> API Gateway -> Auth / Profile / Search / Interest / Chat
Profile Service -> User Service (Account verification check)
Matchmaking Service -> Profile Service (Fetch preference arrays)

[Forbidden Call Paths]
Chat Service -X-> Profile Service DB (Cannot read or write profile tables directly)
Notification Service -X-> User Service DB (Must receive user details via events/APIs)
Search Service -X-> Profile Service DB (Must receive profile updates via events only)
```

### Allowed vs. Forbidden Service Interactions

| Source Service | Target Service | Allowed Interaction | Type | Reason |
| :--- | :--- | :--- | :--- | :--- |
| **API Gateway** | **All Services** | Allowed | HTTP API Routing | Edge controller traffic dispatcher. |
| **Chat Service** | **Profile Service** | **Forbidden** | Direct DB Write | Must not modify user profiles. |
| **Chat Service** | **Profile Service** | Allowed | API query (Read-Only) | Reading contact names for conversation headers. |
| **Notification** | **Any Service** | **Forbidden** | Direct DB Read | Must use events/APIs for user context. |
| **Search Service**| **Profile Service** | **Forbidden** | Direct DB Read | Must index records via `user.profile.updated` events. |
| **Interest** | **Matchmaking** | Allowed | Async Queue Event | `interest.status.accepted` initiates match creation. |

---

## 5. Communication Principles

To maintain decoupling, services follow strict communication directives:

1. **Synchronous Interactions (REST/gRPC)**:
   * Used for real-time reads and transactional checks where immediate responses are required (e.g. API Gateway routing, checking auth tokens, verifying target profile exists prior to interest dispatch).
2. **Asynchronous Interactions (Message Broker - RabbitMQ)**:
   * Used for state updates, updates propagation, and non-blocking background operations (e.g., re-indexing search database on profile update, dispatching SMS upon OTP ticket initialization, creating chat window on interest acceptance).
3. **Data Redundancy (Caching & Indexing)**:
   * Search Service maintains a read-only index of Profile details synced via message broker. It never writes back to Profile database.

---

## 6. Service Responsibilities Summary

Below is the summary mapping business capabilities to logical services:

* **User Authentication**: Handled by **Auth Service** (OTP verify, magic links, tokens).
* **Onboarding & Background**: Handled by **Profile Service** (Wizard steps, details editor).
* **Image Management**: Handled by **Media Service** (S3 storage, visibility, blurring).
* **Filters & Location Search**: Handled by **Search Service** (Elasticsearch queries).
* **Interest Workflows**: Handled by **Interest Service** (Inbox tracking, send actions).
* **Recommendations List**: Handled by **Matchmaking Service** (Scoring, daily cron).
* **Direct Messaging**: Handled by **Chat Service** (Websockets message delivery, history).
* **Security Validation Checks**: Handled by **Verification Service** (OTP generate, locks).
* **Outbound Alerts Delivery**: Handled by **Notification Service** (Email, SMS, Suppressions).
* **Feature Gating**: Handled by **Subscription Service** (Tier gates, renews).
