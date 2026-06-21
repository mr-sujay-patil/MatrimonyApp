# Implementation Planning — Matrimony Platform

**Version**: 1.0
**Status**: Approved
**Target MVP Delivery**: 12 Weeks (6 Sprints × 2 Weeks)
**Sprint Velocity Assumption**: 40 story points per sprint (full team)
**Methodology**: Agile / Scrum with Trunk-Based Development

---

## Table of Contents

1. [Delivery Strategy](#1-delivery-strategy)
2. [Development Phases](#2-development-phases)
3. [Sprint Plan](#3-sprint-plan)
4. [Dependency Matrix](#4-dependency-matrix)
5. [Team Allocation](#5-team-allocation)
6. [MVP Definition](#6-mvp-definition)
7. [Release Readiness Checklist](#7-release-readiness-checklist)

---

## 1. Delivery Strategy

### 1.1 Guiding Principles

| Principle | Decision |
| :--- | :--- |
| **API-First** | Backend API contracts are built and documented before frontend integration begins |
| **Service Independence** | Each microservice is developed, tested, and deployed independently |
| **Feature Flags** | All in-progress features are hidden behind flags on trunk — no long-lived branches |
| **Test-First** | Unit tests and API contract tests are written alongside implementation, not after |
| **Fail Fast** | Spikes run ahead of dependent stories to surface integration risks early |
| **Earliest Delivery** | Critical path (Auth → Profile → Search → Interest) is prioritised in the first 4 sprints |

### 1.2 Build Order Rationale

Services are built in dependency order. No service is implemented before its upstream dependency is complete:

```
Phase 0: Project Foundation (Infra, CI/CD, Design System)
    ↓
Phase 1: Auth Service + Verification Service  [Identity]
    ↓
Phase 2: Profile Service + Media Service  [Profile]
    ↓
Phase 3: Search Service + Matchmaking Service  [Discovery]
    ↓
Phase 4: Interest Service + Notification Service  [Connection]
    ↓
Phase 5: Chat Service  [Communication]
    ↓
Phase 6: Subscription Service + Integration Hardening  [Premium + Release]
```

### 1.3 Delivery Timeline

```
Week 01–02  │ Sprint 1 │ Foundation + Auth + Verification
Week 03–04  │ Sprint 2 │ Profile + Media + Frontend Auth
Week 05–06  │ Sprint 3 │ Search + Matchmaking + Frontend Profile
Week 07–08  │ Sprint 4 │ Interest + Notification + Frontend Discovery
Week 09–10  │ Sprint 5 │ Chat + Subscription + Frontend Connections
Week 11–12  │ Sprint 6 │ Integration + Hardening + Release
```

### 1.4 Story Point Budget

| Sprint | Capacity | Allocated | Buffer |
| :---: | :---: | :---: | :---: |
| Sprint 1 | 40 pts | 37 pts | 3 pts |
| Sprint 2 | 40 pts | 38 pts | 2 pts |
| Sprint 3 | 40 pts | 39 pts | 1 pt |
| Sprint 4 | 40 pts | 39 pts | 1 pt |
| Sprint 5 | 40 pts | 38 pts | 2 pts |
| Sprint 6 | 40 pts | 33 pts | 7 pts |
| **Total** | **240 pts** | **224 pts** | **16 pts** |

---

## 2. Development Phases

---

### Phase 0 — Project Foundation

**Duration**: Week 1 (Sprint 1, Days 1–3 — parallel with Phase 1 kickoff)
**Teams**: Platform, Frontend

#### Objectives
- Establish monorepo structure and service scaffolding
- Configure CI/CD pipelines for all services
- Publish shared development standards
- Provision local development environment (Docker Compose)

#### Deliverables

| # | Deliverable | Owner |
| :--- | :--- | :--- |
| P0-1 | Monorepo initialized (`/services/*`, `/frontend`, `/infrastructure`) | Platform |
| P0-2 | Docker Compose local stack (PostgreSQL, MongoDB, Redis, RabbitMQ, Elasticsearch) | Platform |
| P0-3 | GitHub Actions CI pipeline (lint → unit test → build → image push) | Platform |
| P0-4 | Service scaffolding for all 10 microservices | Backend |
| P0-5 | Shared design tokens and Neumorphic component library initialized | Frontend |
| P0-6 | API contract test framework configured (Pact / REST Assured) | QA |
| P0-7 | Database migration tooling configured per service | Backend |
| P0-8 | Coding standards doc (linting rules, naming, error handling, logging) | Backend |

#### Dependencies
- None — this phase is the foundation for all subsequent phases.

#### Risks

| Risk | Likelihood | Impact | Mitigation |
| :--- | :---: | :---: | :--- |
| Docker Compose setup varies across developer machines | Medium | Medium | Provide canonical `.devcontainer` configuration |
| Design token naming disagreements | Low | Low | Adopt design token spec during Phase 0 — no exceptions |

#### Exit Criteria
- [ ] All 10 service repositories scaffold and compile with zero errors
- [ ] Docker Compose `up` starts all infrastructure services without manual intervention
- [ ] CI pipeline runs successfully on every PR
- [ ] Design system renders in Storybook with at least 3 Neumorphic base components

---

### Phase 1 — Identity Foundation

**Duration**: Sprint 1 (Weeks 1–2)
**Services**: Auth Service, Verification Service
**Teams**: Backend, Platform, QA

#### Objectives
- Implement complete user registration and login flows
- Issue and validate JWT access/refresh tokens
- Enforce OTP brute-force lockout
- All identity APIs passing contract tests

#### Deliverables

| Story | Title | Points |
| :--- | :--- | :---: |
| SPIKE-001 | SMS OTP Gateway Verification Integration Path | 2 |
| STORY-001 | Mobile OTP Request UI & API Flow | 5 |
| STORY-002 | OTP Verification & Token Emission | 5 |
| STORY-003 | Email Magic Link Login | 3 |
| STORY-004 | Session Management & Silent Refresh Tokens | 3 |
| STORY-005 | OTP Lockout Brute Force Prevention | 3 |

**Phase 1 Total**: 21 points

#### Dependencies
- Phase 0 complete: Service scaffolding, CI pipeline, Docker Compose stack
- Redis available for OTP TTL and token blocklist
- PostgreSQL `matrimony_auth` database migrated

#### Risks

| Risk | Likelihood | Impact | Mitigation |
| :--- | :---: | :---: | :--- |
| SMS gateway sandbox latency > 2 sec | Medium | High | SPIKE-001 must complete in Day 1–2 of Sprint 1 |
| JWT secret rotation complexity | Low | High | Use environment-scoped secrets; no rotation in MVP |

#### Exit Criteria
- [ ] `POST /api/v1/auth/register` returns `201` with user record
- [ ] OTP issued, stored in Redis, and delivered via SMS adapter (mock in dev)
- [ ] OTP verification returns JWT access token and sets httpOnly refresh cookie
- [ ] 3 consecutive failed OTPs trigger 1-hour lockout (`423`)
- [ ] Token refresh flow succeeds silently without user re-login
- [ ] All 6 Auth endpoints pass API contract tests

---

### Phase 2 — Profile Foundation

**Duration**: Sprint 2 (Weeks 3–4)
**Services**: Profile Service, Media Service
**Teams**: All 4 teams

#### Objectives
- Implement multi-step onboarding wizard (frontend)
- Persist all profile data to `matrimony_profile` database
- Enable photo upload via S3 presigned URLs
- Profile completion calculator operational

#### Deliverables

| Story | Title | Points |
| :--- | :--- | :---: |
| STORY-006 | Personal Details Onboarding Form | 5 |
| STORY-007 | Family Background Information Step | 3 |
| STORY-008 | Career, Education & Lifestyle Form | 3 |
| STORY-009 | Profile Completion Checklist UI | 3 |
| STORY-010 | Profile Editor Dashboard Settings | 5 |
| STORY-011 | Partner Preference Slider & Multi-Select UI | 3 |
| STORY-012 | Partner Preference Server Validation & Defaults | 2 |
| STORY-013 | Preferences–Search Index Integration | 3 |
| STORY-014 | Multi-Photo File Drag & Drop Component | 5 |
| STORY-015 | Secure S3 Upload & Signed URL Logic | 5 |
| STORY-016 | Avatar Setting & Photo Visibility Controls | 3 |
| RISK-001 | Risk Mitigation: High Onboarding Drop-Off Rate | 3 |

**Phase 2 Total**: 43 points (split across Sprint 2 and early Sprint 3)

#### Dependencies
- Phase 1 complete: Auth tokens required to authorize all profile API calls
- S3 bucket provisioned and IAM role configured
- `matrimony_profile` and `matrimony_media` databases migrated

#### Risks

| Risk | Likelihood | Impact | Mitigation |
| :--- | :---: | :---: | :--- |
| S3 CORS configuration blocking frontend direct uploads | Medium | High | Platform configures and tests CORS in Phase 0 |
| Onboarding wizard state management complexity | Medium | Medium | Use React Query + Zustand; wizard state persisted server-side on each step |

#### Exit Criteria
- [ ] Full onboarding wizard (3 steps) persists to `profiles` table
- [ ] `GET /api/v1/profiles/me` returns complete profile with all sections
- [ ] Photo upload succeeds via S3 presigned URL; metadata stored in `photos` table
- [ ] Profile completion percentage updates dynamically after each step
- [ ] Partner preferences saved and validated server-side
- [ ] Onboarding analytics events firing (`RISK-001`)

---

### Phase 3 — Discovery Foundation

**Duration**: Sprint 3 (Weeks 5–6)
**Services**: Search Service, Matchmaking Service
**Teams**: All 4 teams

#### Objectives
- Elasticsearch index populated from Profile events
- Search filters operational (age, location, religion, geo-proximity)
- Daily recommendation engine producing 10 matches per user
- Inactive profile exclusion running

#### Deliverables

| Story | Title | Points |
| :--- | :--- | :---: |
| SPIKE-002 | Spike: Elasticsearch Geofenced Matches Indexing | 3 |
| STORY-017 | Match Discovery Sidebar & Card Grid UI | 5 |
| STORY-018 | Elasticsearch Geo-Location & Filter Sync | 5 |
| STORY-019 | Daily Recommended Matches Engine | 3 |
| STORY-020 | Inactive Profile Search Exclusions | 3 |

**Phase 3 Total**: 19 points

#### Dependencies
- Phase 2 complete: Active profiles required to populate search index
- Elasticsearch cluster running and `matrimony_search_profiles` index created
- RabbitMQ `ProfileCreated`, `ProfileUpdated` events flowing from Profile Service

#### Risks

| Risk | Likelihood | Impact | Mitigation |
| :--- | :---: | :---: | :--- |
| Elasticsearch geo_point mapping errors in index | Medium | High | SPIKE-002 must complete before STORY-018 begins |
| Low initial data volume for recommendations testing | High | Medium | Seed dev environment with 200+ synthetic profiles |

#### Exit Criteria
- [ ] Profile created event triggers Elasticsearch document insertion
- [ ] `GET /api/v1/search/profiles?age_min=24&age_max=30&city=Mumbai` returns filtered results
- [ ] Geo-proximity filter (`radius_km`) returns profiles within specified distance
- [ ] Daily cron generates 10 recommendation profiles per active user
- [ ] Suspended/hidden profiles absent from all search results

---

### Phase 4 — Connection Foundation

**Duration**: Sprint 4 (Weeks 7–8)
**Services**: Interest Service, Notification Service
**Teams**: All 4 teams

#### Objectives
- Seekers can express, accept, and decline interest
- Double opt-in logic creates Match records
- In-app notification center live
- Push notification dispatcher wired to RabbitMQ events

#### Deliverables

| Story | Title | Points |
| :--- | :--- | :---: |
| STORY-021 | Send Connection Interest Button | 5 |
| STORY-022 | Accept & Decline Connection Action Flows | 5 |
| STORY-023 | Connection Inbox Dashboard View | 3 |
| STORY-024 | Duplicate Interest Prevention Engine | 3 |
| STORY-025 | In-App Notification Center UI | 5 |
| STORY-026 | Push Notification Dispatcher Integration | 3 |
| STORY-029 | Profile Visibility Search Settings | 3 |
| STORY-030 | Photo Blurring Visibility Middleware | 5 |
| STORY-031 | Server-Side API Contact Details Masking | 3 |

**Phase 4 Total**: 35 points

#### Dependencies
- Phase 3 complete: Profiles must be searchable before interest can be expressed
- Matchmaking Service available to create `Match` record on `InterestAccepted`
- Notification Service consuming RabbitMQ events
- FCM/APNS push credentials provisioned

#### Risks

| Risk | Likelihood | Impact | Mitigation |
| :--- | :---: | :---: | :--- |
| Race condition on simultaneous interest from both sides | Medium | Medium | DB unique constraint `uq_interests_sender_receiver` handles this |
| Image blurring performance overhead | Low | Medium | Pre-generate blurred CDN variants at upload time (Phase 2 extension) |

#### Exit Criteria
- [ ] `POST /api/v1/interests` creates interest record and triggers `InterestSent` event
- [ ] `PATCH /api/v1/interests/{id}/accept` transitions interest → triggers `MatchCreated`
- [ ] Duplicate interest returns `409 CONFLICT`
- [ ] Notification bell shows unread count badge in UI
- [ ] Non-matched profiles return blurred photo URLs
- [ ] Contact details masked in API response for non-matched profiles

---

### Phase 5 — Communication Foundation

**Duration**: Sprint 5 (Weeks 9–10)
**Services**: Chat Service, Subscription Service
**Teams**: All 4 teams

#### Objectives
- Real-time messaging available between matched seekers
- Contact pattern detection blocking phone/email sharing
- Subscription plan catalogue live
- Payment integration functional for Premium tier

#### Deliverables

| Story | Title | Points |
| :--- | :--- | :---: |
| STORY-027 | Daily Email Digest Scheduler | 2 |
| STORY-028 | Active Chat Notification Suppression | 1 |
| RISK-002 | Risk: Chat Platform Bypass Checks | 3 |
| Chat conversations | Conversation list + WebSocket messaging (from Chat Service) | 8 |
| Subscription plans | Plan catalogue + Subscribe + Cancel (from Subscription Service) | 8 |

**Phase 5 Total**: 22 points (plus integration testing capacity)

#### Dependencies
- Phase 4 complete: `MatchCreated` event triggers `InitializeConversation` in Chat Service
- MongoDB `matrimony_chat` database operational
- WebSocket infrastructure configured in API Gateway
- Stripe/Razorpay sandbox credentials provisioned

#### Risks

| Risk | Likelihood | Impact | Mitigation |
| :--- | :---: | :---: | :--- |
| WebSocket connection management complexity | Medium | High | Use Socket.IO with Redis pub/sub adapter for horizontal scaling |
| Payment gateway sandbox approval delays | Low | High | Begin Stripe sandbox application in Sprint 3 |

#### Exit Criteria
- [ ] `InterestAccepted` event auto-creates conversation in MongoDB
- [ ] WebSocket delivers messages in real-time between matched participants
- [ ] Message containing phone number pattern is blocked and replaced with warning
- [ ] Chat notification suppressed when user is viewing active conversation
- [ ] Subscription plans rendered in UI from `GET /api/v1/subscriptions/plans`
- [ ] Successful payment activates `PREMIUM_BASIC` tier and issues `SubscriptionActivated` event

---

### Phase 6 — Integration Hardening & Release

**Duration**: Sprint 6 (Weeks 11–12)
**Services**: All services
**Teams**: All 4 teams

#### Objectives
- Full end-to-end user journey working across all services
- All contract tests passing
- Performance baselines validated
- Monitoring and alerting operational
- Release readiness checklist fully satisfied

#### Deliverables

| # | Task | Owner |
| :--- | :--- | :--- |
| H-1 | E2E test suite covering all 6 critical user journeys | QA |
| H-2 | Load test: 100 concurrent search requests < 150ms p95 | Platform |
| H-3 | API contract test suite: all 38 endpoints validated | QA |
| H-4 | Observability stack live (logs, metrics, traces) | Platform |
| H-5 | Security audit: JWT validation, rate limit, masking checks | Backend |
| H-6 | Data retention cron jobs configured and verified | Backend |
| H-7 | Runbook written for all services (startup, restart, rollback) | Platform |
| H-8 | Smoke test suite (12 critical API paths) | QA |
| H-9 | Production environment parity verified | Platform |
| H-10 | Go/no-go decision meeting with stakeholders | PM |

#### Exit Criteria
See [Section 7 — Release Readiness Checklist](#7-release-readiness-checklist).

---

## 3. Sprint Plan

---

### Sprint 1 — Identity Foundation
**Dates**: Week 1–2 | **Capacity**: 40 pts | **Allocated**: 37 pts

| Story ID | Title | Points | Team | Priority |
| :--- | :--- | :---: | :---: | :---: |
| SPIKE-001 | SMS OTP Gateway Integration Path | 2 | Backend | 🔴 Critical |
| P0 | Repo scaffold, CI/CD, Docker Compose, standards | 10 | Platform | 🔴 Critical |
| P0-FE | Design system tokens + Neumorphic base components | 8 | Frontend | 🟠 High |
| STORY-001 | Mobile OTP Request UI & API Flow | 5 | Full-Stack | 🔴 Critical |
| STORY-002 | OTP Verification & Token Emission | 5 | Backend | 🔴 Critical |
| STORY-004 | Session Management & Silent Refresh | 3 | Backend | 🟠 High |
| STORY-005 | OTP Lockout Brute Force Prevention | 3 | Backend | 🟠 High |
| QA-1 | API contract test scaffold (Pact setup) | 1 | QA | 🟡 Medium |

**Sprint 1 Goal**: *Engineering team can register an account, receive an OTP via SMS, and obtain a JWT token — end-to-end, in the local Docker Compose environment.*

**Carry-forward**: STORY-003 (Email Magic Link — 3 pts) deferred to Sprint 2 opening days.

---

### Sprint 2 — Profile & Media Foundation
**Dates**: Week 3–4 | **Capacity**: 40 pts | **Allocated**: 38 pts

| Story ID | Title | Points | Team | Priority |
| :--- | :--- | :---: | :---: | :---: |
| STORY-003 | Email Magic Link Login | 3 | Backend | 🟠 High |
| STORY-006 | Personal Details Onboarding Form | 5 | Frontend | 🔴 Critical |
| STORY-007 | Family Background Information Step | 3 | Frontend | 🔴 Critical |
| STORY-008 | Career, Education & Lifestyle Form | 3 | Frontend | 🔴 Critical |
| STORY-009 | Profile Completion Checklist UI | 3 | Frontend | 🟠 High |
| STORY-010 | Profile Editor Dashboard | 5 | Full-Stack | 🟠 High |
| STORY-014 | Multi-Photo Drag & Drop Component | 5 | Frontend | 🟠 High |
| STORY-015 | Secure S3 Upload & Signed URL Logic | 5 | Backend | 🟠 High |
| RISK-001 | Onboarding Analytics Events | 3 | Full-Stack | 🟠 High |
| QA-2 | Contract tests: Auth + Profile endpoints | 3 | QA | 🟡 Medium |

**Sprint 2 Goal**: *A verified user can complete the 3-step onboarding wizard, upload a profile photo, and view their completed profile page.*

---

### Sprint 3 — Discovery Foundation
**Dates**: Week 5–6 | **Capacity**: 40 pts | **Allocated**: 39 pts

| Story ID | Title | Points | Team | Priority |
| :--- | :--- | :---: | :---: | :---: |
| STORY-011 | Partner Preference Slider & Multi-Select UI | 3 | Frontend | 🟠 High |
| STORY-012 | Partner Preference Validation & Defaults | 2 | Backend | 🟠 High |
| STORY-013 | Preferences–Search Index Integration | 3 | Backend | 🟠 High |
| STORY-016 | Avatar & Photo Visibility Controls | 3 | Full-Stack | 🟠 High |
| SPIKE-002 | Elasticsearch Geofenced Indexing Spike | 3 | Backend | 🔴 Critical |
| STORY-017 | Match Discovery Sidebar & Card Grid UI | 5 | Frontend | 🔴 Critical |
| STORY-018 | Elasticsearch Geo-Location & Filter Sync | 5 | Backend | 🔴 Critical |
| STORY-019 | Daily Recommended Matches Engine | 3 | Backend | 🟠 High |
| STORY-020 | Inactive Profile Search Exclusions | 3 | Backend | 🟡 Medium |
| QA-3 | Contract tests: Profile, Media, Search endpoints | 3 | QA | 🟡 Medium |
| QA-4 | Seed 200+ synthetic profiles for search testing | 6 | QA | 🟡 Medium |

**Sprint 3 Goal**: *A logged-in user can search for profiles by age, religion, and city, see geo-filtered results, and view 10 daily recommendations.*

---

### Sprint 4 — Connection Foundation
**Dates**: Week 7–8 | **Capacity**: 40 pts | **Allocated**: 39 pts

| Story ID | Title | Points | Team | Priority |
| :--- | :--- | :---: | :---: | :---: |
| STORY-021 | Send Connection Interest Button | 5 | Full-Stack | 🔴 Critical |
| STORY-022 | Accept & Decline Connection Action Flows | 5 | Full-Stack | 🔴 Critical |
| STORY-023 | Connection Inbox Dashboard View | 3 | Frontend | 🔴 Critical |
| STORY-024 | Duplicate Interest Prevention Engine | 3 | Backend | 🟠 High |
| STORY-025 | In-App Notification Center UI | 5 | Frontend | 🟠 High |
| STORY-026 | Push Notification Dispatcher Integration | 3 | Backend | 🟡 Medium |
| STORY-029 | Profile Visibility Search Settings | 3 | Full-Stack | 🟠 High |
| STORY-030 | Photo Blurring Visibility Middleware | 5 | Backend | 🔴 Critical |
| STORY-031 | Server-Side API Contact Details Masking | 3 | Backend | 🔴 Critical |
| QA-5 | Contract tests: Interest + Notification endpoints | 4 | QA | 🟠 High |

**Sprint 4 Goal**: *Two seekers can exchange interest, one accepts, a match is created, and both receive in-app notifications — with blurred photos and masked contacts for unmatched profiles.*

---

### Sprint 5 — Communication & Premium Foundation
**Dates**: Week 9–10 | **Capacity**: 40 pts | **Allocated**: 38 pts

| Story ID | Title | Points | Team | Priority |
| :--- | :--- | :---: | :---: | :---: |
| Chat-1 | Chat Service: Conversation API + MongoDB setup | 5 | Backend | 🔴 Critical |
| Chat-2 | Chat Service: WebSocket send/receive + history | 8 | Full-Stack | 🔴 Critical |
| RISK-002 | Chat Contact Pattern Detection & Masking | 3 | Backend | 🔴 Critical |
| STORY-027 | Daily Email Digest Scheduler | 2 | Backend | 🟡 Medium |
| STORY-028 | Active Chat Notification Suppression | 1 | Frontend | 🟡 Medium |
| Sub-1 | Subscription Service: Plans API + DB setup | 3 | Backend | 🟠 High |
| Sub-2 | Subscription Service: Stripe integration + Subscribe | 5 | Backend | 🟠 High |
| Sub-3 | Subscription UI: Plan selection & upgrade flow | 5 | Frontend | 🟠 High |
| QA-6 | Contract tests: Chat + Subscription endpoints | 4 | QA | 🟠 High |
| QA-7 | WebSocket integration test harness | 2 | QA | 🟠 High |

**Sprint 5 Goal**: *Matched seekers can chat in real-time; phone number patterns are blocked; users can upgrade to Premium Basic via Stripe payment.*

---

### Sprint 6 — Integration, Hardening & Release
**Dates**: Week 11–12 | **Capacity**: 40 pts | **Allocated**: 33 pts (buffer for fixes)

| Task | Description | Points | Team |
| :--- | :--- | :---: | :---: |
| E2E-1 | E2E test: Register → Verify → Profile → Search → Interest → Match | 5 | QA |
| E2E-2 | E2E test: Match → Chat → Message → Notification | 3 | QA |
| E2E-3 | E2E test: Subscribe → Feature gate validation | 2 | QA |
| PERF-1 | Load test: 100 concurrent search requests | 3 | Platform |
| PERF-2 | Load test: 500 concurrent WebSocket connections | 3 | Platform |
| OPS-1 | Observability: structured logging + metrics + tracing | 4 | Platform |
| OPS-2 | Alerting rules: error rate > 1%, p95 > 500ms | 2 | Platform |
| OPS-3 | Runbooks written for all 10 services | 3 | Platform |
| SEC-1 | Security review: JWT, rate limits, masking, S3 ACLs | 3 | Backend |
| REL-1 | Smoke test suite (12 critical paths) | 2 | QA |
| REL-2 | Go/no-go review and stakeholder sign-off | 3 | PM |

**Sprint 6 Goal**: *All systems are production-ready with passing E2E tests, performance baselines met, observability operational, and go/no-go approved.*

---

## 4. Dependency Matrix

### 4.1 Story Dependencies

| Story | Depends On | Relationship |
| :--- | :--- | :--- |
| STORY-006 | STORY-002 | Profile wizard requires authenticated session |
| STORY-007 | STORY-006 | Step 2 follows Step 1 |
| STORY-008 | STORY-007 | Step 3 follows Step 2 |
| STORY-010 | STORY-008 | Profile editor requires completed wizard |
| STORY-013 | STORY-011 | Preferences sync requires preferences saved |
| STORY-015 | STORY-014 | S3 backend required before upload UI |
| STORY-016 | STORY-015 | Visibility controls require uploaded photos |
| STORY-018 | STORY-017 | Search backend required before search UI |
| STORY-022 | STORY-021 | Accept/Decline requires interest to exist |
| STORY-023 | STORY-022 | Inbox requires accept/decline to be functional |
| STORY-026 | STORY-025 | Push dispatcher requires in-app center live |
| STORY-030 | STORY-016 | Photo blurring uses photo visibility metadata |
| STORY-031 | STORY-030 | Contact masking is a superset of photo blurring |

### 4.2 Service Dependencies

| Downstream Service | Depends On | Reason |
| :--- | :--- | :--- |
| Profile Service | Auth Service | JWT token validation on all profile APIs |
| Media Service | Auth Service | JWT token validation on all media APIs |
| Search Service | Profile Service (events) | Elasticsearch index populated via `ProfileCreated` events |
| Matchmaking Service | Profile Service (events) | Compatibility scores need profile data |
| Interest Service | Profile Service | Receiver profile must be ACTIVE to accept interest |
| Matchmaking Service | Interest Service (events) | Match created on `InterestAccepted` event |
| Chat Service | Matchmaking Service (events) | Conversation initialized on `MatchCreated` event |
| Notification Service | All services (events) | Dispatches alerts from all platform events |
| Subscription Service | Auth Service | JWT token validation + tier update via `SubscriptionActivated` event |

### 4.3 Infrastructure Dependencies

| Deliverable | Required Before |
| :--- | :--- |
| PostgreSQL `matrimony_auth` migrated | STORY-001, STORY-002 |
| Redis provisioned | STORY-001 (OTP TTL), STORY-004 (token blocklist) |
| PostgreSQL `matrimony_profile` migrated | STORY-006 |
| AWS S3 bucket + IAM policy | STORY-015 |
| Elasticsearch index created | STORY-018 |
| RabbitMQ exchanges and queues declared | STORY-013 (preferences sync event) |
| MongoDB `matrimony_chat` provisioned | Chat-1 |
| FCM/APNS credentials | STORY-026 |
| Stripe sandbox account | Sub-2 |

### 4.4 Release Dependencies

| Release Gate | Prerequisite |
| :--- | :--- |
| Phase 1 → Phase 2 | Auth APIs passing all contract tests |
| Phase 2 → Phase 3 | Profile creation E2E passing; S3 upload working |
| Phase 3 → Phase 4 | Search returning geo-filtered results within 150ms p95 |
| Phase 4 → Phase 5 | Match creation end-to-end working; privacy controls active |
| Phase 5 → Phase 6 | Real-time messaging working; Stripe payment integration tested |
| Phase 6 → Go-Live | All items in Section 7 Release Readiness Checklist ✅ |

---

## 5. Team Allocation

### 5.1 Workstreams

| Workstream | Size | Scope | Lead |
| :--- | :---: | :--- | :--- |
| **Backend** | 2 engineers | Microservices, APIs, event consumers, domain logic | Lead Backend Developer |
| **Frontend** | 1 engineer | React SPA, Neumorphic design system, state management | Lead Frontend Developer |
| **Platform** | 1 engineer | CI/CD, Docker, infrastructure, observability, deployments | DevOps Engineer |
| **QA** | 1 engineer | API contract tests, E2E tests, load tests, smoke tests | QA Engineer |

### 5.2 Sprint-by-Sprint Team Focus

| Sprint | Backend | Frontend | Platform | QA |
| :---: | :--- | :--- | :--- | :--- |
| Sprint 1 | Auth Service, OTP, JWT, lockout | Design system, OTP UI | Repo, CI/CD, Docker | Contract test scaffold |
| Sprint 2 | Profile APIs, Media/S3, Preferences backend | Onboarding wizard, photo uploader, profile editor | S3 bucket, Elasticsearch setup | Auth + Profile contract tests |
| Sprint 3 | Search Service, Elasticsearch queries, Matchmaking cron | Match browse UI, preference sliders | RabbitMQ config, Elasticsearch tuning | Synthetic data seeding, Search tests |
| Sprint 4 | Interest Service, Notification Service, privacy middleware | Interest inbox, notification center | FCM credentials, monitoring | Interest + Notification contract tests |
| Sprint 5 | Chat Service, Subscription Service, Stripe | Chat UI, subscription plan UI | WebSocket infra, Stripe webhooks | Chat + Sub contract tests, WS harness |
| Sprint 6 | Security review, bug fixes | Bug fixes, polish | Observability, runbooks, load tests | E2E, smoke tests, performance validation |

### 5.3 Parallelizable Work (Per Sprint)

| Sprint | Parallel Track A | Parallel Track B |
| :---: | :--- | :--- |
| Sprint 1 | Backend: Auth Service APIs | Frontend: Design system + OTP UI screens |
| Sprint 2 | Backend: Profile + Media APIs (write path) | Frontend: Onboarding wizard (3 steps) |
| Sprint 3 | Backend: Elasticsearch query engine | Frontend: Browse/search UI card grid |
| Sprint 4 | Backend: Interest + Notification Service | Frontend: Inbox UI + notification bell |
| Sprint 5 | Backend: Chat WebSocket + Subscription/Stripe | Frontend: Chat UI + plan selection flow |
| Sprint 6 | Platform: Observability + load tests | QA: E2E + smoke tests |

---

## 6. MVP Definition

### 6.1 Must Have — v1.0 (REL-001)

These items are **required** for MVP. If any of these are missing, the release is blocked.

| # | Feature | Story IDs |
| :--- | :--- | :--- |
| M-1 | Phone OTP registration and login | STORY-001, STORY-002 |
| M-2 | OTP brute-force lockout | STORY-005 |
| M-3 | JWT session management + silent refresh | STORY-004 |
| M-4 | Full 3-step profile onboarding wizard | STORY-006, STORY-007, STORY-008 |
| M-5 | Profile editing dashboard | STORY-010 |
| M-6 | Photo upload via S3 (up to 5 photos) | STORY-014, STORY-015 |
| M-7 | Profile search with filters (age, location, religion) | STORY-017, STORY-018 |
| M-8 | Geo-proximity search | STORY-018 |
| M-9 | Send / Accept / Decline Interest | STORY-021, STORY-022 |
| M-10 | Double opt-in match creation | STORY-022 |
| M-11 | Connection inbox (Sent, Received, Accepted) | STORY-023 |
| M-12 | In-app notification center | STORY-025 |
| M-13 | Photo blurring for non-matched profiles | STORY-030 |
| M-14 | Contact details masking for non-matched profiles | STORY-031 |
| M-15 | Profile visibility toggle (public/hidden) | STORY-029 |

### 6.2 Should Have — v1.0 (if sprint capacity allows)

These items are **strongly desired** for v1.0 and should be included if capacity permits.

| # | Feature | Story IDs |
| :--- | :--- | :--- |
| S-1 | Partner preference configuration | STORY-011, STORY-012, STORY-013 |
| S-2 | Daily recommendations (10 per user) | STORY-019 |
| S-3 | Avatar setting + photo visibility | STORY-016 |
| S-4 | Profile completion checklist | STORY-009 |
| S-5 | Push notification dispatcher | STORY-026 |

### 6.3 Could Have — v1.0 (stretch goals)

These are valuable but do not block release.

| # | Feature | Story IDs |
| :--- | :--- | :--- |
| C-1 | Email magic link login | STORY-003 |
| C-2 | Daily email digest | STORY-027 |
| C-3 | Active chat notification suppression | STORY-028 |
| C-4 | Real-time chat between matched seekers | Chat-1, Chat-2 |
| C-5 | Premium subscription (Stripe) | Sub-1, Sub-2, Sub-3 |

### 6.4 Won't Have — v1.0

These items are **explicitly out of scope** for MVP and will not be delivered before launch.

| # | Feature | Reason |
| :--- | :--- | :--- |
| W-1 | Video calls | Infrastructure complexity; deferred to EPIC-004 |
| W-2 | AI matchmaking assistant | Requires ML pipeline; deferred to EPIC-005 |
| W-3 | Social login (Google, Apple) | Authentication scope expansion; post-MVP |
| W-4 | Selfie & Govt ID verification | External KYC vendor integration; deferred to EPIC-004 |
| W-5 | Wedding services marketplace | Ecosystem expansion; EPIC-005 |
| W-6 | Video profiles | EPIC-004 |
| W-7 | Analytics dashboard (admin) | Operations tooling; post-MVP |
| W-8 | Saved searches | EPIC-002 |
| W-9 | Block/report moderation tools | EPIC-002 |

---

## 7. Release Readiness Checklist

All items must be ✅ before the go/no-go decision is approved.

### 7.1 Development Complete Criteria

| # | Criterion | Owner | Status |
| :--- | :--- | :---: | :---: |
| D-1 | All Must Have stories (M-1 → M-15) are merged to trunk | Backend / Frontend | ⬜ |
| D-2 | All Should Have stories (S-1 → S-5) are merged to trunk | Backend / Frontend | ⬜ |
| D-3 | Zero `P0` or `P1` bugs open in the bug tracker | QA | ⬜ |
| D-4 | All database migrations run successfully against staging | Backend | ⬜ |
| D-5 | All 38 API endpoints return expected responses in staging | QA | ⬜ |
| D-6 | Redis OTP TTL, lockout, and rate limit behaviours verified in staging | Backend | ⬜ |
| D-7 | S3 presigned URL upload and CDN delivery verified end-to-end | Backend | ⬜ |
| D-8 | RabbitMQ event flows verified for all 27 events in Event Catalog | Backend | ⬜ |

### 7.2 Testing Complete Criteria

| # | Criterion | Threshold | Owner | Status |
| :--- | :--- | :---: | :---: | :---: |
| T-1 | Unit test coverage — all services | ≥ 80% | Backend | ⬜ |
| T-2 | API contract tests — all 38 endpoints pass | 100% | QA | ⬜ |
| T-3 | E2E test: Registration → OTP → Login | Pass | QA | ⬜ |
| T-4 | E2E test: Onboarding wizard → Profile → Photo upload | Pass | QA | ⬜ |
| T-5 | E2E test: Search → Interest → Match | Pass | QA | ⬜ |
| T-6 | E2E test: Match → Chat → Message | Pass | QA | ⬜ |
| T-7 | E2E test: Subscribe → Feature gate | Pass | QA | ⬜ |
| T-8 | Security test: Photo blur for non-matched | Pass | QA | ⬜ |
| T-9 | Security test: Contact masking for non-matched | Pass | QA | ⬜ |
| T-10 | Security test: OTP lockout after 3 attempts | Pass | QA | ⬜ |
| T-11 | Load test: 100 concurrent search requests | p95 < 150ms | Platform | ⬜ |
| T-12 | Load test: 500 concurrent WebSocket connections | No disconnects | Platform | ⬜ |
| T-13 | Load test: 50 concurrent OTP requests | p95 < 2s | Platform | ⬜ |

### 7.3 Deployment Complete Criteria

| # | Criterion | Owner | Status |
| :--- | :--- | :---: | :---: |
| DP-1 | All 10 services deployed to production environment | Platform | ⬜ |
| DP-2 | All service health checks returning `200 /health` | Platform | ⬜ |
| DP-3 | All database migrations run against production databases | Backend | ⬜ |
| DP-4 | RabbitMQ exchanges and queues declared in production | Platform | ⬜ |
| DP-5 | Elasticsearch index populated with seed data | Backend | ⬜ |
| DP-6 | Redis warmed with rate limit and OTP configuration | Platform | ⬜ |
| DP-7 | CDN configured for S3 media delivery | Platform | ⬜ |
| DP-8 | SSL certificates valid on all endpoints | Platform | ⬜ |
| DP-9 | DNS routing configured for `api.matrimony.app` | Platform | ⬜ |

### 7.4 Observability Criteria

| # | Criterion | Owner | Status |
| :--- | :--- | :---: | :---: |
| O-1 | Structured logs flowing from all 10 services to log aggregator | Platform | ⬜ |
| O-2 | Metrics dashboard: request rate, error rate, p95 latency per service | Platform | ⬜ |
| O-3 | Distributed tracing active (`X-Correlation-ID` tracked end-to-end) | Platform | ⬜ |
| O-4 | Alert rule: error rate > 1% triggers PagerDuty | Platform | ⬜ |
| O-5 | Alert rule: p95 > 500ms triggers PagerDuty | Platform | ⬜ |
| O-6 | Alert rule: RabbitMQ queue depth > 1000 triggers PagerDuty | Platform | ⬜ |

### 7.5 Go-Live Criteria

All of the following must be true before the go-live decision is made:

| # | Criterion | Owner | Status |
| :--- | :--- | :---: | :---: |
| GL-1 | All D-1 → D-8 criteria satisfied | Backend | ⬜ |
| GL-2 | All T-1 → T-13 criteria satisfied | QA | ⬜ |
| GL-3 | All DP-1 → DP-9 criteria satisfied | Platform | ⬜ |
| GL-4 | All O-1 → O-6 criteria satisfied | Platform | ⬜ |
| GL-5 | Smoke test suite (12 critical paths) passes in production | QA | ⬜ |
| GL-6 | Runbook available and reviewed for all 10 services | Platform | ⬜ |
| GL-7 | Rollback plan documented and tested | Platform | ⬜ |
| GL-8 | On-call rotation assigned for launch week | Platform | ⬜ |
| GL-9 | Data privacy notice and terms of service live on platform | PM | ⬜ |
| GL-10 | Stakeholder go/no-go sign-off obtained | PM | ⬜ |

---

## Appendix A — Critical Path

The critical path through the MVP — any delay in these stories delays the release date:

```
SPIKE-001 (Day 1–2)
    → STORY-001 → STORY-002 (Sprint 1)
        → STORY-006 → STORY-007 → STORY-008 (Sprint 2)
            → STORY-015 → STORY-016 (Sprint 2)
                → STORY-018 → STORY-019 (Sprint 3)
                    → STORY-021 → STORY-022 (Sprint 4)
                        → STORY-030 → STORY-031 (Sprint 4)
                            → Chat-1 → Chat-2 (Sprint 5)
                                → E2E-1 → GL-10 (Sprint 6)
```

**Critical path length**: 12 weeks. Any story on this path that slips by more than 3 days must trigger an immediate replanning session.

---

## Appendix B — Completed Architecture Document Index

| Document | Description |
| :--- | :--- |
| [PRD.md](file:///Users/sujaypatil/Documents/Anitgravity/MatrimonyApp/PRD.md) | Product Requirements Document |
| [features.md](file:///Users/sujaypatil/Documents/Anitgravity/MatrimonyApp/features.md) | MVP feature list and release roadmap |
| [backlog.json](file:///Users/sujaypatil/Documents/Anitgravity/MatrimonyApp/backlog.json) | Full backlog hierarchy |
| [Domain Model.md](file:///Users/sujaypatil/Documents/Anitgravity/MatrimonyApp/Domain%20Model.md) | 12 core domain entities |
| [Service Ownership Matrix.md](file:///Users/sujaypatil/Documents/Anitgravity/MatrimonyApp/Service%20Ownership%20Matrix.md) | 10 service boundaries |
| [Event Catalog.md](file:///Users/sujaypatil/Documents/Anitgravity/MatrimonyApp/Event%20Catalog.md) | 27 business events |
| [Architecture Decision Records (ADR).md](file:///Users/sujaypatil/Documents/Anitgravity/MatrimonyApp/Architecture%20Decision%20Records%20%28ADR%29.md) | ADR-001 through ADR-015 |
| [System Context Diagram.md](file:///Users/sujaypatil/Documents/Anitgravity/MatrimonyApp/System%20Context%20Diagram.md) | C4 Level 1 |
| [Container Diagram.md](file:///Users/sujaypatil/Documents/Anitgravity/MatrimonyApp/Container%20Diagram.md) | C4 Level 2 |
| [Component Diagram.md](file:///Users/sujaypatil/Documents/Anitgravity/MatrimonyApp/Component%20Diagram.md) | C4 Level 3 |
| [API Contract Specification.md](file:///Users/sujaypatil/Documents/Anitgravity/MatrimonyApp/API%20Contract%20Specification.md) | 38 endpoint contracts |
| [Database Design.md](file:///Users/sujaypatil/Documents/Anitgravity/MatrimonyApp/Database%20Design.md) | 18 tables/collections |
| [Implementation Planning.md](file:///Users/sujaypatil/Documents/Anitgravity/MatrimonyApp/Implementation%20Planning.md) | This document |
