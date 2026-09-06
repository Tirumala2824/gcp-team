# Gemini Reflection Journal & Cognitive Mirror (Cloud Run & Firestore)

A production-grade, user-authenticated personal reflection and longitudinal cognitive mirror web application built with **Next.js**, **Firebase Authentication (Google Sign-In)**, **Cloud Firestore**, and **Gemini 3.6 Flash**.

## Architecture & Security Highlights

- **Temporal Longitudinal Reflection**: The Cognitive Mirror analyzes current journal entries against a chronological archive of past reflections, exposing recurring behavioral patterns, cognitive traps, and maturity shifts across time without generic cheerleading.
- **User Data Isolation**: Reflections, archive history, and chat streams are anchored strictly under `/users/{userId}/interactions/{interactionId}`. Firestore Security Rules verify `request.auth.uid == userId` for every read, write, update, and delete operation.
- **Resilient AI Fallback Ladder**: Implements an automated fallback ladder ordered by availability and latency (`gemini-3.6-flash` &rarr; `gemini-3.1-flash-lite` &rarr; `gemini-flash-latest` &rarr; `gemini-3.7-flash`).
- **Defensive Ingestion & Zero-Crash Payload Hygiene**: Null-safe destructuring on backend routes and strict undefined-stripping prior to any database mutation.
- **Guaranteed Transaction Verification**: Preserves user input buffer until both AI generation and database writes confirm successful completion, complete with an in-place retry save option.

---

## Agentic Threat Model (The 5 Threat Zones)

| Threat Zone | Identified Risks | Production Countermeasures Implemented |
| :--- | :--- | :--- |
| **1. Input Surfaces** | Prompt injection, oversized payloads, malformed JSON | Strict schema validation, null-safe payload extraction, 10,000 character limits, and treating historical archive entries strictly as plain data. |
| **2. Planning & Reasoning** | Adversarial hijacking, prompt escape attempting generic praise | Server-enforced system instructions with psychological grounding, explicit 4-section schema constraints, and prohibition of hollow cheerleading. |
| **3. Tool Execution** | SSRF, privilege escalation, unauthenticated API routing | All AI generation is strictly server-side (`/api/gemini/reflect`, `/api/gemini/summarize`) with `User-Agent: aistudio-build`. No raw SDK access in browser. |
| **4. Memory & State** | Cross-tenant data leaks, session hijacking, state corruption | Path-bound Firestore security rules (`/users/{userId}/interactions/{id}` with `request.auth.uid == userId`), undefined-stripping (`sanitizePayload`), and atomic write verification. |
| **5. Inter-System Comm** | API key leakage in client bundles, token tampering | Zero hardcoded keys, Google Cloud Secret Manager integration (`GEMINI_API_KEY`), TLS 1.3 in transit, and Firebase Federated Auth. |

---

## 1. Environment & Prerequisites

Ensure the following Google Cloud APIs are enabled in your project:

```bash
# Set your active GCP project ID
export PROJECT_ID="YOUR_PROJECT_ID"
gcloud config set project $PROJECT_ID

# Enable required Google Cloud APIs
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com
```

---

## 2. Secret Management Setup

Store your Gemini API key securely in Google Cloud Secret Manager and grant the Cloud Run runtime service account access:

```bash
# Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Retrieve project number
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

# Grant the default Cloud Run service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 3. Database Security Configuration

Deploy owner-bound security rules to ensure user data isolation:

### `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Deploy rules using the Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

---

## 4. Cloud Run Deployment Flow

Deploy the containerized Next.js application to Cloud Run with Secret Manager environment injection. We recommend deploying to `us-central1` (Iowa, US) as the primary Google Cloud region for Gemini models with maximum quota and feature availability:

```bash
export SERVICE_NAME="gemini-reflection-journal"
# Recommended: us-central1 (highest quota & model availability).
# Alternatives: asia-southeast1 (Singapore), europe-west1 (Belgium), us-east4 (N. Virginia).
export REGION="us-central1"

gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars="GEMINI_REGION=$REGION" \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"
```

---

## 5. Required Campaign Verification Binding

To register the service for automated challenge verification, apply the mandatory label:

```bash
gcloud run services update $SERVICE_NAME \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=$REGION
```

---

## 6. Functional Verification Walkthrough

Follow these sequential steps to test and verify every interaction and process in the application:

1. **Unauthenticated Landing**:
   - Access the root URL.
   - Verify that the Landing Page displays the Google Sign-In prompt and user isolation badge.
   - Verify that no private data or dashboard controls are visible before authentication.
2. **Google Authentication**:
   - Click "Sign In with Google".
   - Complete Google account selection in the popup.
   - Verify immediate redirection to the private dashboard with your email/name in the top-right profile chip and the Firestore status indicator showing "Cloud Firestore Online".
3. **Cognitive Mirror (Temporal Longitudinal Reflection Flow)**:
   - Ensure the "Cognitive Mirror" mode is active (default).
   - Verify the Temporal Archive Context bar displays either "Archive is empty — creating initial Baseline Anchor #1" or the count of indexed historical entries.
   - Select an introspective prompt starter (e.g., "I notice myself hesitating to commit to this next step...") or enter your own reflection.
   - Press "Enter" or click the send button.
   - Verify that the cognitive mirror response renders with the 4 distinct structured sections:
     - `1. The Temporal Echo (Recurring Patterns)`
     - `2. Blind Spots & Cognitive Traps`
     - `3. The Growth Ledger (Then vs. Now)`
     - `4. The Forward Catalyst (Piercing Question)`
   - Verify the grounded, acute tone without generic cheerleading.
   - Verify that the entire interaction is verified and persisted in Firestore under `/users/{userId}/interactions/{interactionId}`.
4. **Historical Archive Indexing (Past vs. Present Analysis)**:
   - Click "+ New Reflection Session" in the sidebar.
   - Enter a new reflection describing a current dilemma or feeling of progress.
   - Verify that the server incorporates the chronological archive of previous reflections into the context.
   - Verify that the Growth Ledger explicitly contrasts your past patterns against your current state.
5. **Region Selection & Diagnostics**:
   - Inspect the Region Selector in the header navigation bar (defaults to `us-central1 (US Central - Recommended)`).
   - Test switching the dropdown to `europe-west1`, `us-east4`, or `asia-southeast1`.
   - Verify that prompt requests transmit the active `region` parameter to the backend.
   - In case of quota exhaustion (HTTP 429) or regional unavailability, verify that the diagnostic Engine Notice displays the exact root cause and offers a one-click "Switch to us-central1 (Recommended)" action.
6. **Longitudinal Emotional & Themes Data Visualization (Recharts)**:
   - Click the "30-Day Trends" tab in the top navigation bar or "30-Day Trends & Themes" in the sidebar.
   - Verify that the Recharts visualizer loads with zero layout shift or hydration mismatch.
   - Inspect the 4 high-level metric cards: Average Valence (-10 to +10), Resilience Index (% capacity), Top Dilemma / Theme, and Temporal Trajectory.
   - Test the time window selectors (7 Days, 14 Days, 30 Days) and verify that the X-axis and metric cards adjust dynamically.
   - Hover over the Emotional Tone Trajectory Area Chart; verify that the custom tooltip displays the date, title, excerpt quote, valence badge, and theme tags.
   - Click a data point on the Area Chart; verify that the Selected Timeline Anchor inspector updates with that entry's details.
   - Test the Recurring Themes Bar Chart and filter chips (e.g., "Perfectionism & Hesitation", "Burnout & Energy", "Agency & Growth Momentum").
   - Click a theme chip to filter the timeline to only entries exhibiting that cognitive pattern; click "Clear filter" to reset.
   - If fewer than 3 entries exist in the current window, verify that the synthesized 30-day demo arc is shown with an informative amber banner, and test toggling "Live User Reflections" / "Demo Arc Active".
   - In the timeline cards list below the charts, click any reflection card to highlight its position on the emotional trajectory.
   - Click "Write Reflection" or the "Journal & Mirror" tab to return seamlessly to the active journaling workspace.
7. **Mode Switching**:
   - Click the "Deep Reflection", "Mindful Journal", "Synthesis & Summary", and "Creative Brainstorm" mode pills.
   - Verify that the mode description, placeholder text, and active icon update adaptively.
8. **Synthesis & Takeaways**:
   - In a multi-turn conversation, click "Synthesize Key Takeaways".
   - Verify that the structured summary card renders above the conversation and updates the Firestore document with `summary`.
9. **Persistence Integrity & Retry Recovery**:
   - If simulated network or quota errors occur, verify that an amber alert banner displays the exact error message.
   - Verify that the user's drafted prompt is not wiped or lost.
   - Click "Retry Save" to confirm idempotent re-execution.
10. **Session Management & Deletion**:
   - Hover over a reflection in the left sidebar history list.
   - Click the trash icon; verify the inline confirmation controls ("Del" / "Cancel") appear.
   - Click "Cancel" to abort, or "Del" to permanently remove the document from Firestore.
11. **Sign Out**:
   - Click "Sign Out".
   - Verify that the user's session terminates and the UI returns to the secure Landing Page.
