# Testing Strategy

This document defines the complete quality assurance strategy for the Matrimony Platform. It establishes mandatory standards, frameworks, quality gates, and specific test scenarios that must be executed and validated before any code is promoted to production.

---

## 1. Quality Principles

*   **Shift Left**: Quality checks must occur as early as possible in the lifecycle. Developers must run local unit and contract checks before code is committed.
*   **Preventative Gates**: Automated quality gates must block pull requests and builds that violate test coverage or static analysis rules.
*   **Deterministic Tests**: Flaky tests are treated as broken builds. Any test that fails intermittently must be disabled and refactored immediately.
*   **Behavior Over Implementation**: Tests must target component behavior, contract fulfillment, and business requirements rather than class internals or private method verification.
*   **Service Isolation**: Backend microservices must be testable in complete isolation using mocked network dependencies and local testcontainers for databases/caches.

---

## 2. Testing Pyramid

The platform's test suite layout is structured to maintain high execution speed, low maintenance costs, and comprehensive coverage.

```
       ▲
      / \      E2E (Playwright) — Critical User Journeys (< 5%)
     /   \
    /     \    Perf & Security (k6, OWASP ZAP) — Load, Stress, Penetration (~ 5%)
   /       \
  /         \  Contract (Pact) — API Contracts & Event Catalog Schema Verification (~ 10%)
 /           \
/             \  Integration (Jest/Go, Testcontainers) — Databases, Broker Adapters (~ 20%)
/_______________\ Unit (Jest/Go) — Core Domain, Use Case Rules, Scenarios (~ 60%)
```

### Unit Testing

*   **Objective**: Validate core business logic, aggregates, entity state transitions, value objects, and application layer use case rules.
*   **Frameworks**: Jest (Node.js/TypeScript services and frontend) / Go `testing` framework (Go services).
*   **Mocking Policy**: Mock only adapters at the service boundaries (infrastructure ports). Mocking domain entities, domain services, or pure logic helpers is forbidden.

### Integration Testing

*   **Objective**: Validate database schema queries, cache access patterns, message broker adapters, and external API client integrations.
*   **Frameworks**: Testcontainers (PostgreSQL, MongoDB, Elasticsearch, Redis) within Jest/Go tests.
*   **Boundary Policy**: Real instances of databases and caches must run locally inside Docker containers via Testcontainers. Mocking SQL client adapters or Redis client methods is prohibited in integration tests.

### Contract Testing

*   **Objective**: Enforce schema compliance across REST endpoints and RabbitMQ message payloads to prevent breaking changes.
*   **Frameworks**: Pact (Consumer-Driven Contract Testing).
*   **Scope**:
    *   **REST APIs**: Frontend and consumer microservices define Pact interactions that backend provider services must fulfill.
    *   **Events**: Validate published RabbitMQ payloads against the `@matrimony/shared-events` schema definitions during CI compilation.

### End-to-End (E2E) Testing

*   **Objective**: Validate the complete user journeys spanning multiple services, databases, and UI interfaces.
*   **Frameworks**: Playwright (TypeScript).
*   **Scope**:
    *   **Registration & Verification Flow**: User creates account, requests OTP, verifies OTP, and successfully logs in.
    *   **Profile Creation Flow**: Complete profile fields, upload images (S3 presigned endpoint validation), and set matching preferences.
    *   **Interest & Match Flow**: User A sends interest, User B accepts interest, verifying that a mutual match is created and both profiles are updated.
    *   **Chat Flow**: Real-time message exchange over WebSockets between matched users, testing message delivery and contact filtering.
    *   **Subscription Flow**: Gated features lock check, trigger checkout flow, complete mock payment, verify upgrade to Premium, and unlock profile views.

### Performance Testing

*   **Objective**: Benchmark API response times, resource utilization, and throughput under load.
*   **Frameworks**: k6 (Javascript/Go-based scripts).
*   **SLA Thresholds**:
    *   **Response Time (p95)**: < 200ms for read endpoints; < 500ms for write operations.
    *   **Throughput**: Minimum 500 requests/sec target for profile query and matchmaking scoring.
    *   **Stress & Scalability**: Test up to 200% predicted peak traffic (10,000 concurrent users) to verify autoscaling policies and database locking thresholds.

### Security Testing

*   **Objective**: Validate authentication, authorization, JWT verification, rate limiting, and PII protection.
*   **Frameworks/Tools**: OWASP ZAP (automated vulnerability scanner), SonarQube (SAST).
*   **Security Controls Verification**:
    *   **JWT Integrity**: Verify signature verification failures, token expiration rejections, and invalid claims handling.
    *   **Authorization Rules**: Verify that a user cannot access or modify another user's profile details (`/api/v1/profile/user-profiles/{otherUserId}` returns HTTP 403).
    *   **Rate Limiting**: Requesting OTPs or registration endpoints beyond limits must return HTTP 429.
    *   **PII Masking**: Ensure that audit trails and logs do not contain raw values of protected fields (e.g., annual income, phone numbers).

### Accessibility Testing

*   **Objective**: Validate WCAG 2.1 Level AA compliance for the frontend client.
*   **Tools**: Playwright Axe core runner, screen reader simulations.
*   **Scope**: Validate keyboard focus states, form labels, aria tags, and high-contrast color choices (compliant with the Neumorphism design system constraints).

---

## 3. Service Test Strategy & Scenarios

### Auth Service

*   **Test Type Focus**: Unit (Token issuance rules), Integration (Redis blacklist adapter), Security (Brute-force verification lockout).
*   **Mandatory Scenarios**:
    1.  Verify JWT access token is signed correctly, expires in 15 minutes, and contains correct claims.
    2.  Verify login fails after 5 consecutive incorrect password attempts, raising a temporary lockout state in Redis.
    3.  Verify token refresh fails when using an expired or blacklisted refresh token.

### Profile Service

*   **Test Type Focus**: Unit (Domain entity business rules), Integration (PostgreSQL table mapping), Contract (Provider endpoints).
*   **Mandatory Scenarios**:
    1.  Verify profile status transitions cleanly: `Draft` -> `PendingVerification` -> `Active` or `Rejected`.
    2.  Verify updating a profile triggers database update of audit fields (`updated_at`, `version`).
    3.  Verify soft delete updates `deleted_at` timestamp and excludes the profile from list queries.

### Search Service

*   **Test Type Focus**: Integration (Elasticsearch index operations, search routing).
*   **Mandatory Scenarios**:
    1.  Verify search filters (caste, religion, income range, location) are mapped to correct Elasticsearch queries.
    2.  Verify profiles marked as `deleted` or `suspended` are excluded from search results.
    3.  Verify search pagination handles bounds offsets correctly without performance degradation.

### Matchmaking Service

*   **Test Type Focus**: Unit (Matching logic algorithms), Performance (High volume compatibility checks).
*   **Mandatory Scenarios**:
    1.  Verify profile matching compatibility scores calculate mathematical preferences accurately based on age ranges, education, and location constraints.
    2.  Verify the matchmaking batch engine handles 10,000 matches concurrently within the designated job window.

### Interest Service

*   **Test Type Focus**: Unit (Interest limit constraints), Integration (Interest status DB persistence).
*   **Mandatory Scenarios**:
    1.  Verify free-tier user is blocked from sending more than 10 interests in a rolling 24-hour window.
    2.  Verify sending interest to a profile that has already received an interest from the same user returns a validation error.
    3.  Verify accepting an interest successfully publishes the `InterestAccepted` business event.

### Chat Service

*   **Test Type Focus**: Integration (MongoDB chat message store), E2E (WebSocket message delivery).
*   **Mandatory Scenarios**:
    1.  Verify messages are blocked unless a mutual match exists between the sender and recipient.
    2.  Verify messages containing phone numbers or email addresses are intercepted and masked by the contact pattern filter before transmission.
    3.  Verify chat pagination uses cursor-based offsets for message retrieval.

### Notification Service

*   **Test Type Focus**: Integration (RabbitMQ event consumer processing, external provider client integrations).
*   **Mandatory Scenarios**:
    1.  Verify event payloads (e.g., `UserRegistered`) are consumed, transformed, and routed to the correct channel (e.g., Email template generator).
    2.  Verify notification templates handle missing data variables gracefully without crashing the delivery worker.
    3.  Verify retry policies are executed (up to 3 times) when the external SMS gateway returns an HTTP 500 error.

### Media Service

*   **Test Type Focus**: Integration (S3 adapter operations), Security (Presigned upload validity).
*   **Mandatory Scenarios**:
    1.  Verify presigned upload URL requests are restricted to JPEG/PNG file types under 5MB.
    2.  Verify public access is blocked on the target S3 bucket, enforcing that files are read only through presigned download paths.

### Verification Service

*   **Test Type Focus**: Unit (OTP generation entropy), Integration (Redis TTL handling).
*   **Mandatory Scenarios**:
    1.  Verify OTP generation yields a random 6-digit numeric string with sufficient entropy.
    2.  Verify OTP tokens expire exactly 5 minutes after creation using Redis TTL verification.
    3.  Verify OTP validation is blocked after 3 incorrect verification attempts.

### Subscription Service

*   **Test Type Focus**: Unit (Feature gating policies), Integration (Stripe webhook processing).
*   **Mandatory Scenarios**:
    1.  Verify active features (e.g., viewing contact details) return `denied` for free-tier profiles and `permitted` for active premium subscribers.
    2.  Verify processing a stripe webhook event `invoice.payment_succeeded` successfully updates the subscription state in PostgreSQL and issues a `PremiumSubscriptionActivated` event.

---

## 4. Coverage Requirements

To maintain strict control over regression risk, the following minimum code coverage thresholds are mandated:

| Test Scope | Coverage Metric | Target Threshold | Scope of Enforcement |
| :--- | :--- | :--- | :--- |
| **Unit Tests** | Statement Coverage | **80%** | Individual microservice codebase |
| **Unit Tests** | Branch Coverage | **80%** | Individual microservice codebase |
| **Integration Tests**| Method Coverage | **90%** | Database repositories & adapters |
| **Contract Tests** | API Endpoint Coverage | **100%** | All exposed endpoints in API Contract Spec |
| **Critical Paths** | End-to-End Scenario | **100%** | Flows listed in Section 2 (E2E Testing) |

---

## 5. Quality Gates

Code must pass through five quality gates before reaching production:

```
[Local Build] ──► [Pull Request] ──► [Sprint End] ──► [Pre-Release] ──► [Production Deploy]
```

### Build Pass Criteria

*   Compilation completes with zero errors.
*   Linting scripts (`npm run lint` or `golangci-lint`) finish with zero warnings or errors.
*   Local unit tests run and pass.

### PR Pass Criteria

*   All unit and integration tests pass in the CI container environment.
*   Code coverage metrics meet the **80%** statement and branch thresholds.
*   Pact contract validation verifies contract integrity.
*   SonarQube static analysis flags zero security hotspots or critical code smells.
*   At least one human review approval is logged on the PR.

### Sprint Completion Criteria

*   All user stories committed in the sprint backlog are completed and integrated.
*   The regression test suite runs against the combined build with a 100% pass rate.
*   No critical or blocker severity defects remain open.

### Release Completion Criteria

*   All planned E2E flows pass on the staging environment.
*   k6 performance benchmarks run and confirm response time SLAs are met.
*   OWASP ZAP scans report zero high-severity security vulnerabilities.

### Production Readiness Criteria

*   Database migration scripts are verified as backward-compatible (zero-downtime path checked).
*   Monitoring dashboards and alert rules are configured and active in the target deployment cluster.
*   Rollback deployment procedures are verified and ready.

---

## 6. Defect Management

### Severity Levels

*   **Severity 1 (Blocker)**: Core platform components are down. Crucial flows (Auth, Match, Interest, Payment) are broken with no workaround.
*   **Severity 2 (Critical)**: Major feature is broken or severely degraded. A workaround exists but is complex and negatively impacts user experience.
*   **Severity 3 (Major)**: A feature is broken but minor. Impacts non-critical workflows (e.g., profile field UI alignment, filter configurations).
*   **Severity 4 (Minor)**: Cosmetic issues, typos, design system inconsistencies, or minor layout errors.

### Priority Levels

*   **Priority 1 (Urgent)**: Fix immediately, blocking release cycles if necessary.
*   **Priority 2 (High)**: Fix within the current sprint window.
*   **Priority 3 (Medium)**: Fix within the subsequent sprint planning lifecycle.
*   **Priority 4 (Low)**: Backlog item to be resolved when resources permit.

### Escalation Rules

*   If a **Severity 1** bug is found in production, an incident response bridge must be opened immediately, and hotfix development must begin.
*   If a **Severity 2** bug remains unresolved for more than 48 hours during active testing, it must be escalated to the engineering lead for prioritization.

### Release Blocking Rules

*   **No Release may occur if**:
    *   There is 1 or more open **Severity 1 (Blocker)** or **Severity 2 (Critical)** issues.
    *   There are more than 5 open **Severity 3 (Major)** issues.

---

## 7. Test Data Strategy

To ensure test validity while preserving data privacy, test data must be segmented.

### Environment Isolation

```
[Development]                   [Staging]                        [Production]
- Local databases (Docker)      - Isolated RDS/DocumentDB        - Live AWS RDS
- Synthetic data only           - Anonymized seed data           - Real user data
- Local mock servers            - Mock third-party API gateways  - Live payment APIs
```

### Seed Data

*   Database migration scripts must include static lookup database seed files (e.g., religions, caste profiles, locations, subscription plans).
*   Seed data is identical across all environments (Dev, Staging, Production).

### Synthetic Data

*   Test suites must generate mock data profiles dynamically during test execution using tools like Faker.
*   Synthetic data profiles must follow realistic constraints (e.g., valid age ranges, realistic matching criteria parameters).

### Privacy Requirements

*   Under no circumstances may production data be copied down to Staging or Development environments without passing through an automated anonymization pipeline that strips out all PII, emails, names, addresses, and phone records.

---

## 8. Release Validation Strategy

Every release candidate candidate must undergo a formal validation sequence before final production deployment.

```
1. Tag Release Candidate (RC) ──► 2. Deploy to Staging ──► 3. Execute Automation 
                                                                 │
4. Production Promotion ◄── 5. Sign-Off Approved ◄── 4. Verify Performance & Security
```

*   **Deployment Validation**: Verify that microservice pods deploy cleanly to the staging Kubernetes cluster and pass standard liveness/readiness health probes.
*   **Automated Smoke Test**: A suite of lightweight verification checks must run within 5 minutes of deployment to ensure routing, databases, and key adapters are functioning.
*   **Regression Suite execution**: Run the full E2E Playwright test suite to verify no legacy features are broken.
*   **Sign-Off**: Staging validation runs are compiled into a release report. Product management and engineering lead signatures are required on the release artifact to authorize the production deployment stage.
