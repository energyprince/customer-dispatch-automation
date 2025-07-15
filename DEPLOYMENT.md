# CPower Dispatch Automation - Google Cloud Run Deployment Guide

This guide walks you through deploying the CPower Dispatch Automation system to Google Cloud Run.

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **Google Cloud SDK** installed on your local machine
3. **Docker** installed (optional, for local building)
4. **`.env` file** with all required configuration

## Step 1: Install Google Cloud SDK

```bash
# On macOS with Homebrew
brew install google-cloud-sdk

# Or download directly
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

## Step 2: Initial Setup

Run the setup script to create the project and enable required services:

```bash
./scripts/gcloud-setup.sh
```

This script will:
- Create a new Google Cloud project
- Enable required APIs (Cloud Run, Cloud Build, Secret Manager)
- Create a service account
- Link billing account

## Step 3: Create Secrets

Create all required secrets from your `.env` file:

```bash
./scripts/create-secrets.sh
```

This will create secure secrets for:
- Anthropic API key
- SMTP credentials
- Portal credentials
- Email monitoring settings

## Step 4: Deploy the Application

Deploy to Cloud Run:

```bash
./scripts/deploy.sh
```

You'll have three options:
1. **Cloud Build** (recommended) - Builds in the cloud
2. **Direct source deploy** - Builds and deploys from source
3. **Local build** - Build locally, push to registry, then deploy

## Step 5: Verify Deployment

Check the status of your deployment:

```bash
./scripts/check-status.sh
```

## Access Your Application

After deployment, you'll receive URLs for:
- **Main Application**: `https://[YOUR-SERVICE-URL].run.app/`
- **AI Assistant**: `https://[YOUR-SERVICE-URL].run.app/ai/`

## Architecture on Cloud Run

```
┌─────────────────────────────────────────┐
│         Google Cloud Run                │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │     Nginx (port 8080)           │   │
│  │                                 │   │
│  │  Routes:                        │   │
│  │  / → Dispatch Server (3000)     │   │
│  │  /ai/ → AI Assistant (3333)     │   │
│  └──────────┬──────────────────────┘   │
│             │                           │
│  ┌──────────┴──────────┐               │
│  │                     │               │
│  ▼                     ▼               │
│ ┌──────────────┐  ┌──────────────┐    │
│ │   Node.js    │  │   Python     │    │
│ │  Dispatch    │  │     AI       │    │
│ │   Server     │  │  Assistant   │    │
│ │  (port 3000) │  │ (port 3333)  │    │
│ └──────────────┘  └──────────────┘    │
│                                         │
│         Managed by Supervisor           │
└─────────────────────────────────────────┘
```

## Monitoring and Logs

### View logs in real-time:
```bash
gcloud alpha run logs tail \
  --service=cpower-dispatch-automation \
  --region=us-central1
```

### View logs for specific time range:
```bash
gcloud run logs read \
  --service=cpower-dispatch-automation \
  --region=us-central1 \
  --limit=50
```

### Monitor in Console:
Visit: https://console.cloud.google.com/run

## Updating the Application

### Option 1: Redeploy
```bash
./scripts/deploy.sh
```

### Option 2: Rolling update with traffic split
```bash
# Deploy new revision without routing traffic
gcloud run deploy cpower-dispatch-automation \
  --no-traffic \
  --tag=new-version

# Gradually shift traffic
gcloud run services update-traffic cpower-dispatch-automation \
  --to-tags=new-version=50
```

## Cost Management

### Estimate monthly costs:
- **Cloud Run**: ~$0.00002400/vCPU-second + ~$0.00000250/GiB-second
- **Free tier**: 2 million requests, 360,000 vCPU-seconds, 180,000 GiB-seconds
- **Typical cost**: $5-20/month for low-moderate traffic

### Cost optimization:
```bash
# Set minimum instances to 0 to save costs
gcloud run services update cpower-dispatch-automation \
  --min-instances=0
```

## Troubleshooting

### Service won't start
```bash
# Check logs
gcloud run logs read --service=cpower-dispatch-automation --limit=100

# Check service details
gcloud run services describe cpower-dispatch-automation
```

### Secret access issues
```bash
# List secrets
gcloud secrets list

# Check secret permissions
gcloud secrets get-iam-policy anthropic-api-key
```

### Memory issues
```bash
# Increase memory allocation
gcloud run services update cpower-dispatch-automation \
  --memory=8Gi
```

## Security Best Practices

1. **Never commit secrets** - Use Secret Manager
2. **Enable VPC connector** for database access
3. **Use service accounts** with minimal permissions
4. **Enable Cloud Armor** for DDoS protection
5. **Set up alerts** for unusual activity

## Cleanup

To avoid charges, delete resources when not needed:

```bash
# Delete Cloud Run service
gcloud run services delete cpower-dispatch-automation --region=us-central1

# Delete secrets
gcloud secrets delete anthropic-api-key

# Delete the entire project (WARNING: This deletes everything)
gcloud projects delete cpower-dispatch-automation
```

## Support

For issues:
1. Check Cloud Run logs
2. Verify all secrets are created
3. Ensure billing is enabled
4. Check service account permissions

## Next Steps

1. Set up custom domain
2. Configure Cloud Armor for security
3. Set up monitoring alerts
4. Enable Cloud CDN for static assets
5. Configure backup strategies