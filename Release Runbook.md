# Release Runbook

This runbook defines the operational procedures for deploying, monitoring, supporting, and recovering the Matrimony Platform. Operations and Engineering teams must follow these steps for all production deployment activities and incident response management.

---

## 1. Release Principles

*   **Idempotency & Replayability**: Every step in a deployment or rollback script must be idempotent. If a step fails, running the execution command again must recover safely.
*   **Immutable Assets**: Containers built in CI must be tagged with a unique git commit SHA. Container tags must never be overwritten (e.g., do not deploy a generic `latest` tag to production).
*   **Decoupled Schema Changes**: Database schema migrations must be backward-compatible. Deploy database migrations *before* deploying application updates.
*   **Fail-Safe by Default**: If post-deployment validation fails or key business metrics deviate from baselines, the automated rollback sequence triggers immediately.

---

## 2. Release Lifecycle

```
[Development] ──► [QA/UAT] ──► [Staging] ──► [Production]
  (Feature Br.)    (Pre-release)   (Staging RC)    (Blue-Green Route)
```

### Release Classifications

*   **Major**: Core business logic overrides or database architectural updates. Executed during scheduled low-traffic maintenance windows.
*   **Minor**: Standard feature additions or minor API endpoint enhancements. Executed zero-downtime during standard working hours.
*   **Patch**: Bug fixes. Deployed as part of standard daily deployment cycles.
*   **Hotfix**: High-severity production patch. Fast-tracked through bypass approval loops.

### Gate Approvals & Sign-offs

A release candidate (RC) requires four formal digital approvals inside the deployment pipeline tool before it can be unlocked for production promotion:

1.  **Engineering Lead**: Approves code quality, lint compliance, and PR code reviews.
2.  **QA Lead**: Approves contract, integration, and regression test suite logs.
3.  **Product Owner**: Approves UAT visual inspection and MVP feature validation checks.
4.  **Security Officer**: Verifies container security scans report zero CVE vulnerabilities.

---

## 3. Pre-Release Checklist

No release artifact may be promoted to production unless all of the following checklist criteria are verified:

*   [ ] **Code Freeze**: Target branch is frozen; no commits have been pushed to `main` for 6 hours.
*   [ ] **Build Verification**: Target Docker image tags compile and exist in the AWS ECR registry.
*   [ ] **Automated Test Run**: Unit and integration test suites show a 100% pass rate.
*   [ ] **Pact Contract Validation**: Consumer-provider contracts verify successfully.
*   [ ] **Security Audit Check**: SAST and container vulnerability scan logs are clear.
*   [ ] **Migration Dry-Run**: Database schema migration scripts execute successfully against a cloned staging database schema.
*   [ ] **Monitoring Baseline**: Current production metrics are stable, and alerting dashboards report zero active warnings.
*   [ ] **Rollback Automation Verification**: Backup image state references and migration rollback scripts are verified.

---

## 4. Deployment Procedures

Production deployments use a **Blue-Green Deployment** strategy to guarantee zero downtime.

```
       [Traffic Manager / ALB]
               │
       ┌───────┴───────┐
       ▼               ▼
┌─────────────┐ ┌─────────────┐
│ Green (V1)  │ │ Blue (V2)   │  (Deploy V2 here, validate, then route traffic)
│ (Active)    │ │ (In-Active) │
└─────────────┘ └─────────────┘
```

### Step 1: Preparation (T-2 Hours)

1.  Announce the release schedule internally on `#ops-announcements`.
2.  Confirm on-call support engineers are active.
3.  Verify the integrity of target Kubernetes configuration manifests under `infra/k8s/`.

### Step 2: Deployment Execution

1.  **Apply Database Migrations**: Run the database migration job targeting the PostgreSQL instance:
    ```bash
    kubectl apply -f infra/k8s/migrations-job.yaml
    ```
    *Monitor logs. If the migration job fails, halt the release immediately.*
2.  **Deploy Blue Environment (V2)**: Deploy the updated microservices to the inactive (Blue) environment pod namespace:
    ```bash
    kubectl set image deployment/match-service-blue match-service=123456.dkr.ecr.us-east-1.amazonaws.com/match-service:sha-abc1234 -n matrimony-blue
    ```
3.  Verify that all new pods pass liveness and readiness checks:
    ```bash
    kubectl get pods -n matrimony-blue -o jsonpath='{.items[*].status.containerStatuses[*].ready}'
    ```

### Step 3: Validation

1.  Execute the automated smoke test suite targeting the Blue ingress path.
2.  Perform quick manual UAT verification using test accounts pre-configured on the Blue environment.

### Step 4: Routing Promotion

1.  Switch the AWS Application Load Balancer routing target group weight to 100% Blue (V2) and 0% Green (V1).
2.  Keep the Green (V1) pods running at idle state for exactly **60 minutes** to support immediate rollback if required.

### Step 5: Post-Deployment Monitoring

1.  Monitor the API Gateway error rates, latency histograms, and pod resource consumption profiles for 1 hour.
2.  Review business metrics dashboards (registrations, interest creation counts) to verify no drop-off occurs.

### Step 6: Closure & Cleanup

1.  Scale down Green (V1) pods to 0 replicas.
2.  Submit the release completion report to `#ops-announcements`.

---

## 5. Rollback Procedures

### Rollback Triggers

An automated or manual rollback sequence must be executed if any of the following conditions are met within 60 minutes post-release:

*   **API Error Rate**: HTTP 5xx responses exceed **1%** of total traffic for more than 3 consecutive minutes.
*   **Latency**: Service response times (p95) increase by more than **50%** over baseline.
*   **Infrastructure**: Pod crash looping, OOM lockouts, or database connection exhaustion occurs.
*   **Business Impact**: Successful interest creations or message exchanges drop by more than **30%** compared to standard temporal baselines.

### Step-by-Step Rollback Execution

1.  **Route Traffic Back**: Immediately update the AWS Load Balancer target weights to redirect 100% of incoming traffic back to the Green (V1) environment.
2.  **Verify Routing**: Check traffic logs to ensure no requests are entering the Blue (V2) environment.
3.  **Halt Async Workers**: Stop consumer pods processing background events on V2:
    ```bash
    kubectl scale deployment/notification-worker-blue --replicas=0 -n matrimony-blue
    ```
4.  **Database Mitigation**:
    *   *If the migration was backward-compatible (standard)*: Do not revert the schema. Leave it in the forward-compatible state.
    *   *If schema rollback is critical (e.g., data corruption risk)*: Run the specific database recovery procedure:
        ```bash
        # Target specific rollback migration path
        flyway undo -url=jdbc:postgresql://db:5432/matrimony -user=flyway -password=pwd
        ```

### Data Recovery Rules

*   **Loss Prevention**: If user write actions occurred on V2 before traffic was reverted, run the transaction sync script to reconcile difference logs from the V2 transaction log table back into the V1 schema.
*   **Audit Logging**: Do not purge V2 databases immediately. Create a cold snapshot for forensic debugging.

---

## 6. Incident Response

### Severity Levels

*   **SEV-1 (Critical)**: Platform is completely inaccessible. Critical user workflows (Auth, Registration, Payments) are entirely broken with zero workaround.
*   **SEV-2 (High)**: Major features are severely degraded (e.g., search queries failing, chat websocket connections dropping).
*   **SEV-3 (Medium)**: Non-critical services are degraded (e.g., email notification delays, minor UI components missing).
*   **SEV-4 (Low)**: Minor issues, cosmetic glitches, or small delays in analytical reports.

### Response & Escalation Times

| Severity | Target Response | On-call Escalation | Stakeholder Updates | Resolution SLA |
| :--- | :--- | :--- | :--- | :--- |
| **SEV-1** | < 10 mins | Immediate | Every 15 mins | < 2 hours |
| **SEV-2** | < 30 mins | 1 hour | Every 60 mins | < 8 hours |
| **SEV-3** | < 2 hours | 4 hours | At resolution | < 24 hours |
| **SEV-4** | < 24 hours | None | None | Next Sprint |

### Incident Lifecycle Workflow

```
[Detection] ──► [Triage & Classify] ──► [Mitigate / Rollback] ──► [Postmortem]
```

1.  **Detection**: Alert triggers in PagerDuty or an incident is reported via Customer Support.
2.  **Declaration**: On-call engineer declares a SEV incident, creates a dedicated incident channel `#incident-{id}`, and launches a video bridge.
3.  **Mitigation**: Focus on resolving the issue quickly (e.g., rollback deployment, scale up resources, restart crashed service). Do not attempt detailed bug fixing on live systems.
4.  **Resolution**: Confirm the system is stable, metrics are green, and normal operation is restored.
5.  **Postmortem**: Conduct a Blameless Postmortem within 48 hours to document the root cause, timeline, and define preventive action items.

---

## 7. Monitoring & Alerting

The platform is monitored using Prometheus (metrics collection) and Grafana (dashboards).

### Monitoring Targets

*   **Application Health**: Liveness endpoints (`/health/liveness`) mapped to individual pods.
*   **API Health**: Ingress controller response latency metrics, HTTP status codes split by route.
*   **Database Health**: Active connection counts, CPU utilization, replication lag metrics, and query execution times on PostgreSQL and MongoDB.
*   **Broker Health**: RabbitMQ queue depths, unacknowledged message counts, consumer counts, and publish/deliver rates.
*   **Infrastructure Health**: Pod CPU, memory usage, disk read/write throughput, and VPC network saturation stats.
*   **Business Metrics**: Real-time KPI dashboards tracking sign-up conversion metrics, payment volume, active WebSocket counts, and chat throughput.

### Alert Classifications

#### Critical Alerts (Trigger PagerDuty, call on-call engineer)
*   HTTP 5xx API Gateway response rate > 2% for 5 consecutive minutes.
*   PostgreSQL primary CPU utilization > 90% for 10 minutes.
*   RabbitMQ queue length > 10,000 pending messages on core queues (e.g., `notification-queue`).
*   Active WebSocket connections to Chat Service drop by > 50% abruptly.

#### Warning Alerts (Trigger Slack notifications to `#dev-alerts`)
*   HTTP 5xx responses > 0.5% of total traffic.
*   Database CPU utilization > 75%.
*   Memory usage on any microservice pod > 85% limit.
*   Presigned S3 link generation latency > 1.5 seconds.

---

## 8. Disaster Recovery

### Objectives

*   **Recovery Time Objective (RTO)**: Maximum acceptable system downtime.
    *   Target: **1 hour** for critical transactional workloads.
*   **Recovery Point Objective (RPO)**: Maximum acceptable data loss window.
    *   Target: **5 minutes** (data must be recoverable to a point within 5 minutes of a disaster event).

### Backup & Validation Policies

*   **PostgreSQL & MongoDB**: Continuous replication to standby databases in an alternate AWS Availability Zone. Write transaction logs (WAL) are shipped to encrypted S3 storage every 5 minutes.
*   **Backup Verification**: The automated restore script must execute once a week inside an isolated testing environment to verify backup archives are not corrupt and can restore database schemas successfully.

### Regional Failover Plan

If an entire AWS cloud region suffers a catastrophic failure:

1.  Update Cloudflare DNS records to route traffic to the secondary active disaster recovery (DR) cloud region.
2.  Promote the secondary PostgreSQL standby instance in the DR region to primary master state.
3.  Scale the target Kubernetes pods in the DR region to handle incoming production load weights.
4.  Re-initialize background workers to read from the restored RabbitMQ instances.

---

## 9. Communication Plan

### Internal Notifications

*   **Deployments**: Submit message to `#dev-announcements` when a deployment begins and when it completes:
    > 🚀 **Release Deploy Start**: `matrimony-auth-service` v1.2.0 is being deployed to production.
*   **Incidents**: Post incident updates to `#incident-feed` including severity, target impact areas, and active video bridge links.

### External Communication

*   **Incident Notifications**: If a SEV-1 incident lasts longer than 30 minutes, update the public Status Page with:
    > We are experiencing connection issues on the Matrimony Platform. Our engineering teams are actively investigating the issue.
*   **Customer Support Briefings**: Alert support team leads when a major change is deployed that modifies user layouts or registration flows, providing a summary of changes.

---

## 10. Post-Release Validation

Immediately following routing promotion, the deployment engineer must verify the environment:

*   **API Smoke Testing**: Execute standard API requests to confirm endpoints are functional:
    ```bash
    curl -I -X GET https://api.matrimony.com/api/v1/auth/health
    ```
*   **Event Pipeline Verification**: Register a test user profile, then check that the `UserProfileCompleted` event is successfully written to the audit log queue.
*   **WebSocket Verification**: Open a mock chat page and confirm real-time messages route cleanly between test user sessions.
*   **Dashboard Visual Check**: Open the Grafana release dashboard and check the CPU utilization and connection rate graphs, verifying they are stable.
