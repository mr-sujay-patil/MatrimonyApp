# Architecture Decision Records (ADR) — Matrimony Platform

This document captures the architectural decisions, context, alternatives considered, and consequences for the Matrimony Platform.

---

## 1. Architecture Principles

Our architecture is guided by the following principles:
1. **Decoupling**: Services are self-contained with independent deployability and domain encapsulation (Database-per-Service).
2. **Privacy by Default**: Sensitive user data is masked, hidden, or blurred at the service boundary until mutual matching conditions are met.
3. **Resiliency**: The system handles service isolation gracefully; transient faults must not degrade the core signup and onboarding experience.
4. **Consistency**: Eventual consistency is accepted for indexing, search updates, and notifications; immediate consistency is preserved for authentication and transaction states.

---

## 2. ADR Catalog

### ADR-001: Microservices Architecture
* **Status**: Accepted
* **Context**: The matrimonial platform is composed of distinct functional domains with varying scaling profiles (e.g. read-heavy search discovery vs. transactional authentication check vs. real-time chat). A monolith limits localized scaling and domain boundaries.
* **Decision**: Implement a decoupled Microservices Architecture. Each service governs a specific domain area and owns its datastore.
* **Alternatives Considered**:
  * *Monolithic Architecture*: Simpler initial deployment, but introduces single-point-of-failure risks and blocks scaling.
  * *Modular Monolith*: Better boundaries, but blocks micro-scaling of specific resource-heavy components (like chat websockets).
* **Consequences**:
  * *Positive*: Independent scaling, isolated domain boundaries, localized fault tolerance.
  * *Negative*: Eventual consistency complexity, higher operations overhead.
  * *Tradeoffs*: Trading deployment simplicity for long-term scalability and domain isolation.

---

### ADR-002: Frontend Technology
* **Status**: Accepted
* **Context**: The client application requires a highly responsive, interactive user experience to render Neumorphic layout interfaces, multi-step onboarding forms, and real-time chat components.
* **Decision**: Use **React + TypeScript + Vite** for a single-page application (SPA).
* **Alternatives Considered**:
  * *Next.js*: Excellent SSR, but adds hosting complexity where a client-side SPA with microservice backends is sufficient.
  * *Vue.js / Svelte*: Valid options, but React has a wider ecosystem for specialized canvas and UI libraries.
* **Consequences**:
  * *Positive*: Type safety, fast hot module reloading, high component reusability.
  * *Negative*: Initial bundle loading latency if not optimized.
  * *Tradeoffs*: Trading SSR SEO advantages for SPA interactive simplicity, as search pages are gated behind user verification anyway.

---

### ADR-003: Backend Technology
* **Status**: Accepted
* **Context**: Microservices backends need to process fast REST/Websocket requests with minimum memory footprints.
* **Decision**: Develop backend services using **TypeScript (Node.js/Express) or Go**.
* **Alternatives Considered**:
  * *Java (Spring Boot)*: Highly mature, but slower startup times and higher memory footings.
  * *Python (Django/FastAPI)*: Excellent for ML, but slower execution paths for high-frequency chat sockets.
* **Consequences**:
  * *Positive*: Fast response latency, light container footprints, quick developer onboarding.
  * *Negative*: Node.js single-thread limits if doing heavy math/processing.
  * *Tradeoffs*: Go for concurrency-critical parts (e.g. Chat/Search), Node.js for rapid schema management (e.g. Profile/Auth).

---

### ADR-004: Database Strategy
* **Status**: Accepted
* **Context**: Relational integrity is needed for account details and profiles, while document storage suits chat histories, and geodistances suit search.
* **Decision**: Implement a **Database-per-Service** strategy, using **PostgreSQL** as the primary datastore for structured services (Auth/Profile).
* **Alternatives Considered**:
  * *Shared Central Database*: Simplifies data joins but violates service boundaries and creates a single point of failure.
  * *NoSQL (MongoDB) globally*: Relational profiles and settings logic becomes complex to validate without schema constraints.
* **Consequences**:
  * *Positive*: Strict data encapsulation, database engine optimized for each service (PostgreSQL for profiles, MongoDB for chat, Elasticsearch for search).
  * *Negative*: Data synchronization must happen via asynchronous events; direct database joins are forbidden.
  * *Tradeoffs*: Eventual consistency complexity is accepted in exchange for strict service boundaries.

---

### ADR-005: Caching Strategy
* **Status**: Accepted
* **Context**: The platform needs fast access to temporary OTP codes (5 min TTL), blacklisted JWTs (15 min TTL), and pre-calculated matchmaking lists to optimize load.
* **Decision**: Use **Redis** as a distributed caching and temporary key-value store.
* **Alternatives Considered**:
  * *Memcached*: Multi-threaded but lacks datatypes and built-in replication controls.
  * *In-Memory Service Cache*: Blocks horizontal scaling since caches are not synchronized across instances.
* **Consequences**:
  * *Positive*: Sub-millisecond read/write latency, built-in key expiry controls, distributed cache sharing.
  * *Negative*: Requires cache invalidation rules and cluster configuration management.
  * *Tradeoffs*: Adding caching infrastructure overhead for high performance.

---

### ADR-006: Messaging Strategy
* **Status**: Accepted
* **Context**: To propagate updates across databases (e.g., updating Search engine when a Profile changes), services must communicate asynchronously.
* **Decision**: Implement an event-driven messaging strategy using **RabbitMQ** as the message broker.
* **Alternatives Considered**:
  * *Apache Kafka*: High throughput, but RabbitMQ is simpler for our routing keys and transactional volume.
  * *REST Polling*: High database load and latency overhead.
* **Consequences**:
  * *Positive*: Asynchronous decoupling, guaranteed delivery queues, topic routing keys.
  * *Negative*: Broker clustering operational cost, message ordering complexities.
  * *Tradeoffs*: Accepting eventual consistency latency for non-blocking service communications.

---

### ADR-007: Authentication Strategy
* **Status**: Accepted
* **Context**: In a microservices mesh, verifying credentials on every service call can cause Gateway bottlenecks.
* **Decision**: Use stateless **JWT (JSON Web Tokens) Bearer Tokens** (15-minute lifespan) paired with **HTTP-Only rotating Refresh Tokens**.
* **Alternatives Considered**:
  * *Stateful Sessions*: Simple deactivation, but requires centralized database lookup for every endpoint call.
  * *OAuth2/OIDC externally*: Increases dependency on external identity providers for local OTP signup flows.
* **Consequences**:
  * *Positive*: Highly scalable, stateless verification at the Gateway, mitigated XSS risk via HTTP-Only cookies.
  * *Negative*: Deactivating a token instantly requires Redis-based JWT blocklist lookups.
  * *Tradeoffs*: Tracking blocked tokens in Redis to preserve instant logouts.

---

### ADR-008: Media Storage Strategy
* **Status**: Accepted
* **Context**: Profile photos must not be publicly accessible via static URLs to prevent scraping and protect user privacy.
* **Decision**: Store photos in **Private S3-compatible Object Storage** and serve them via **CDN presigned URLs** with a maximum 15-minute expiration TTL.
* **Alternatives Considered**:
  * *Local Disk Storage*: Limits container scalability.
  * *Public S3 URLs*: Violates the privacy-by-default requirement.
* **Consequences**:
  * *Positive*: Highly secure media assets, protected against scraping, offloaded client uploads.
  * *Negative*: Generating presigned URLs on every profile query.
  * *Tradeoffs*: Presigned URL generation CPU cost is accepted to guarantee photo privacy.

---

### ADR-009: Search Strategy
* **Status**: Accepted
* **Context**: Proximity geo-searches and filter queries on multiple profile attributes are slow to execute on standard relational tables.
* **Decision**: Use a **Dedicated Search Service** backed by **Elasticsearch** containing denormalized profile structures.
* **Alternatives Considered**:
  * *PostgreSQL PostGIS*: Supports geolocation, but slows down under complex multi-attribute filtering.
  * *MongoDB GeoSpatial*: Slower indexing throughput for real-time text analysis.
* **Consequences**:
  * *Positive*: Sub-150ms search query response times, full-text indexing, geospatial calculation capabilities.
  * *Negative*: Requires synchronization infrastructure (`ProfileUpdated` -> Elasticsearch index).
  * *Tradeoffs*: Relying on eventual sync consistency for search index updates.

---

### ADR-010: Notification Strategy
* **Status**: Accepted
* **Context**: Sending emails, SMS, and push notifications synchronously blocks user request threads when third-party APIs fail.
* **Decision**: Process notifications **Asynchronously** using background queue workers triggered by broker events.
* **Alternatives Considered**:
  * *Synchronous SMS/Email*: Increases API gateway latency and risks thread locks.
* **Consequences**:
  * *Positive*: Zero impact on main API request threads, automated retries for notification delivery failures.
  * *Negative*: Users experience minor delays in receiving notifications under high queue loads.
  * *Tradeoffs*: Eventual notification delivery is accepted to preserve API Gateway speed.

---

### ADR-011: Privacy Strategy
* **Status**: Accepted
* **Context**: Matrimonial seekers require high privacy guarantees; public access to email, phone, and photos must be blocked.
* **Decision**: Enforce **Privacy by Default** by hard-masking contact data at the API Gateway level and rendering pre-blurred placeholder image URLs unless connection status is MATCHED.
* **Alternatives Considered**:
  * *Client-side masking*: Highly insecure; unmasked credentials can be scraped from network payloads.
* **Consequences**:
  * *Positive*: Eliminates scraper bots capability, ensures absolute data privacy.
  * *Negative*: Gateway must execute relationship checks for every profile query.
  * *Tradeoffs*: Minor gateway overhead accepted for security compliance.

---

### ADR-012: Verification Strategy
* **Status**: Accepted
* **Context**: A key PRD requirement is eliminating fake profiles and scams from day one.
* **Decision**: Require **Mandatory Phone OTP & Email Verification** during sign-up. The onboarding wizard is locked until verification succeeds.
* **Alternatives Considered**:
  * *Optional Verification*: Higher signup numbers, but fails OKR targets for profile authenticity.
* **Consequences**:
  * *Positive*: High-intent, authentic user base, reduced spam/scam profiles.
  * *Negative*: Increased user friction during onboarding.
  * *Tradeoffs*: Trading raw user signups count for platform quality and trust.

---

### ADR-013: Service Communication Strategy
* **Status**: Accepted
* **Context**: Coupling microservices via synchronous HTTP endpoints makes the platform vulnerable to cascading failures.
* **Decision**: Implement an **Event-Driven First, API Second** communication design (async broker first, synchronous gRPC/REST for transaction boundaries).
* **Alternatives Considered**:
  * *Synchronous-Only REST*: Simple, but causes tight coupling and cascading timeouts.
* **Consequences**:
  * *Positive*: Highly resilient, decoupled services mesh, offline message processing.
  * *Negative*: Distributed tracing complexity.
  * *Tradeoffs*: Operational complexity accepted for system resilience.

---

### ADR-014: Observability Strategy
* **Status**: Accepted
* **Context**: Debugging transactions across multiple microservices is difficult without tracing.
* **Decision**: Implement centralized logging via **ELK Stack**, metrics via **Prometheus/Grafana**, and request tracing via **OpenTelemetry**.
* **Alternatives Considered**:
  * *Local file logs*: Ineffective for ephemeral Docker containers.
* **Consequences**:
  * *Positive*: Instant diagnostic capability, end-to-end request tracing, visual system dashboards.
  * *Negative*: Observability agents add memory and network overhead.
  * *Tradeoffs*: Overhead is accepted to maintain target SLA compliance.

---

### ADR-015: Deployment Strategy
* **Status**: Accepted
* **Context**: Code deployment must be consistent across Local, Staging, and Production environments.
* **Decision**: Package services into **Docker containers** and deploy them using **Kubernetes horizontal scaling**.
* **Alternatives Considered**:
  * *Virtual Machine deployment*: Inconsistent server states, slower deployment times.
  * *Serverless (FaaS)*: Cold start delays, limits real-time chat websocket connections.
* **Consequences**:
  * *Positive*: Environment parity, automated horizontal auto-scaling (HPA), zero-downtime rolling updates.
  * *Negative*: Kubernetes setup and maintenance overhead.
  * *Tradeoffs*: Standard containerized deployment target.

---

## 3. Decision Matrix

| Service | Datastore | Communication Style | Caching Layer |
| :--- | :--- | :--- | :--- |
| **Auth Service** | PostgreSQL | Synchronous REST / Async Events | Redis (OTP validation) |
| **Profile Service** | PostgreSQL | Synchronous REST / Async Events | None |
| **Search Service** | Elasticsearch | Sync Query Read / Async Consumer | Redis (Hot queries cache) |
| **Matchmaking** | PostgreSQL | Sync gRPC Read / Async Consumer | None |
| **Interest Service**| PostgreSQL | Sync REST / Async Events | None |
| **Chat Service** | MongoDB | Sync REST / WebSocket / Async Events | Redis (Active socket map) |
| **Notification** | Redis Queue | Async Consumer | Redis Queue |
| **Media Service** | S3 / PostgreSQL | Sync REST / Async Events | None |
| **Verification** | PostgreSQL | Sync REST / Async Events | Redis (Lock counters) |
| **Subscription** | PostgreSQL | Sync REST / Async Events | None |

---

## 4. Risks & Tradeoffs

1. **Eventual Consistency Latency**:
   - *Risk*: A profile update (`user.profile.updated`) might take a few hundred milliseconds to sync to Elasticsearch.
   - *Mitigation*: The React UI optimistic rendering updates the user's dashboard immediately while the search index catches up.
2. **Operations Overhead**:
   - *Risk*: Managing PostgreSQL, MongoDB, Elasticsearch, Redis, RabbitMQ, and Docker containers is complex.
   - *Mitigation*: Leverage managed cloud database services (RDS, Redis Enterprise, S3) to offload clustering management.

---

## 5. Future Revisit Decisions

The following architectural conditions will trigger a revisit of these decisions:

* **RabbitMQ to Apache Kafka (ADR-006)**: Revisit if event throughput exceeds 10,000 events/second, or when event playback functionality is required for analytics.
* **Go Migration (ADR-003)**: Revisit TypeScript Node.js backend decisions if request execution times exceed target SLAs (<100ms) under heavy load.
