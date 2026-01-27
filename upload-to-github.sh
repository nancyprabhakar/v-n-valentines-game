#!/bin/bash

echo "💝 V+N Valentine's Game - GitHub Upload"
echo "========================================"
echo ""

# Prompt for GitHub username
read -p "Enter your GitHub username: " GITHUB_USERNAME

if [ -z "$GITHUB_USERNAME" ]; then
    echo "❌ Username cannot be empty!"
    exit 1
fi

REPO_NAME="v-n-valentines-game"
REPO_URL="https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"

echo ""
echo "📝 Repository will be: $REPO_URL"
echo ""
echo "⚠️  IMPORTANT: You must create this repository on GitHub first!"
echo "   Go to: https://github.com/new"
echo "   Name it: $REPO_NAME"
echo "   Make it PUBLIC"
echo "   Don't add README, .gitignore, or license"
echo ""
read -p "Press Enter after you've created the repository on GitHub..."

# Remove existing remote if it exists
git remote remove origin 2>/dev/null

# Add remote
echo ""
echo "➕ Adding remote repository..."
git remote add origin $REPO_URL

# Set branch to main
git branch -M main

# Push
echo ""
echo "📤 Pushing code to GitHub..."
echo "   (You'll be prompted for your GitHub password/token)"
echo ""

if git push -u origin main; then
    echo ""
    echo "✅ Success! Code pushed to GitHub!"
    echo ""
    echo "🌐 Now enable GitHub Pages:"
    echo "   1. Go to: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}/settings/pages"
    echo "   2. Source: Deploy from a branch"
    echo "   3. Branch: main, Folder: / (root)"
    echo "   4. Click Save"
    echo ""
    echo "   Your game will be live at:"
    echo "   👉 https://${GITHUB_USERNAME}.github.io/${REPO_NAME}/"
    echo ""
else
    echo ""
    echo "❌ Push failed. Make sure:"
    echo "   - Repository exists on GitHub"
    echo "   - You're using a Personal Access Token (not password)"
    echo "   - Token has 'repo' permissions"
    echo ""
    echo "   Get a token at: https://github.com/settings/tokens"
fi
