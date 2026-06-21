# Domain Model — Matrimony Platform

This document defines the core business entities, relationships, ownership boundaries, lifecycles, and business rules that govern the Matrimony Platform. This domain design is decoupled from specific database schemas, APIs, or physical system architectures, serving as the conceptual foundation for development.

---

## 1. Domain Overview

The matrimonial domain centers around three primary values: **Trust, Privacy, and Smart Relevance**. The core goal of the system is to help genuine, serious marriage seekers find compatible partners in a safe, verified-only matchmaking ecosystem.

The business domain is structured around three key thematic areas:
* **Identity & Trust**: Verifying accounts via multiple methods (OTP/Magic Link), establishing profiles, managing photos, and enforcing privacy levels.
* **Interactions & Matchmaking**: Setting partner preferences, discovering potential matches, expressing double-opt-in interest, and opening secure communication windows.
* **Engagement & Life Cycle**: Gating advanced features using tier subscriptions, alerting users on core events, and providing collaborative management tools for family-assisted seekers.

---

## 2. Entity Catalog

### 1. User
* **Purpose**: Represents the basic account ownership, authentication identity, and platform membership details.
* **Description**: The primary root entity for any person interacting with the platform. It holds login credentials, account status, security configurations, and references to profile resources.
* **Key Attributes**:
  * Phone Number
  * Email Address
  * Account Status
  * Verification Level
  * Last Login Timestamp
  * Account Recovery Method
* **Relationships**:
  * User (1) ↔ (1) Profile
  * User (1) ↔ (N) Notifications
  * User (1) ↔ (1) Subscription
* **Lifecycle**:
  * `Pending Signup` -> `Active` -> `Suspended` -> `Archived` -> `Deleted`
* **Business Rules**:
  * Phone number must match standard international formats.
  * Consecutive verification failures trigger automated temporary account lockouts.
* **Ownership**:
  * *Business Owner*: Operations Manager / Identity Administrator
  * *Logical Owning Service*: Auth & User Service

---

### 2. Profile
* **Purpose**: Holds the rich personal background, lifestyle attributes, and onboarding metadata of the seeker.
* **Description**: Captures demographic, physical, occupational, educational, and lifestyle details. Displays profile completion percentage to encourage full onboarding.
* **Key Attributes**:
  * Full Name
  * Gender
  * Date of Birth (Age calculated dynamically)
  * Height
  * Mother Tongue
  * Religion
  * Educational Background
  * Career Details
  * Lifestyle Attributes (Diet, habits)
  * Profile Completion Percentage
* **Relationships**:
  * Profile (1) ↔ (1) User
  * Profile (1) ↔ (1) FamilyProfile
  * Profile (1) ↔ (1) PartnerPreference
  * Profile (1) ↔ (N) Photos
  * Profile (1) ↔ (N) Interests
* **Lifecycle**:
  * `Draft` -> `Pending Verification` -> `Active` -> `Hidden` -> `Archived`
* **Business Rules**:
  * Profile age must be calculated as 18 years or older based on Date of Birth.
  * Profile status cannot set to "Active" until at least one photo is uploaded and basic attributes are filled.
* **Ownership**:
  * *Business Owner*: Profile Operations Manager
  * *Logical Owning Service*: Profile Service

---

### 3. FamilyProfile
* **Purpose**: Holds collaborative family background context and permits parent-guardian access.
* **Description**: Provides details on family structure, parents' occupations, status, and family values to support cultural matchmaking.
* **Key Attributes**:
  * Family Type (Nuclear/Joint)
  * Parents' Occupations
  * Family Status (Lower/Middle/Upper)
  * Family Values (Orthodox/Moderate/Liberal)
  * Guardian Access Level
  * Parent Approval Toggles
* **Relationships**:
  * FamilyProfile (1) ↔ (1) Profile
* **Lifecycle**:
  * `Draft` -> `Active` -> `Archived`
* **Business Rules**:
  * Changing critical family values triggers profile update logs.
  * Parent-managed profiles must explicitly link a primary User account of the child.
* **Ownership**:
  * *Business Owner*: Family Relations Specialist
  * *Logical Owning Service*: Profile Service

---

### 4. PartnerPreference
* **Purpose**: Defines search criteria and compatibility constraints used by the recommendation engine.
* **Description**: Contains acceptable age ranges, height boundaries, community types, mother tongues, locations, and educational attributes.
* **Key Attributes**:
  * Minimum Age Target
  * Maximum Age Target
  * Height Ranges
  * Preferred Locations
  * Preferred Mother Tongues
  * Preferred Religions
  * Mandatory Preferences Flags
* **Relationships**:
  * PartnerPreference (1) ↔ (1) Profile
* **Lifecycle**:
  * `Unconfigured` -> `Active`
* **Business Rules**:
  * Minimum age preference must comply with system minimums (>= 18).
  * If locations preferences are empty, recommendations default to the user's primary regional area.
* **Ownership**:
  * *Business Owner*: Matchmaking Operations Manager
  * *Logical Owning Service*: Profile Service (definition) / Search Service (execution)

---

### 5. Photo
* **Purpose**: Manages uploaded visual assets and controls image visibility.
* **Description**: User photos used for self-presentation. Supports blurring filters for unmatched or unverified profiles to protect privacy.
* **Key Attributes**:
  * Image URL
  * Primary Avatar Indicator (Is Main Picture)
  * Photo Visibility Scope (Public, Matches Only, Hidden)
  * Verification Status (Checked, Rejected, Pending)
  * Storage Key
* **Relationships**:
  * Photo (N) ↔ (1) Profile
* **Lifecycle**:
  * `Uploaded` -> `Approved` -> `Rejected` -> `Deleted`
* **Business Rules**:
  * Maximum photo limit is strictly 5 per profile.
  * Toggling photo visibility to 'Hidden' instantly removes image cache listings in search index outputs.
* **Ownership**:
  * *Business Owner*: Content Moderation Team
  * *Logical Owning Service*: Media Service

---

### 6. Verification
* **Purpose**: Coordinates security verification steps ensuring identity trust.
* **Description**: Records status checks for Phone OTP, Email verification, and potential ID checks to display trust badges.
* **Key Attributes**:
  * Verification Type (Phone, Email, Identity Badge)
  * Verification Status (Unverified, Pending, Verified, Failed)
  * Issue Date
  * Verification Code / Ticket Key
  * Failure Attempts Count
* **Relationships**:
  * Verification (N) ↔ (1) User
* **Lifecycle**:
  * `Initiated` -> `Sent` -> `Verified` -> `Expired` -> `Locked`
* **Business Rules**:
  * Phone OTP verification code expires exactly 5 minutes after creation.
  * Three consecutive invalid validation attempts lock verification for that target identity for 1 hour.
* **Ownership**:
  * *Business Owner*: Compliance & Security Manager
  * *Logical Owning Service*: Auth & User Service

---

### 7. Interest
* **Purpose**: Captures initial double-opt-in connection requests between profiles.
* **Description**: Expresses intent to connect. Once accepted by the target, unlocks direct messaging.
* **Key Attributes**:
  * Sender Profile Reference
  * Receiver Profile Reference
  * Interest Status (Pending, Accepted, Declined, Archived)
  * Timestamp of Creation
  * Last Action Timestamp
* **Relationships**:
  * Interest (N) ↔ (1) Profile (Sender)
  * Interest (N) ↔ (1) Profile (Receiver)
  * Interest (1) ↔ (1) Match (on Accept state)
* **Lifecycle**:
  * `Pending` -> `Accepted` -> `Declined` -> `Archived`
* **Business Rules**:
  * Senders cannot issue a new interest request while a previous interest to the same target is pending.
  * Declined interests hide themselves from the sender's dashboard without issuing warning notifications to protect privacy.
* **Ownership**:
  * *Business Owner*: User Interaction Analyst
  * *Logical Owning Service*: Profile Service

---

### 8. Match
* **Purpose**: Establishes a mutual connection when an interest is accepted.
* **Description**: Formed upon double opt-in validation, triggering messaging access and unlocking unmasked profile variables.
* **Key Attributes**:
  * Profile A Reference
  * Profile B Reference
  * Match Status (Connected, Disconnected)
  * Connection Timestamp
  * Compatibility Score
* **Relationships**:
  * Match (1) ↔ (1) Interest
  * Match (1) ↔ (1) Conversation
* **Lifecycle**:
  * `Active` -> `Terminated`
* **Business Rules**:
  * Creating a Match instantly triggers a message broker request to initialize a chat conversation.
  * Terminating a match locks associated conversation history from receiving further messages.
* **Ownership**:
  * *Business Owner*: Matchmaking Operations Manager
  * *Logical Owning Service*: Search & Matchmaking Service

---

### 9. Conversation
* **Purpose**: Manages communication room context between two matched profiles.
* **Description**: Represents the direct messaging thread context. Facilitates WebSocket event handshakes.
* **Key Attributes**:
  * Participant A Reference
  * Participant B Reference
  * Last Message Reference
  * Unread Messages Count
  * Thread Status (Open, Muted, Blocked)
  * Creation Timestamp
* **Relationships**:
  * Conversation (1) ↔ (1) Match
  * Conversation (1) ↔ (N) Messages
* **Lifecycle**:
  * `Active` -> `Muted` -> `Closed`
* **Business Rules**:
  * A conversation cannot accept new messages if the underlying Match state is Terminated.
* **Ownership**:
  * *Business Owner*: Customer Engagement Specialist
  * *Logical Owning Service*: Chat & Messaging Service

---

### 10. Message
* **Purpose**: Captures individual textual or media exchanges within a conversation.
* **Description**: Represents the single transmission block. Features standard read receipt indicators.
* **Key Attributes**:
  * Conversation Reference
  * Sender Profile Reference
  * Message Text Content
  * Message Status (Sent, Delivered, Read)
  * Message Type (Text, Media Reference)
  * Creation Timestamp
* **Relationships**:
  * Message (N) ↔ (1) Conversation
* **Lifecycle**:
  * `Sending` -> `Sent` -> `Delivered` -> `Read` -> `Deleted`
* **Business Rules**:
  * Message text is scanned for contact info patterns (phone/email regex) prior to delivery to enforce masking rules in early match states.
* **Ownership**:
  * *Business Owner*: Trust & Moderation Team
  * *Logical Owning Service*: Chat & Messaging Service

---

### 11. Notification
* **Purpose**: Keeps users informed of activities and platform changes.
* **Description**: Operational warnings, match alerts, or profile messages delivered inside the app or through external routes.
* **Key Attributes**:
  * User Reference
  * Alert Title
  * Alert Content Body
  * Delivery Channel (In-App, Push, Email)
  * Read Indicator (Is Read)
  * Action Destination Route
  * Creation Timestamp
* **Relationships**:
  * Notification (N) ↔ (1) User
* **Lifecycle**:
  * `Queued` -> `Delivered` -> `Read` -> `Expired`
* **Business Rules**:
  * In-app notifications automatically mark as Read when a user clicks the target alert item.
  * Active chat notifications are suppressed if the user is currently viewing the corresponding conversation screen.
* **Ownership**:
  * *Business Owner*: Marketing & Engagement Specialist
  * *Logical Owning Service*: Notification Service

---

### 12. Subscription
* **Purpose**: Manages gated access level tiers and membership configurations.
* **Description**: Governs membership plans (Free vs. Premium). Restricts features like contact reveals, advanced filters, or boosting.
* **Key Attributes**:
  * User Reference
  * Plan Tier Name (Level 1 Free, Level 2 Verified Seeker, Level 3 Match Premium)
  * Subscription Status (Active, Expired, Cancelled, Graced)
  * Start Date
  * Renewal Date
  * Billing History Key
* **Relationships**:
  * Subscription (1) ↔ (1) User
* **Lifecycle**:
  * `Pending Activation` -> `Active` -> `Grace Period` -> `Expired` -> `Cancelled`
* **Business Rules**:
  * User account recovery doesn't impact current subscription status configurations.
  * Feature gates block premium activities instantly upon transitioning to 'Expired' status.
* **Ownership**:
  * *Business Owner*: Finance & Revenue Manager
  * *Logical Owning Service*: Profile Service (Level 1 MVP) / Billing Service (Level 2+)

---

## 3. Entity Relationships

This section defines cardinality and business directions for entity relationships.

```
+------------+ 1     1 +------------+ 1     1 +-------------------+
|    User    +---------+   Profile  +---------+ PartnerPreference |
+-----+------+         +-----+------+         +-------------------+
      | 1                    | 1
      |                      |
      | 1                    | N
+-----+------+         +-----+------+
|Subscription|         |    Photo   |
+------------+         +-----+------+
                             |
                             | N
                             | (Sender/Receiver)
                       +-----+------+ 1     1 +------------+ 1     1 +--------------+ N     1 +---------+
                       |  Interest  +---------+    Match   +---------+ Conversation +---------+ Message |
                       +------------+         +------------+         +--------------+         +---------+
```

### Relationship Matrix

| Entity A | Entity B | Cardinality | Business Description | Direction |
| :--- | :--- | :--- | :--- | :--- |
| **User** | **Profile** | `1 ↔ 1` | User accounts own exactly one matchmaking profile. | Bidirectional |
| **Profile** | **Photo** | `1 ↔ N` | Profiles can manage up to 5 profile images. | Unidirectional |
| **Profile** | **PartnerPreference**| `1 ↔ 1` | Profiles set one active set of match filters. | Bidirectional |
| **Profile** | **Interest** | `1 ↔ N` | Profiles can send or receive many interest intents. | Bidirectional |
| **Interest** | **Match** | `1 ↔ 1` | A single interest acceptance transitions into a Match. | Bidirectional |
| **Match** | **Conversation** | `1 ↔ 1` | A Match initializes exactly one direct conversation. | Bidirectional |
| **Conversation**| **Message** | `1 ↔ N` | Conversations contain many chat messages. | Unidirectional |
| **User** | **Notification** | `1 ↔ N` | Users receive many activity notifications. | Unidirectional |
| **User** | **Subscription** | `1 ↔ 1` | Users have exactly one current billing tier state. | Bidirectional |

---

## 4. Lifecycle Definitions

Each entity is governed by a state machine that controls allowed state transitions:

```
[User Lifecycle]
Pending Signup -> Active -> Suspended -> Archived -> Deleted
                    |
                    +-----> Suspended (Account under review)

[Profile Lifecycle]
Draft -> Pending Verification -> Active -> Hidden -> Archived
                                   |
                                   +-> Hidden (Private search mode)

[Interest Lifecycle]
Pending -> Accepted -> Match Connected
        -> Declined -> Archived
```

### Entity State Transition Matrix

| Entity | Starting State | Target State | Triggering Business Event |
| :--- | :--- | :--- | :--- |
| **User** | `Pending Signup` | `Active` | Phone OTP verified successfully |
| | `Active` | `Suspended` | User reported for violation or suspicious profile activity |
| | `Active` | `Archived` | User initiates temporary account deactivation |
| | `Archived` | `Deleted` | Permanent deletion request after GDRP / DPDP grace period |
| **Profile** | `Draft` | `Pending Verification`| Onboarding wizard wizard steps completed |
| | `Pending Verification` | `Active` | Core email and phone verification success |
| | `Active` | `Hidden` | Seeker toggles search visibility setting to Hidden |
| | `Active` | `Archived` | Linked User account is archived |
| **Photo** | `Uploaded` | `Approved` | Automated size and content review validates image rules |
| | `Uploaded` | `Rejected` | Image fails content check (contains bad content/illegal dimensions) |
| | `Approved` | `Deleted` | Seeker chooses to delete image from uploader panel |
| **Verification**| `Initiated` | `Sent` | System generates OTP code and calls SMS dispatcher |
| | `Sent` | `Verified` | Input code matches active database variable |
| | `Sent` | `Expired` | Expiration time limit is reached without matching input |
| | `Sent` | `Locked` | Limit of consecutive invalid attempts is reached |
| **Interest** | `Pending` | `Accepted` | Receiver selects Accept interest action |
| | `Pending` | `Declined` | Receiver selects Decline interest action |
| | `Pending` | `Archived` | Cleanup worker deletes expired pending requests |

---

## 5. Business Rules

The following core rules govern the Matrimony Platform, derived directly from the requirements in the PRD:

### 1. Verification Lockout Rule (PRD 7.2.1)
* **Description**: If phone OTP verification checks fail consecutively, lock verification actions to protect user accounts from brute-force attempts.
* **Logic**: Upon `3` consecutive invalid entries, change target verification ticket status to `Locked` and reject all attempts for `1` hour.

### 2. Onboarding Completeness Constraint (PRD 7.2.2)
* **Description**: Profile completion state progress is linked to media uploads.
* **Logic**: Profile completion status cannot calculate to `100%` unless at least one valid photo is uploaded and designated as the primary avatar.

### 3. Preference Validation Bounds (PRD 7.2.3)
* **Description**: Preferences filters must set sensible values to prevent search indexing failures.
* **Logic**: Validation blocks values set outside base limits (e.g. min age >= 18, max age <= 70). Empty settings fall back to using user's location preferences.

### 4. Search Exclusion Rule (PRD 7.2.5)
* **Description**: recommendation lists should exclude inactive users.
* **Logic**: If a UserAccount's last login date exceeds `90` days, the linked profile search status switches to inactive and is filtered out of matching recommendations.

### 5. Double Opt-In Interest Constraint (PRD 7.2.6)
* **Description**: Prevent spam and duplicate connection requests.
* **Logic**: If sender sends interest to receiver while an interest record is already in `Pending` status between the profiles, the system blocks the action.

### 6. Client Privacy Masking Rule (PRD 7.2.8)
* **Description**: Mask personal contact coordinates to protect privacy prior to double opt-in consent.
* **Logic**: Contact coordinates (`phone_number`, `email`) must mask characters (e.g. `jo***@email.com` and `+91******987`) at the server API level unless connection status is `MATCHED`.

---

## 6. Ownership Matrix

Assigns conceptual and logical service ownership for each domain model entity.

| Entity | Business Owner | Owning Service (Logical) |
| :--- | :--- | :--- |
| **User** | Identity Administrator | Auth & User Service |
| **Profile** | Profile Operations Manager | Profile Service |
| **FamilyProfile** | Family Relations Specialist | Profile Service |
| **PartnerPreference** | Matchmaking Operations Manager | Profile Service |
| **Photo** | Content Moderation Team | Media Service |
| **Verification** | Security Compliance Specialist | Auth & User Service |
| **Interest** | Seeker Interaction Analyst | Profile Service |
| **Match** | Matchmaking Operations Manager | Search & Matchmaking Service |
| **Conversation** | Customer Experience Manager | Chat & Messaging Service |
| **Message** | Content Integrity Officer | Chat & Messaging Service |
| **Notification** | Marketing & Communications Manager | Notification Service |
| **Subscription** | Revenue & Billing Manager | Profile Service / Billing Service |
