#!/bin/bash

# git_pull_cron_task.sh
# Updates all repositories configured in .env by running git pull on each
# Usage: ./git_pull_cron_task.sh

set -e

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "Error: .env file not found in current directory"
    echo "Please ensure you're running this script from the changelogger directory"
    exit 1
fi

# Load environment variables from .env
export $(grep -v '^#' .env | xargs)

# Check if REPOS is configured
if [ -z "$REPOS" ]; then
    echo "Error: REPOS environment variable not found in .env"
    echo "Please configure REPOS with a comma-separated list of repository names"
    exit 1
fi

# Use REPOS_BASE_PATH if set, otherwise use current directory
BASE_PATH="${REPOS_BASE_PATH:-.}"

echo "Starting git pull for all configured repositories..."
echo "Base path: $BASE_PATH"
echo "Repositories: $REPOS"
echo

# Convert comma-separated REPOS into array
IFS=',' read -ra REPO_ARRAY <<< "$REPOS"

# Track success/failure
SUCCESS_COUNT=0
FAILURE_COUNT=0
FAILED_REPOS=""

# Process each repository
for repo in "${REPO_ARRAY[@]}"; do
    # Trim whitespace
    repo=$(echo "$repo" | xargs)
    repo_path="$BASE_PATH/$repo"
    
    echo "Processing: $repo"
    
    # Check if repository directory exists
    if [ ! -d "$repo_path" ]; then
        echo "  ❌ Directory not found: $repo_path"
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
        FAILED_REPOS="$FAILED_REPOS $repo"
        echo
        continue
    fi
    
    # Check if it's a git repository
    if [ ! -d "$repo_path/.git" ]; then
        echo "  ❌ Not a git repository: $repo_path"
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
        FAILED_REPOS="$FAILED_REPOS $repo"
        echo
        continue
    fi
    
    # Change to repository directory and pull
    cd "$repo_path"
    
    if git pull; then
        echo "  ✅ Successfully updated"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo "  ❌ Failed to pull"
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
        FAILED_REPOS="$FAILED_REPOS $repo"
    fi
    
    echo
    
    # Return to original directory
    cd - > /dev/null
done

# Summary
echo "============================================"
echo "Git pull summary:"
echo "  ✅ Successful: $SUCCESS_COUNT"
echo "  ❌ Failed: $FAILURE_COUNT"

if [ $FAILURE_COUNT -gt 0 ]; then
    echo "  Failed repositories:$FAILED_REPOS"
fi

echo "============================================"

# Exit with error code if any failures occurred
if [ $FAILURE_COUNT -gt 0 ]; then
    exit 1
fi

echo "All repositories updated successfully!"