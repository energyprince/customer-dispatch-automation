#!/bin/bash

# Deploy CPower Dispatch Automation to Google Cloud Run
# This script builds and deploys the application

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_ID="dispatchautomationai"
SERVICE_NAME="cpower-dispatch-automation"
REGION="us-central1"

echo -e "${GREEN}=== Deploying CPower Dispatch Automation to Cloud Run ===${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Deployment options
echo -e "${YELLOW}Deployment Options:${NC}"
echo "1. Deploy using Cloud Build (recommended)"
echo "2. Deploy directly from source"
echo "3. Build locally and deploy"
echo ""
read -p "Select option (1-3): " DEPLOY_OPTION

case $DEPLOY_OPTION in
    1)
        echo -e "${YELLOW}Deploying using Cloud Build...${NC}"
        gcloud builds submit --config=cloudbuild.yaml --project=${PROJECT_ID}
        ;;
    
    2)
        echo -e "${YELLOW}Deploying directly from source...${NC}"
        gcloud run deploy ${SERVICE_NAME} \
            --source=. \
            --project=${PROJECT_ID} \
            --platform=managed \
            --region=${REGION} \
            --allow-unauthenticated \
            --port=8080 \
            --memory=4Gi \
            --cpu=2 \
            --timeout=900 \
            --concurrency=80 \
            --min-instances=1 \
            --max-instances=10 \
            --service-account=${SERVICE_NAME}@${PROJECT_ID}.iam.gserviceaccount.com \
            --set-env-vars="NODE_ENV=production,TZ=America/New_York" \
            --set-secrets="ANTHROPIC_API_KEY=anthropic-api-key:latest,SMTP_HOST=smtp-host:latest,SMTP_PORT=smtp-port:latest,SMTP_USER=smtp-user:latest,SMTP_PASSWORD=smtp-password:latest,EMAIL_USER=email-user:latest,EMAIL_PASSWORD=email-password:latest,EMAIL_HOST=email-host:latest,EMAIL_PORT=email-port:latest,PORTAL_URL=portal-url:latest,PORTAL_USERNAME=portal-username:latest,PORTAL_PASSWORD=portal-password:latest"
        ;;
    
    3)
        echo -e "${YELLOW}Building Docker image locally...${NC}"
        
        # Build the image
        docker build -t gcr.io/${PROJECT_ID}/${SERVICE_NAME} -f docker/Dockerfile .
        
        # Configure Docker to use gcloud credentials
        gcloud auth configure-docker
        
        # Push the image
        echo -e "${YELLOW}Pushing image to Container Registry...${NC}"
        docker push gcr.io/${PROJECT_ID}/${SERVICE_NAME}
        
        # Deploy from the pushed image
        echo -e "${YELLOW}Deploying to Cloud Run...${NC}"
        gcloud run deploy ${SERVICE_NAME} \
            --image=gcr.io/${PROJECT_ID}/${SERVICE_NAME} \
            --project=${PROJECT_ID} \
            --platform=managed \
            --region=${REGION} \
            --allow-unauthenticated \
            --port=8080 \
            --memory=4Gi \
            --cpu=2 \
            --timeout=900 \
            --concurrency=80 \
            --min-instances=1 \
            --max-instances=10 \
            --service-account=${SERVICE_NAME}@${PROJECT_ID}.iam.gserviceaccount.com \
            --set-env-vars="NODE_ENV=production,TZ=America/New_York" \
            --set-secrets="ANTHROPIC_API_KEY=anthropic-api-key:latest,SMTP_HOST=smtp-host:latest,SMTP_PORT=smtp-port:latest,SMTP_USER=smtp-user:latest,SMTP_PASSWORD=smtp-password:latest,EMAIL_USER=email-user:latest,EMAIL_PASSWORD=email-password:latest,EMAIL_HOST=email-host:latest,EMAIL_PORT=email-port:latest,PORTAL_URL=portal-url:latest,PORTAL_USERNAME=portal-username:latest,PORTAL_PASSWORD=portal-password:latest"
        ;;
    
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

# Get the service URL
echo ""
echo -e "${YELLOW}Getting service information...${NC}"
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --platform=managed \
    --region=${REGION} \
    --project=${PROJECT_ID} \
    --format='value(status.url)')

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo -e "${BLUE}Service URLs:${NC}"
echo "Main Application: ${SERVICE_URL}"
echo "AI Assistant: ${SERVICE_URL}/ai/"
echo ""
echo -e "${BLUE}View logs:${NC}"
echo "gcloud run logs read --service=${SERVICE_NAME} --region=${REGION} --project=${PROJECT_ID}"
echo ""
echo -e "${BLUE}Monitor the service:${NC}"
echo "https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}/metrics?project=${PROJECT_ID}"