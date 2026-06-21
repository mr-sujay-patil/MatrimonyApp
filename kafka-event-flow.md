# Kafka Bidirectional Synchronization Event Flow

This document details the configuration and architecture for bidirectional synchronization of Kanban board items with external backlog providers (e.g., Jira, Azure DevOps, or proprietary issue trackers) using Apache Kafka.

---

## 1. System Architecture

Synchronization is completely additive and decoupled from existing file-based operations. 

```
                                      +-------------------------+
                                      |  External Backlog       |
                                      |  Provider (e.g. Jira)   |
                                      +-------------------------+
                                        /                     \
                      [Consume Event]  /                       \  [Publish Event]
                                      v                         v
                       +-------------------+         +-------------------+
                       |    Kafka Topic    |         |    Kafka Topic    |
                       |  "backlog-events" |         |  "backlog-events" |
                       +-------------------+         +-------------------+
                                 |                             ^
                                 | [Consume Event]             | [Publish Event]
                                 v                             |
                       +-------------------+                   |
                       |KafkaConsumerService|                  |
                       +-------------------+                   |
                                 |                             |
                       +-------------------+                   |
                       |  StorySyncService |                   |
                       +-------------------+                   |
                                 |                             |
                       +-------------------+                   |
                       |Save/Update back to|                   |
                       |JSON/YAML/XML files|                   |
                       +-------------------+                   |
                                 |                             |
                       +-------------------+                   |
                       |    server.ts      |-------------------+
                       |  save-file API    | [User board action trigger]
                       +-------------------+
```

---

## 2. Event DTO (Schema Specification)

All backlog events serialized onto the `backlog-events` Kafka topic share the following JSON structure:

```json
{
  "eventId": "3c51f478-f7b6-455b-b9f4-b2588f28fa90",
  "eventType": "STORY_CREATED",
  "projectId": "PROJECT-MATRIMONY",
  "storyId": "MAT-105",
  "timestamp": "2026-06-22T00:52:21Z",
  "payload": {
    "id": "MAT-105",
    "epicId": "EPIC-001",
    "title": "Enable Secure Login via Multi-factor Authentication",
    "description": "Provide secure authentication for all active web users.",
    "businessValue": "High",
    "priority": "High",
    "status": "To Do",
    "storyPoints": 5,
    "assigneeId": "USR-002",
    "reporterId": "USR-001",
    "dueDate": "2026-06-29",
    "labels": ["Security", "Auth"]
  },
  "eventSource": "KANBAN",
  "version": 1
}
```

### Event Payload Formats

* **STORY_CREATED / STORY_UPDATED / STORY_DELETED**:
  The payload is the complete or partial representation of the `ContractStory` object.
* **STORY_MOVED**:
  The payload specifically tracks the column status change to prevent heavy network overhead:
  ```json
  {
    "fromStatus": "To Do",
    "toStatus": "In Progress"
  }
  ```

---

## 3. Prevent Event Loops (Loop Prevention)

To prevent cascading event storm loops where the local service processes an event published by itself, each event includes:
- `"eventSource": "KANBAN"` (for events sent from this Kanban application).

**Rule**:
- Any incoming event with `"eventSource": "KANBAN"` is automatically ignored by `KafkaConsumerService`.
- External providers should append their own source identifier (e.g. `"eventSource": "JIRA"`) and ignore messages labeled `"eventSource": "KANBAN"`.

---

## 4. Configuration

The following environment variables control the Kafka integration. They can be added to your local `.env` file or injected into Kubernetes Pod containers.

| Variable Name | Default Value | Description |
|---|---|---|
| `KAFKA_BOOTSTRAP_SERVERS` | *None* | Comma-separated list of broker host:ports (e.g. `localhost:9092`). If empty, Kafka is disabled. |
| `KAFKA_TOPIC_BACKLOG_EVENTS` | `backlog-events` | Target topic name for publishing and consuming backlog events. |

---

## 5. Flow Actions

### Incoming Event Synchronization (Kafka -> local files)

1. The consumer group `kanban-board-group` listens to `backlog-events`.
2. When an event is received, `KafkaConsumerService` parses and checks the loop-prevention filter.
3. Handlers in `StorySyncService` update the project file.
4. UI clients fetch the updated state automatically on their standard interval scan (4-second polling).

### Outgoing User Mutations (UI -> Kafka)

1. User performs an action on the Kanban board (Create, Edit, Delete, Move, Drag/Drop).
2. The UI client sends a request to `/api/projects/save-file`.
3. The server compares the old project aggregate cache with the new incoming model.
4. The server detects the mutation type (`STORY_CREATED`, `STORY_MOVED`, `STORY_UPDATED`, or `STORY_DELETED`).
5. The server invokes `kafkaProducerService.publishStoryEvent` to publish the event to Kafka.
