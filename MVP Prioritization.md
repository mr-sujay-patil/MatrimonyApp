# Product Backlog Review and MVP Prioritization

This document details the MoSCoW classification, release scope, recommended build order, and delivery risks for the Matrimony Platform. The objective is to identify the smallest launchable version (MVP) of the platform while maintaining trust, security, and a premium user experience.

---

## 1. MoSCoW Prioritization Matrix

All 31 stories, 2 risk mitigations, and 2 spikes from the backlog have been categorized using the MoSCoW framework.

### Must Have (The Launch Core)
*Crucial features required to support basic authentication, profile onboarding, search discovery, and secure interest exchange. These form the minimum launchable product.*

*   **Spikes**:
    *   `SPIKE-001`: SMS OTP Gateway Verification Integration Path
    *   `SPIKE-002`: Elasticsearch Geofenced Matches Indexing
*   **Authentication & Security**:
    *   `STORY-001`: Mobile OTP Request UI & API Flow
    *   `STORY-002`: OTP Verification & Token Emission
    *   `STORY-005`: OTP Lockout Brute Force Prevention
*   **Onboarding & Profile**:
    *   `STORY-006`: Personal Details Onboarding Form
    *   `STORY-007`: Family Background Information Step
    *   `STORY-008`: Career, Education & Lifestyle Form Onboarding
    *   `STORY-010`: Profile Editor Dashboard Settings
*   **Partner Preferences**:
    *   `STORY-011`: Partner Preference Slider & Multi-Select UI Settings
    *   `STORY-012`: Partner Preference Server Validation & Defaults
    *   `STORY-013`: Preferences-Search Index Integration
*   **Media & Photos**:
    *   `STORY-014`: Multi-Photo File Drag & Drop Component
    *   `STORY-015`: Secure S3 Upload & Signed URL Logic
    *   `STORY-016`: Avatar Setting & Photo Visibility Controls
*   **Discovery & Search**:
    *   `STORY-017`: Match Discovery Sidebar & Card Grid UI
    *   `STORY-018`: Elasticsearch Geo-Location & Filter Sync
*   **Interests & Matching**:
    *   `STORY-021`: Send Connection Interest Button
    *   `STORY-022`: Accept & Decline Connection Action Flows
    *   `STORY-023`: Connection Inbox Dashboard View
    *   `STORY-024`: Duplicate Interest Prevention Engine
*   **Privacy & Masking**:
    *   `STORY-030`: Photo Blurring Visibility Middleware
    *   `STORY-031`: Server-Side API Contact Details Masking

### Should Have (High Impact)
*Important features that significantly improve user security, onboarding retention, or engagement, but are not strict blockers for a controlled launch.*

*   **Security & Session**:
    *   `STORY-004`: Session Management & Silent Refresh Tokens
*   **Engagement & Feedback**:
    *   `STORY-009`: Profile Completion Checklist UI
    *   `STORY-019`: Daily Recommended Matches Engine
*   **Notifications**:
    *   `STORY-025`: In-App Notification Center UI
    *   `STORY-026`: Push Notification Dispatcher Integration
*   **Privacy**:
    *   `STORY-029`: Profile Visibility Search Settings
*   **Risk Mitigations**:
    *   `RISK-001`: Risk Mitigation: High Onboarding Drop-Off Rate
    *   `RISK-002`: Risk Mitigation: Chat Platform Bypass Checks

### Could Have (Deferred Polish)
*Features that are useful but can easily be deferred to subsequent weekly releases without impacting the core matchmaking value loop.*

*   `STORY-003`: Email Magic Link Login
*   `STORY-020`: Inactive Profile Search Exclusions
*   `STORY-028`: Active Chat Notification Suppression

### Won't Have (Post-MVP Roadmap)
*Excluded from the initial MVP launch scope.*

*   `STORY-027`: Daily Email Digest Scheduler

---

## 2. MVP Story List vs. Post-MVP Story List

### MVP Story List (Launch Scope)
Consists of all **Must Have** and **Should Have** items (31 items total):
*   **Spikes**: `SPIKE-001`, `SPIKE-002` (5 SP)
*   **Auth**: `STORY-001`, `STORY-002`, `STORY-004`, `STORY-005` (16 SP)
*   **Profile & Preferences**: `STORY-006`, `STORY-007`, `STORY-008`, `STORY-009`, `STORY-010`, `STORY-011`, `STORY-012`, `STORY-013`, `RISK-001` (27 SP)
*   **Media**: `STORY-014`, `STORY-015`, `STORY-016` (13 SP)
*   **Search**: `STORY-017`, `STORY-018`, `STORY-019` (13 SP)
*   **Interests & Matches**: `STORY-021`, `STORY-022`, `STORY-023`, `STORY-024` (16 SP)
*   **Notifications**: `STORY-025`, `STORY-026` (8 SP)
*   **Privacy & Security**: `STORY-029`, `STORY-030`, `STORY-031`, `RISK-002` (14 SP)

**Total MVP Points**: **112 Story Points**

### Post-MVP Story List (Deferred)
*   `STORY-003`: Email Magic Link Login (3 SP)
*   `STORY-020`: Inactive Profile Search Exclusions (3 SP)
*   `STORY-027`: Daily Email Digest Scheduler (2 SP)
*   `STORY-028`: Active Chat Notification Suppression (1 SP)

**Total Deferred Points**: **9 Story Points**

---

## 3. MVP Release Scope

The MVP Release (`REL-001`) compiles a complete, secure user registration and discovery loop:

```
[Register via OTP] ──► [Onboard Profile] ──► [Search Profiles] ──► [Send/Accept Interest]
                                                                        │
[View Decrypted Details] ◄── [Double Opt-In Match Established] ◄───────┘
```

1.  **Trust & Identity**: Users register exclusively via verified SMS OTP with brute-force rate-limiting protection.
2.  **Rich Profiles**: Users fill in personal, family, and educational backgrounds to populate a matching profile.
3.  **Discovery**: Geo-proximity filter queries allow users to search and discover matches within set distance bounds.
4.  **Double Opt-In Control**: Incoming interests are structured. No user can access or view unmasked contact details (emails, phone numbers) or high-definition photos of other profiles unless a mutual match is explicitly accepted by both parties.

---

## 4. Recommended Build Order

To respect strict architecture dependencies, the build sequence is organized across four developmental stages:

```
┌────────────────────────┐      ┌────────────────────────┐
│  Stage 1: Foundation   │ ───► │   Stage 2: Onboard    │
│  - SPIKE-001 (SMS)     │      │   - STORY-006/7/8      │
│  - STORY-001/002/005   │      │   - STORY-011/012      │
└────────────────────────┘      └────────────────────────┘
                                            │
                                            ▼
┌────────────────────────┐      ┌────────────────────────┐
│   Stage 4: Connection  │ ◄─── │    Stage 3: Media      │
│  - STORY-021/022/023   │      │   - STORY-014/015/016  │
│  - STORY-030/031       │      │   - SPIKE-002, 017/018 │
└────────────────────────┘      └────────────────────────┘
```

*   **Stage 1: Foundation (Sprint 1)**: Complete verification spikes (`SPIKE-001`) and establish the secure authentication endpoints and token mechanics (`STORY-001`, `STORY-002`, `STORY-004`, `STORY-005`).
*   **Stage 2: Onboard & Configuration (Sprint 2)**: Create the profile wizard forms (`STORY-006`, `STORY-007`, `STORY-008`), configuration sliders (`STORY-011`, `STORY-012`), and analytics drop-off trackers (`RISK-001`).
*   **Stage 3: Media & Discovery (Sprint 3)**: Build the secure S3 upload pathways (`STORY-014`, `STORY-015`), index sync adapters (`SPIKE-002`, `STORY-013`, `STORY-018`), and the main matching cards grid (`STORY-016`, `STORY-017`).
*   **Stage 4: Connection & Privacy Gates (Sprint 4)**: Implement interest dispatch operations (`STORY-021`, `STORY-022`, `STORY-023`, `STORY-024`), dynamic CDN blurring middleware (`STORY-030`), and server-side contact detail masking (`STORY-031`, `RISK-002`).

---

## 5. Risks to MVP Delivery

*   **SMS Gateway Latency & Deliverability (High Risk)**: High OTP delivery latency (> 5 seconds) during registration onboarding directly results in sign-up drop-offs.
    *   *Mitigation*: Execute `SPIKE-001` in Week 1 to secure twilio/AWS SNS integrations and establish a fast fallback path.
*   **Elasticsearch Performance Hotspots (Medium Risk)**: Heavy geofencing matching computations combined with rapid preference modifications can choke index query buffers.
    *   *Mitigation*: Execute `SPIKE-002` to validate query speed early and run performance validation checks on geofenced filters.
*   **Third-party CDN Image Blurring Lag (Medium Risk)**: Dynamically rendering blurred photo versions for unmatched users can introduce processing delay on profiles list retrieval.
    *   *Mitigation*: Implement pre-blurred low-resolution assets at upload time rather than performing real-time image processing operations on HTTP request interception middleware.
