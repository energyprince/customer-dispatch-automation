#!/bin/bash

# Check status of CPower Dispatch Automation on Cloud Run

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

echo -e "${GREEN}=== CPower Dispatch Automation Status ===${NC}"
echo ""

# Check if service exists
if ! gcloud run services describe ${SERVICE_NAME} \
    --platform=managed \
    --region=${REGION} \
    --project=${PROJECT_ID} &>/dev/null; then
    echo -e "${RED}Service not found. Please deploy first.${NC}"
    exit 1
fi

# Get service information
echo -e "${YELLOW}Service Information:${NC}"
gcloud run services describe ${SERVICE_NAME} \
    --platform=managed \
    --region=${REGION} \
    --project=${PROJECT_ID} \
    --format="table(
        status.url:label='URL',
        status.latestReadyRevisionName:label='Latest Revision',
        spec.template.spec.containers[0].resources.limits.memory:label='Memory',
        spec.template.spec.containers[0].resources.limits.cpu:label='CPU'
    )"

echo ""
echo -e "${YELLOW}Recent Logs (last 10 entries):${NC}"
gcloud run logs read \
    --service=${SERVICE_NAME} \
    --region=${REGION} \
    --project=${PROJECT_ID} \
    --limit=10 \
    --format="table(timestamp,severity,textPayload)"

echo ""
echo -e "${YELLOW}Active Revisions:${NC}"
gcloud run revisions list \
    --service=${SERVICE_NAME} \
    --platform=managed \
    --region=${REGION} \
    --project=${PROJECT_ID} \
    --format="table(name,status.conditions[0].status:label='Ready',spec.containers[0].image)"

# Test the service
echo ""
echo -e "${YELLOW}Testing service health...${NC}"
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --platform=managed \
    --region=${REGION} \
    --project=${PROJECT_ID} \
    --format='value(status.url)')

# Test main application
if curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/health" | grep -q "200"; then
    echo -e "Main Application: ${GREEN}✓ Healthy${NC}"
else
    echo -e "Main Application: ${RED}✗ Unhealthy${NC}"
fi

# Test AI Assistant
if curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/ai/api/status" | grep -q "200"; then
    echo -e "AI Assistant: ${GREEN}✓ Healthy${NC}"
else
    echo -e "AI Assistant: ${RED}✗ Unhealthy${NC}"
fi

echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "View live logs: gcloud alpha run logs tail --service=${SERVICE_NAME} --region=${REGION} --project=${PROJECT_ID}"
echo "Update traffic: gcloud run services update-traffic ${SERVICE_NAME} --region=${REGION} --project=${PROJECT_ID}"
echo "Delete service: gcloud run services delete ${SERVICE_NAME} --region=${REGION} --project=${PROJECT_ID}"