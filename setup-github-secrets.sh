#!/bin/bash

# Setup GitHub secrets for CPower Dispatch Automation deployment
REPO="energyprince/customer-dispatch-automation"

echo "Setting up GitHub secrets for $REPO..."
echo ""
echo "This script will help you configure the necessary secrets for GitHub Actions deployment."
echo ""

# Function to prompt for value with a default
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local varname="$3"
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " value
        value="${value:-$default}"
    else
        read -p "$prompt: " value
    fi
    
    eval "$varname='$value'"
}

# Collect values
echo "=== Google Cloud Configuration ==="
prompt_with_default "Enter GCP Project ID" "dispatchautomationai" PROJECT_ID
prompt_with_default "Enter Cloud Run Service Name" "cpower-dispatch-automation" SERVICE_NAME
prompt_with_default "Enter GCP Region" "us-central1" REGION

echo ""
echo "=== Workload Identity Federation ==="
echo "If you haven't set up WIF yet, leave these blank and use service account key instead."
prompt_with_default "Enter WIF Provider (leave blank to skip)" "" WIF_PROVIDER
prompt_with_default "Enter WIF Service Account (leave blank to skip)" "" WIF_SERVICE_ACCOUNT

echo ""
echo "=== Service Account Key (Alternative to WIF) ==="
if [ -z "$WIF_PROVIDER" ] || [ -z "$WIF_SERVICE_ACCOUNT" ]; then
    echo "Since WIF is not configured, you'll need to provide a service account key."
    echo "Paste the contents of your service account JSON key file (or leave blank to skip):"
    echo "Press Ctrl+D when done, or just press Enter to skip."
    SA_KEY=$(cat)
fi

echo ""
echo "=== Setting GitHub Secrets ==="

# Set the secrets
echo "Setting GCP_PROJECT_ID..."
gh secret set GCP_PROJECT_ID --body="$PROJECT_ID" --repo="$REPO"

echo "Setting GCP_SERVICE_NAME..."
gh secret set GCP_SERVICE_NAME --body="$SERVICE_NAME" --repo="$REPO"

echo "Setting GCP_REGION..."
gh secret set GCP_REGION --body="$REGION" --repo="$REPO"

if [ -n "$WIF_PROVIDER" ] && [ -n "$WIF_SERVICE_ACCOUNT" ]; then
    echo "Setting WIF_PROVIDER..."
    gh secret set WIF_PROVIDER --body="$WIF_PROVIDER" --repo="$REPO"
    
    echo "Setting WIF_SERVICE_ACCOUNT..."
    gh secret set WIF_SERVICE_ACCOUNT --body="$WIF_SERVICE_ACCOUNT" --repo="$REPO"
elif [ -n "$SA_KEY" ]; then
    echo "Setting GCP_SA_KEY..."
    echo "$SA_KEY" | gh secret set GCP_SA_KEY --repo="$REPO"
    
    echo ""
    echo "⚠️  You're using a service account key. Remember to update the workflow file:"
    echo "   Replace the 'Authenticate to Google Cloud' step with:"
    echo "   - name: 'Authenticate to Google Cloud'"
    echo "     uses: 'google-github-actions/auth@v2'"
    echo "     with:"
    echo "       credentials_json: \${{ secrets.GCP_SA_KEY }}"
fi

echo ""
echo "✅ GitHub secrets have been configured!"
echo ""
echo "Next steps:"
echo "1. Initialize git in your project: git init"
echo "2. Add the remote: git remote add origin https://github.com/$REPO.git"
echo "3. Add and commit your files: git add . && git commit -m 'Initial commit'"
echo "4. Push to GitHub: git push -u origin main"
echo ""
echo "Your repository: https://github.com/$REPO"
echo "GitHub Actions: https://github.com/$REPO/actions"