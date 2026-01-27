#!/bin/bash

# Script to deploy V+N Valentine's Game to GitHub Pages

echo "🚀 Deploying V+N Valentine's Game to GitHub..."
echo ""

# Check if GitHub username is provided
if [ -z "$1" ]; then
    echo "❌ Please provide your GitHub username as an argument"
    echo "Usage: ./deploy-to-github.sh YOUR_GITHUB_USERNAME"
    echo ""
    echo "Example: ./deploy-to-github.sh nancyprabhakar"
    exit 1
fi

GITHUB_USERNAME=$1
REPO_NAME="v-n-valentines-game"
REPO_URL="https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"

echo "📝 GitHub Username: $GITHUB_USERNAME"
echo "📦 Repository Name: $REPO_NAME"
echo ""

# Check if remote already exists
if git remote get-url origin &>/dev/null; then
    echo "⚠️  Remote 'origin' already exists. Updating..."
    git remote set-url origin $REPO_URL
else
    echo "➕ Adding remote repository..."
    git remote add origin $REPO_URL
fi

# Set branch to main
git branch -M main

echo ""
echo "📤 Pushing to GitHub..."
echo "   (You may be prompted for your GitHub password or token)"
echo ""

# Try to push
if git push -u origin main; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
    echo ""
    echo "🌐 Next steps:"
    echo "   1. Go to: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}/settings/pages"
    echo "   2. Under 'Source', select 'Deploy from a branch'"
    echo "   3. Select 'main' branch and '/ (root)' folder"
    echo "   4. Click 'Save'"
    echo ""
    echo "   Your game will be live at:"
    echo "   https://${GITHUB_USERNAME}.github.io/${REPO_NAME}/"
    echo ""
else
    echo ""
    echo "❌ Push failed. This might mean:"
    echo "   - The repository doesn't exist on GitHub yet"
    echo "   - You need to create it first at: https://github.com/new"
    echo "   - You need to authenticate (use a Personal Access Token)"
    echo ""
    echo "   Create the repository first, then run this script again."
fi
