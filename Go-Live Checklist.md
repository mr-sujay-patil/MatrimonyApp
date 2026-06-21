# Go-Live Checklist

This checklist is the final launch-readiness gate before the production release of the Matrimony Platform. Every item must be objectively verified and checked off before proceeding to the final launch approvals.

---

## 1. Product Readiness

*   [ ] **All MVP Stories Completed**: 100% of the 31 stories defined in the `backlog.json` are marked as complete and merged into the main repository branch.
*   [ ] **Acceptance Criteria Satisfied**: Product Owner (PO) has verified that all stories fulfill their respective backlog acceptance criteria.
*   [ ] **User Journeys Validated**: End-to-end user journeys (Registration, Profile Creation, Interest Flow, Chatting, Subscription upgrade) have been manually walked through and validated by the Product Team.
*   [ ] **Analytics Events Implemented**: Conversion and core business tracking events (e.g., user sign-ups, subscriptions, match creation events) are correctly routed to the event catalog and recorded.
*   [ ] **Product Sign-Off Received**: Formal product management sign-off has been logged in the release control system.

---

## 2. Engineering Readiness

*   [ ] **All Services Deployed**: All 10 microservices are running in the target production environment (Kubernetes namespaces) with passing health checks.
*   [ ] **APIs Validated**: All 38 REST endpoints defined in the API Contract Specification are functional and return standard HTTP status codes.
*   [ ] **Database Migrations Executed**: All PostgreSQL, MongoDB, and Elasticsearch database migration scripts (`V2026*__description.sql`) have run successfully against the production databases.
*   [ ] **Infrastructure Provisioned**: DNS configurations, SSL/TLS certificates, CDN nodes, caching instances (Redis), and message brokers (RabbitMQ) are fully provisioned and validated.
*   [ ] **Performance Targets Achieved**: API latency (p95) is confirmed under 200ms for read actions and under 500ms for write actions under a load profile of 500 requests/sec.
*   [ ] **Technical Debt Reviewed**: A static analysis check confirms zero critical issues or SonarQube quality gate blockers in the production codebase.

---

## 3. Security Readiness

*   [ ] **Authentication Tested**: JWT access token expiration (15 mins) and refresh cookie security properties (HttpOnly, Secure, SameSite=Strict) are validated.
*   [ ] **Authorization Tested**: Cross-tenant data checks verify that users are strictly prevented from viewing or modifying other users' resources (HTTP 403 checks pass).
*   [ ] **PII Protection Validated**: Sensitive database tables (e.g., phone numbers, annual incomes) are verified as encrypted at rest using AES-256 transparent encryption.
*   [ ] **Encryption Validated**: Secure HTTPS connections are enforced throughout the platform (TLS 1.3 protocol active).
*   [ ] **Secrets Management Verified**: Verified that zero application database credentials, payment API keys, or private salts are checked into git code repositories.
*   [ ] **Security Review Completed**: An automated vulnerability scan (OWASP ZAP) has run with zero open critical security issues.

---

## 4. Testing Readiness

*   [ ] **Unit Tests Passing**: Unit tests meet the statement and branch coverage target of **80%** across all services.
*   [ ] **Integration Tests Passing**: Database and RabbitMQ broker integration tests run with a 100% pass rate.
*   [ ] **Contract Tests Passing**: Consumer-driven contract tests verify full API schema compatibility.
*   [ ] **End-to-End Tests Passing**: Automated Playwright E2E suites verify all critical paths without failures.
*   [ ] **Regression Tests Passing**: Core platform operations verify clean of regression defects.
*   [ ] **Performance Tests Passing**: Load, stress, and peak traffic simulations (k6 scripts) verify system stability.

---

## 5. Operations Readiness

*   [ ] **Monitoring Configured**: Prometheus scrape targets are active and monitoring all microservice container instances.
*   [ ] **Alerting Configured**: Critical alarms (e.g., HTTP 5xx errors > 2%) are verified to correctly alert on-call teams via PagerDuty.
*   [ ] **Dashboards Available**: Grafana operational status dashboards (API metrics, DB states, RabbitMQ queue depths) are active.
*   [ ] **Incident Response Documented**: Incident response workflows, SEV classification targets, and escalation lines are finalized.
*   [ ] **Runbooks Approved**: Deployment runbook procedures are reviewed and approved.
*   [ ] **Rollback Tested**: The automated rollback migration script is tested and verified to recover database states in under 10 minutes.

---

## 6. Data Readiness

*   [ ] **Backup Process Verified**: Automated snapshotting scripts for PostgreSQL and MongoDB are active and configure data backups every 5 minutes.
*   [ ] **Restore Process Tested**: Data restore scripts are run in an isolated disaster recovery cluster to ensure backup files are not corrupted.
*   [ ] **Retention Policies Configured**: Data retention rules are active (e.g., log archives rotated, media uploads expired).
*   [ ] **Audit Logging Enabled**: Database modifications, API requests, and administrative actions are logged in the audit trail.

---

## 7. Support Readiness

*   [ ] **Support Process Documented**: Customer service procedures for account, match, and billing inquiries are documented.
*   [ ] **Escalation Matrix Available**: Engineering tier-2 and tier-3 support channels and contact schedules are published.
*   [ ] **Incident Contacts Defined**: On-call support engineers are assigned to the primary launch schedule rotation.
*   [ ] **Customer Communication Templates Prepared**: Email templates for downtime, payment failures, or critical service notices are drafted and ready for distribution.

---

## 8. Compliance Readiness

*   [ ] **Privacy Policy Published**: Platform privacy policy detailing PII data use is visible to users.
*   [ ] **Terms of Service Published**: Matrimony service terms of use are accessible on the frontend landing portals.
*   [ ] **Consent Management Verified**: Mandatory checkboxes for privacy agreement are active on the sign-up page.
*   [ ] **Data Retention Reviewed**: Retention profiles are confirmed to be legally compliant with data storage regulations.

---

## 9. Release Approvals

All stakeholders must sign off before the launch decision is finalized.

*   **Engineering Lead Approval**:
    *   Name/Signature: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
    *   Date: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
*   **QA Lead Approval**:
    *   Name/Signature: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
    *   Date: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
*   **Product Owner Approval**:
    *   Name/Signature: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
    *   Date: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
*   **Operations Lead Approval**:
    *   Name/Signature: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
    *   Date: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
*   **Security Reviewer Approval**:
    *   Name/Signature: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
    *   Date: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

## 10. Launch Decision

*   [ ] **GO (Launch Authorized)**: All checklist steps are completed and all five stakeholder signatures are verified. Switch production routing target weight to 100% active.
*   [ ] **NO-GO (Launch Delayed)**: Checklist items are blocked or open defects violate quality gates. Release candidate is rejected and rolled back to staging.
