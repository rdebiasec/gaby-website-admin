# Setup Guide

This guide will walk you through setting up and deploying the Admin API.

## Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the **"+"** icon in the top right corner
3. Select **"New repository"**
4. Fill in the details:
   - **Repository name:** `gaby-website-admin`
   - **Description:** "Admin API for managing videos on Gabriella's memorial website"
   - **Visibility:** Choose **Public** or **Private**
   - **DO NOT** check "Initialize with README" (we already have files)
5. Click **"Create repository"**

## Step 2: Connect Local Repository to GitHub

After creating the repository, GitHub will show you commands. Use these:

```bash
cd /Users/ricardodebiase/Documents/gaby-website-admin

# Add the remote repository (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/gaby-website-admin.git

# Push to GitHub
git push -u origin main
```

If you already have a remote configured, you can update it:

```bash
git remote set-url origin https://github.com/YOUR_USERNAME/gaby-website-admin.git
git push -u origin main
```

## Step 3: Get Required API Keys

### YouTube API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **"YouTube Data API v3"**:
   - Go to "APIs & Services" → "Library"
   - Search for "YouTube Data API v3"
   - Click "Enable"
4. Create credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy the API key
   - (Optional) Restrict the API key to YouTube Data API v3

### GitHub Personal Access Token

1. Go to GitHub Settings → [Developer settings](https://github.com/settings/developers)
2. Click **"Personal access tokens"** → **"Tokens (classic)"**
3. Click **"Generate new token (classic)"**
4. Give it a name: `Gaby Website Admin`
5. Select expiration (recommended: 90 days or custom)
6. Select scope: **`repo`** (Full control of private repositories)
7. Click **"Generate token"**
8. **Copy the token immediately** (you won't be able to see it again)

## Step 4: Deploy to Vercel

1. Go to [Vercel](https://vercel.com) and sign in (or create an account)
2. Click **"Add New Project"**
3. Import the `gaby-website-admin` repository:
   - Select the repository from the list
   - Click **"Import"**
4. Configure the project:
   - **Framework Preset:** Other (or leave default)
   - **Root Directory:** `./` (default)
   - Click **"Deploy"** (we'll add environment variables after)
5. After deployment, go to **Project Settings** → **Environment Variables**
6. Add the following variables:

| Variable Name | Value | Notes |
|--------------|-------|-------|
| `ADMIN_PASSWORD` | Your secure password | Choose a strong password |
| `YOUTUBE_API_KEY` | Your YouTube API key | From Step 3 |
| `GITHUB_TOKEN` | Your GitHub token | From Step 3 |
| `GITHUB_REPO_OWNER` | `rdebiasec` | Repository owner |
| `GITHUB_REPO_NAME` | `gabriellas-website` | Repository name |
| `JWT_SECRET` | Random secure string | Generate with: `openssl rand -base64 32` |
| `ALLOWED_ORIGINS` | Your website URL | e.g., `https://yourdomain.com` or `*` for all |

7. After adding all variables, go to **Deployments** and click **"Redeploy"** on the latest deployment

## Step 5: Test the API

After deployment, Vercel will provide a URL like:
```
https://gaby-website-admin.vercel.app
```

Test the login endpoint:

```bash
curl -X POST https://gaby-website-admin.vercel.app/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your-admin-password"}'
```

You should receive a response with a `token` and `expiresAt`.

## Step 6: Update Main Website

You'll need to update the main website (`gabriella-memorial`) to:
1. Add an admin panel UI at `/admin` route
2. Connect it to this API using the base URL from Vercel

See the main website repository for admin panel implementation.

## Troubleshooting

### "Repository not found" when pushing
- Make sure you've created the repository on GitHub first
- Verify the repository name matches exactly
- Check that you're using the correct GitHub username

### "Invalid password" when testing
- Verify `ADMIN_PASSWORD` is set correctly in Vercel
- Make sure you're using the exact password (case-sensitive)

### "YOUTUBE_API_KEY is not configured"
- Check that the environment variable is set in Vercel
- Verify the API key is valid and YouTube Data API v3 is enabled

### "GITHUB_TOKEN must be defined"
- Check that `GITHUB_TOKEN` is set in Vercel
- Verify the token has `repo` scope

### CORS errors
- Check that `ALLOWED_ORIGINS` includes your website domain
- Use `*` for development (not recommended for production)

## Next Steps

1. ✅ Repository created and code pushed
2. ✅ API deployed to Vercel
3. ✅ Environment variables configured
4. ⏭️ Create admin panel UI in main website
5. ⏭️ Test end-to-end video management flow

