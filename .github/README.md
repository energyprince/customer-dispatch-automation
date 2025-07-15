# GitHub Actions Setup for Google Cloud Run Deployment

This GitHub Actions workflow automatically deploys the CPower Dispatch Automation system to Google Cloud Run when changes are pushed to the main branch.

## Required GitHub Secrets

You need to configure the following secrets in your GitHub repository settings:

### 1. Google Cloud Authentication (Workload Identity Federation)
- **`WIF_PROVIDER`**: The Workload Identity Federation provider name
  - Format: `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_NAME/providers/PROVIDER_NAME`
- **`WIF_SERVICE_ACCOUNT`**: The service account email for deployment
  - Format: `SERVICE_ACCOUNT_NAME@PROJECT_ID.iam.gserviceaccount.com`

### 2. Google Cloud Configuration
- **`GCP_PROJECT_ID`**: Your Google Cloud project ID
- **`GCP_SERVICE_NAME`**: The Cloud Run service name (e.g., `cpower-dispatch-automation`)
- **`GCP_REGION`**: The deployment region (e.g., `us-central1`)

## Setting Up Workload Identity Federation

To set up Workload Identity Federation for secure, keyless authentication:

```bash
# Set variables
export PROJECT_ID="your-project-id"
export POOL_NAME="github-actions"
export PROVIDER_NAME="github"
export SERVICE_ACCOUNT="github-deploy"
export REPO="your-github-username/customer_dispatch_event_automation"

# Create Workload Identity Pool
gcloud iam workload-identity-pools create "${POOL_NAME}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Create Workload Identity Provider
gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_NAME}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${POOL_NAME}" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.aud=assertion.aud,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Create Service Account
gcloud iam service-accounts create "${SERVICE_ACCOUNT}" \
  --display-name="GitHub Deploy Service Account" \
  --project="${PROJECT_ID}"

# Grant necessary permissions
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.developer"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.editor"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/viewer"

# Allow GitHub Actions to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding \
  "${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')/locations/global/workloadIdentityPools/${POOL_NAME}/attribute.repository/${REPO}"

# Get the Workload Identity Provider resource name
export WORKLOAD_IDENTITY_PROVIDER="projects/$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')/locations/global/workloadIdentityPools/${POOL_NAME}/providers/${PROVIDER_NAME}"

echo "WIF_PROVIDER: ${WORKLOAD_IDENTITY_PROVIDER}"
echo "WIF_SERVICE_ACCOUNT: ${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com"
```

## Alternative: Using Service Account Key (Less Secure)

If you prefer to use a service account key instead of Workload Identity Federation:

1. Replace the authentication step in the workflow with:
```yaml
- name: 'Authenticate to Google Cloud'
  uses: 'google-github-actions/auth@v2'
  with:
    credentials_json: ${{ secrets.GCP_SA_KEY }}
```

2. Create and add the service account key:
```bash
# Create key
gcloud iam service-accounts keys create key.json \
  --iam-account=${SERVICE_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com

# Add to GitHub secrets as GCP_SA_KEY
# Copy the contents of key.json and paste as the secret value

# Delete the local key file
rm key.json
```

## Deployment Process

1. **Automatic Deployment**: Push to the `main` branch triggers deployment
2. **Manual Deployment**: Use the "Actions" tab → "Deploy to Google Cloud Run" → "Run workflow"

## Monitoring Deployments

- Check the Actions tab in your GitHub repository for deployment status
- View deployment summaries in the workflow run details
- Cloud Run logs are available in the Google Cloud Console

## Troubleshooting

If deployment fails:
1. Check the GitHub Actions logs for detailed error messages
2. Verify all secrets are correctly configured
3. Ensure the service account has necessary permissions
4. Check Cloud Build logs in Google Cloud Console