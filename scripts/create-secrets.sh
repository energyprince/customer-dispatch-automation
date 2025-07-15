#!/bin/bash

# Create Google Cloud Secrets for CPower Dispatch Automation
# This script creates all required secrets from the .env file

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ID="dispatchautomationai"
SERVICE_ACCOUNT_NAME="cpower-dispatch"

echo -e "${GREEN}=== Creating Secrets for CPower Dispatch Automation ===${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please create a .env file with your configuration"
    exit 1
fi

# Source the .env file
export $(cat .env | grep -v '^#' | xargs)

# Function to create or update a secret
create_secret() {
    SECRET_NAME=$1
    SECRET_VALUE=$2
    
    echo -n "Creating secret ${SECRET_NAME}... "
    
    # Check if secret exists
    if gcloud secrets describe ${SECRET_NAME} --project=${PROJECT_ID} &>/dev/null; then
        # Update existing secret
        echo -n "${SECRET_VALUE}" | gcloud secrets versions add ${SECRET_NAME} \
            --project=${PROJECT_ID} \
            --data-file=-
        echo -e "${GREEN}updated${NC}"
    else
        # Create new secret
        echo -n "${SECRET_VALUE}" | gcloud secrets create ${SECRET_NAME} \
            --project=${PROJECT_ID} \
            --replication-policy="automatic" \
            --data-file=-
        echo -e "${GREEN}created${NC}"
        
        # Grant access to service account
        gcloud secrets add-iam-policy-binding ${SECRET_NAME} \
            --project=${PROJECT_ID} \
            --member="serviceAccount:${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
            --role="roles/secretmanager.secretAccessor" \
            --quiet
    fi
}

echo -e "${YELLOW}Creating secrets from .env file...${NC}"

# Anthropic API Key
create_secret "anthropic-api-key" "${ANTHROPIC_API_KEY}"

# SMTP Configuration
create_secret "smtp-host" "${SMTP_HOST}"
create_secret "smtp-port" "${SMTP_PORT}"
create_secret "smtp-user" "${SMTP_USER}"
create_secret "smtp-password" "${SMTP_PASSWORD}"

# Email Monitoring (IMAP)
create_secret "email-user" "${EMAIL_USER}"
create_secret "email-password" "${EMAIL_PASSWORD}"
create_secret "email-host" "${EMAIL_HOST}"
create_secret "email-port" "${EMAIL_PORT:-993}"

# Portal Configuration
create_secret "portal-url" "${PORTAL_URL}"
create_secret "portal-username" "${PORTAL_USERNAME}"
create_secret "portal-password" "${PORTAL_PASSWORD}"

# Optional: Test email
if [ ! -z "${TEST_EMAIL}" ]; then
    create_secret "test-email" "${TEST_EMAIL}"
fi

echo ""
echo -e "${GREEN}=== All secrets created successfully ===${NC}"
echo ""
echo "Secrets created:"
gcloud secrets list --project=${PROJECT_ID} --format="table(name,createTime)"