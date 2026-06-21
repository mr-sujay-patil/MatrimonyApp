# Development Workflow Policy

## Story Traceability

1. Never start implementation without a valid Story ID from `backlog.json`.
2. Every code change must be traceable to a Story ID.
3. Every commit must reference the Story ID and Story Title.
4. Every modified code file should include Story ID traceability comments where applicable.
5. All work must remain traceable:

   * Story → Branch → Commit → PR → backlog.json → Release

---

## Git Workflow

6. Never commit directly to `main` or `master`.
7. Never push changes directly to `main` or `master`.
8. For every story, create a dedicated feature branch:

```text
<story-id>-<short-title>
```

Example:

```text
MAT-123-user-registration
```

9. All development, commits, fixes, reviews, and updates for a story must occur only in its dedicated branch.
10. Every commit must be atomic and related only to the current story.
11. Commit message format:

```text
<story-id>: <short description>
```

Example:

```text
MAT-123: Add user registration validation
```

---

## Kanban Workflow

12. Before starting implementation:

    * Update `backlog.json`
    * Move story status from `BACKLOG` → `IN_PROGRESS`

13. While implementing:

    * Keep `backlog.json` updated with the latest progress.
    * Update implementation notes if supported.

14. After creating a Pull Request:

    * Update `backlog.json`
    * Move story status from `IN_PROGRESS` → `REVIEW`
    * Store PR number/reference if supported.

15. Never mark a story as completed merely because coding is finished.

16. A story is considered completed only after merge approval and successful integration.

---

## Pull Request Rules

17. Every story must result in a Pull Request.

18. Never merge directly without a Pull Request.

19. Never self-approve unless explicitly instructed.

20. Pull Requests must contain:

    * Story ID
    * Story Title
    * Summary of changes
    * Testing evidence
    * Impacted modules
    * Screenshots (if UI changes exist)

21. Never auto-merge Pull Requests unless explicitly instructed.

---

## Quality Gates

22. Before committing:

    * Verify acceptance criteria are satisfied.
    * Verify no unrelated files are modified.
    * Verify implementation matches the story.

23. Before creating a Pull Request:

    * Run all tests.
    * Ensure build passes.
    * Ensure linting passes.
    * Ensure static analysis passes.
    * Ensure application starts successfully.

24. Do not leave broken tests.

25. Do not leave commented-out code.

26. Do not leave temporary debugging code.

27. Do not leave TODO placeholders unless explicitly tracked by a story.

---

## Scope Control

28. Implement only what is defined in the story.
29. Do not introduce additional features.
30. Do not modify unrelated stories.
31. Do not modify unrelated modules.
32. Do not modify unrelated APIs.
33. Do not modify unrelated database objects.
34. Do not perform speculative refactoring.

---

## Architecture Rules

35. Preserve existing architecture unless the story explicitly requires changes.

36. Maintain backward compatibility whenever possible.

37. If architecture changes are required:

    * Create or update an Architecture Decision Record (ADR).
    * Document rationale before implementation.

38. Follow existing coding conventions and project patterns.

39. Reuse existing services and utilities before creating new ones.

---

## Database Rules

40. Never alter previously executed migrations.
41. Use versioned migration scripts for all database changes.
42. Database changes must be reversible whenever possible.
43. Document schema changes in the story.

---

## API Rules

44. Update API documentation for every API change.
45. Keep backend and frontend aligned with the approved shared JSON schema.
46. Preserve API versioning strategy.
47. Do not introduce breaking API changes without explicit approval.

---

## Dependency Management

48. Do not introduce new dependencies without explicit approval.
49. Do not introduce new frameworks without approval.
50. Do not introduce new infrastructure components without approval.
51. Prefer existing libraries already available in the project.

---

## Documentation Requirements

52. Update all affected documentation.
53. Update API contracts.
54. Update JSON schemas.
55. Update README files when applicable.
56. Update deployment notes if deployment behavior changes.

---

## Requirement Validation

57. If requirements are unclear, stop implementation and request clarification.
58. Do not make assumptions about business logic.
59. Do not hallucinate APIs, endpoints, database tables, fields, events, or integrations.
60. Use only verified requirements and existing project artifacts.

---

## Completion Criteria

A story can only be considered complete when:

* Implementation is finished.
* Acceptance criteria are satisfied.
* Tests pass.
* Pull Request is created.
* backlog.json is updated.
* Story status is moved to REVIEW or DONE according to workflow.
* Documentation is updated.
* No known defects remain related to the implemented scope.
