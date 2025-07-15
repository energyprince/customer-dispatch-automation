#!/bin/bash

# Google Cloud Setup Script for CPower Dispatch Automation
# This script sets up a new Google Cloud project with all required services

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Project configuration
PROJECT_ID="dispatchautomationai"
PROJECT_NAME="CPower Dispatch Automation"
REGION="us-central1"
SERVICE_ACCOUNT_NAME="cpower-dispatch"

echo -e "${GREEN}=== Google Cloud Setup for CPower Dispatch Automation ===${NC}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    echo "Please install it first:"
    echo "  brew install google-cloud-sdk"
    echo "  or"
    echo "  curl https://sdk.cloud.google.com | bash"
    exit 1
fi

# 1. Login to Google Cloud
echo -e "${YELLOW}Step 1: Authenticating with Google Cloud${NC}"
gcloud auth login

# 2. Use existing project
echo -e "${YELLOW}Step 2: Using existing project ${PROJECT_ID}${NC}"
if gcloud projects describe ${PROJECT_ID} &>/dev/null; then
    echo -e "${GREEN}Project ${PROJECT_ID} found${NC}"
else
    echo -e "${RED}Error: Project ${PROJECT_ID} not found${NC}"
    exit 1
fi

# Set the project as default
gcloud config set project ${PROJECT_ID}

# 3. Check billing
echo -e "${YELLOW}Step 3: Checking billing account${NC}"
BILLING_ACCOUNTS=$(gcloud alpha billing accounts list --format="value(name)" --limit=1)
if [ -z "$BILLING_ACCOUNTS" ]; then
    echo -e "${RED}Error: No billing account found${NC}"
    echo "Please set up billing at: https://console.cloud.google.com/billing"
    exit 1
else
    echo "Found billing account: $BILLING_ACCOUNTS"
    gcloud alpha billing projects link ${PROJECT_ID} --billing-account=${BILLING_ACCOUNTS}
    echo -e "${GREEN}Billing account linked${NC}"
fi

# 4. Enable required APIs
echo -e "${YELLOW}Step 4: Enabling required APIs${NC}"
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable compute.googleapis.com
echo -e "${GREEN}APIs enabled successfully${NC}"

# 5. Create service account
echo -e "${YELLOW}Step 5: Creating service account${NC}"
if gcloud iam service-accounts describe ${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com &>/dev/null; then
    echo "Service account already exists"
else
    gcloud iam service-accounts create ${SERVICE_ACCOUNT_NAME} \
        --display-name="CPower Dispatch Service Account" \
        --description="Service account for CPower Dispatch Automation on Cloud Run"
    echo -e "${GREEN}Service account created${NC}"
fi

# Grant necessary roles to service account
echo "Granting roles to service account..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/run.invoker"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# 6. Set up application default credentials
echo -e "${YELLOW}Step 6: Setting up application default credentials${NC}"
gcloud auth application-default login

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Run ./scripts/create-secrets.sh to create secrets"
echo "2. Run ./scripts/deploy.sh to deploy the application"
echo ""
echo "Project ID: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service Account: ${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"