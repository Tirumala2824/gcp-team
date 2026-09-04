# Gemini Reflection Journal (Cloud Run & Firestore)

A production-grade, user-authenticated personal reflection and journaling web application built with **Next.js**, **Firebase Authentication (Google Sign-In)**, **Cloud Firestore**, and **Gemini 3.6 Flash**.

## Architecture & Security Highlights

- **User Data Isolation**: Interactions, reflections, and chat history are anchored strictly under `/users/{userId}/interactions/{interactionId}`. Firestore Security Rules verify `request.auth.uid == userId` for every read, write, update, and delete operation.
- **Resilient AI Fallback Ladder**: Implements an automated fallback ladder ordered by availability and latency (`gemini-3.6-flash` &rarr; `gemini-3.1-flash-lite` &rarr; `gemini-flash-latest` &rarr; `gemini-3.7-flash`).
- **Defensive Ingestion & Zero-Crash Payload Hygiene**: Null-safe destructuring on backend routes and strict undefined-stripping prior to any database mutation.
- **Guaranteed Transaction Verification**: Preserves user input buffer until both AI generation and database writes confirm successful completion.

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

Deploy the containerized Next.js application to Cloud Run with Secret Manager environment injection:

```bash
export SERVICE_NAME="gemini-reflection-journal"
export REGION="asia-southeast1" # Or us-central1, us-east1, etc.

gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
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

Follow these sequential steps to test and verify every interaction in the application:

1. **Unauthenticated Landing**:
   - Access the root URL.
   - Verify that the Landing Page displays the Google Sign-In prompt and isolation badge.
   - Verify that no private data or dashboard controls are visible.
2. **Google Authentication**:
   - Click "Sign In with Google".
   - Complete Google account selection in the popup.
   - Verify redirection to the private dashboard with your email/name in the top-right profile chip.
3. **Deep Reflection Flow**:
   - Select the "Deep Reflection" mode pill.
   - Enter a reflective thought in the prompt box (or click an inspiration chip).
   - Press "Enter" or click the send button.
   - Verify that the message appears in the chat stream, Gemini generates an empathetic response using `gemini-3.6-flash` (or fallback), and the session is saved to Firestore under `/users/{userId}/interactions`.
4. **Multi-Turn Dialogue**:
   - Submit a follow-up reflection within the same thread.
   - Verify that the thread retains historical context and updates Firestore atomically.
5. **Synthesis & Takeaways**:
   - Click "Synthesize Key Takeaways".
   - Verify that the dedicated synthesis card renders with structured insights and saves to the document.
6. **History & Navigation**:
   - Click "+ New Reflection Session" in the sidebar.
   - Verify that the stage clears to a clean new session.
   - Click on the previous session in the history sidebar.
   - Verify that the full message history and synthesis reload accurately.
7. **Sign Out**:
   - Click "Sign Out".
   - Verify that the session terminates and returns to the Landing Page.
