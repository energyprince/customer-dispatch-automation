# Google Cloud Run Deployment Guide

This guide explains how to deploy the CPower Sales Quote Tool to Google Cloud Run.

## Prerequisites

1. **Google Cloud Account**: You need a Google Cloud account with billing enabled
2. **gcloud CLI**: Install the Google Cloud SDK from https://cloud.google.com/sdk/docs/install
3. **Docker**: Ensure Docker is installed and running locally
4. **Anthropic API Key**: You'll need your Anthropic API key for the AI Assistant feature

## Quick Deployment

The easiest way to deploy is using the provided deployment script:

```bash
cd docker
./deploy.sh
```

The script will guide you through the entire deployment process.

## Manual Deployment Steps

If you prefer to deploy manually, follow these steps:

### 1. Set up Google Cloud Project

```bash
# Set your project ID
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com run.googleapis.com secretmanager.googleapis.com containerregistry.googleapis.com
```

### 2. Create Anthropic API Key Secret

```bash
# Create the secret
echo -n "your-anthropic-api-key" | gcloud secrets create anthropic-api-key --data-file=-

# Create service account if needed
gcloud iam service-accounts create cpower-quote-tool \
    --display-name="CPower Quote Tool Service Account"

# Grant access to the secret
gcloud secrets add-iam-policy-binding anthropic-api-key \
    --member="serviceAccount:cpower-quote-tool@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

### 3. Deploy Using Cloud Build

```bash
# From the project root directory (not docker/)
gcloud builds submit \
    --config=docker/cloudbuild.yaml \
    --substitutions=_SERVICE_NAME=cpower-quote-tool,_REGION=us-central1 \
    .
```

### 4. Access Your Deployment

After deployment, you'll receive a service URL like:
```
https://cpower-quote-tool-xxxxx-uc.a.run.app
```

## Configuration Options

### Environment Variables

The following environment variables are configured in the deployment:

- `FLASK_ENV`: Set to "production"
- `PORT`: Set to 8080 (required by Cloud Run)
- `PROMPT_VERSION`: Set to "v2"
- `CLAUDE_MODEL`: Set to "claude-3-haiku-20240307"
- `CLAUDE_MAX_TOKENS`: Set to 2000
- `CLAUDE_TEMPERATURE`: Set to 0.3

### Customizing the Deployment

You can modify the deployment by editing `cloudbuild.yaml`:

- **Region**: Change `_REGION` to deploy to a different region
- **Memory/CPU**: Adjust `_MEMORY` and `_CPU` for different resource allocations
- **Scaling**: Modify `_MIN_INSTANCES` and `_MAX_INSTANCES` for scaling behavior

## Managing Your Deployment

### View Logs

```bash
gcloud run services logs read cpower-quote-tool --region=us-central1
```

### Update the Service

After making changes to your code:

```bash
# Redeploy using Cloud Build
gcloud builds submit --config=docker/cloudbuild.yaml .
```

### Set Traffic Split

To gradually roll out changes:

```bash
gcloud run services update-traffic cpower-quote-tool \
    --region=us-central1 \
    --to-revisions=LATEST=50
```

### Delete the Service

```bash
gcloud run services delete cpower-quote-tool --region=us-central1
```

## Cost Optimization

Cloud Run charges based on:
- CPU and memory usage while handling requests
- Number of requests
- Outbound network traffic

To optimize costs:
1. Set `MIN_INSTANCES=0` to scale to zero when not in use
2. Use appropriate CPU and memory allocations
3. Enable Cloud CDN for static assets

## Security Considerations

1. **API Keys**: Always use Google Secret Manager for sensitive data
2. **Service Account**: Use least-privilege principle for service accounts
3. **Authentication**: Consider adding authentication for production use:
   ```bash
   gcloud run services update cpower-quote-tool \
       --region=us-central1 \
       --no-allow-unauthenticated
   ```

## Troubleshooting

### Common Issues

1. **Port binding errors**: Ensure your app binds to `0.0.0.0:$PORT`
2. **Memory errors**: Increase memory allocation in `cloudbuild.yaml`
3. **Secret access errors**: Verify service account has proper permissions
4. **Build failures**: Check Cloud Build logs in the Console

### Debug Commands

```bash
# Check service status
gcloud run services describe cpower-quote-tool --region=us-central1

# View recent revisions
gcloud run revisions list --service=cpower-quote-tool --region=us-central1

# Check Cloud Build history
gcloud builds list --limit=5
```

## Next Steps

1. **Custom Domain**: Set up a custom domain following https://cloud.google.com/run/docs/mapping-custom-domains
2. **Monitoring**: Enable Cloud Monitoring for production use
3. **CI/CD**: Set up automated deployments with Cloud Build triggers
4. **Load Testing**: Test your deployment's performance under load

## Support

For issues specific to:
- **Application**: Check the application logs
- **Deployment**: Review Cloud Build logs
- **Runtime**: Check Cloud Run logs
- **Secrets**: Verify Secret Manager configuration