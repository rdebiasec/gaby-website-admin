# Gaby Website Admin API

Serverless API for managing videos on Gabriella's memorial website. This API provides authenticated endpoints to add, update, and delete videos, automatically committing changes to the main website repository via GitHub API.

## Overview

This API allows administrators to:
- Add YouTube videos by URL (automatically extracts metadata)
- Add local video files
- Update existing videos
- Delete videos
- List all videos

All changes are automatically committed to the `gabriellas-website` repository's `videos.json` file via GitHub API.

## Architecture

- **Deployment**: Vercel (serverless functions)
- **Authentication**: JWT tokens (password-based login)
- **Data Source**: GitHub repository (`public/data/videos.json`)
- **External APIs**: YouTube Data API v3, GitHub REST API

## Project Structure

```
gaby-website-admin/
├── api/
│   ├── admin/
│   │   ├── login.js          # Password authentication
│   │   ├── auth.js           # JWT verification middleware
│   │   └── videos.js         # Video CRUD operations
│   ├── github.js             # GitHub API client
│   ├── youtube.js            # YouTube API client
│   └── utils.js              # Shared utilities (CORS, rate limiting, logging)
├── package.json
├── README.md
└── .gitignore
```

## API Endpoints

### POST /api/admin/login

Authenticate admin user with password.

**Request Body:**
```json
{
  "password": "your-admin-password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": 1704067200000
}
```

**Status Codes:**
- `200` - Success
- `401` - Invalid password
- `400` - Invalid input
- `429` - Rate limit exceeded

---

### GET /api/admin/videos

List all videos from `videos.json`.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "title": "Beautiful Memories",
      "description": "A collection of precious moments",
      "thumbnail": "https://...",
      "videoUrl": "https://...",
      "date": "2020",
      "category": "Family",
      "year": 2020
    }
  ]
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized
- `500` - Server error

---

### POST /api/admin/videos/youtube

Add a YouTube video by URL. Automatically extracts metadata from YouTube.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "category": "Family",
  "date": "2024"
}
```

**Response:**
```json
{
  "data": {
    "id": 4,
    "title": "Video Title from YouTube",
    "description": "Video description from YouTube",
    "thumbnail": "https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg",
    "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
    "youtubeId": "VIDEO_ID",
    "date": "2024",
    "category": "Family",
    "year": 2024
  },
  "message": "Video added successfully"
}
```

**Status Codes:**
- `201` - Video added successfully
- `400` - Invalid YouTube URL or missing metadata
- `401` - Unauthorized
- `500` - Server error

**Notes:**
- The `url` field accepts full YouTube URLs or just the video ID
- Metadata (title, description, thumbnail, published date) is automatically extracted
- The `category` field is required but defaults to "Family" if not provided
- The `date` field is optional and will use the video's publish date if not provided

---

### POST /api/admin/videos/local

Add a local video file.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "My Video",
  "description": "Video description",
  "thumbnail": "/videos/thumbnails/my-video-thumb.jpg",
  "videoUrl": "/videos/my-video.mp4",
  "date": "2024",
  "category": "Family",
  "year": 2024
}
```

**Response:**
```json
{
  "data": {
    "id": 5,
    "title": "My Video",
    "description": "Video description",
    "thumbnail": "/videos/thumbnails/my-video-thumb.jpg",
    "videoUrl": "/videos/my-video.mp4",
    "date": "2024",
    "category": "Family",
    "year": 2024
  },
  "message": "Video added successfully"
}
```

**Status Codes:**
- `201` - Video added successfully
- `400` - Invalid input
- `401` - Unauthorized
- `500` - Server error

**Notes:**
- The video file must already be uploaded to `public/videos/` in the repository
- The `videoUrl` should be a relative path starting with `/videos/`
- All fields except `description` and `thumbnail` are required

---

### PUT /api/admin/videos/:id

Update an existing video.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "category": "Celebration"
}
```

**Response:**
```json
{
  "data": {
    "id": 1,
    "title": "Updated Title",
    "description": "Updated description",
    "category": "Celebration",
    ...
  },
  "message": "Video updated successfully"
}
```

**Status Codes:**
- `200` - Video updated successfully
- `400` - Invalid input
- `401` - Unauthorized
- `404` - Video not found
- `500` - Server error

**Notes:**
- Only include fields you want to update
- The `id` field cannot be changed

---

### DELETE /api/admin/videos/:id

Delete a video.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Video deleted successfully"
}
```

**Status Codes:**
- `200` - Video deleted successfully
- `401` - Unauthorized
- `404` - Video not found
- `500` - Server error

---

## Environment Variables

Configure these in your Vercel project settings:

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `ADMIN_PASSWORD` | Password for admin login | `your-secure-password` |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key | `AIzaSy...` |
| `GITHUB_TOKEN` | GitHub Personal Access Token (repo scope) | `ghp_...` |
| `GITHUB_REPO_OWNER` | GitHub repository owner | `rdebiasec` |
| `GITHUB_REPO_NAME` | GitHub repository name | `gabriellas-website` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret for signing JWT tokens | `change-me-in-production` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | `*` |

## Setup Instructions

### 1. Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and create a new repository named `gaby-website-admin`
2. Set it to Public (or Private if preferred)
3. Copy the repository URL

### 2. Local Setup

```bash
# Navigate to the project directory
cd /Users/ricardodebiase/Documents/gaby-website-admin

# Install dependencies
npm install

# Connect to GitHub (replace with your repository URL)
git remote add origin https://github.com/YOUR_USERNAME/gaby-website-admin.git
git branch -M main
git add .
git commit -m "Initial commit"
git push -u origin main
```

### 3. Get YouTube API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the "YouTube Data API v3"
4. Create credentials (API Key)
5. Copy the API key

### 4. Get GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name (e.g., "Gaby Website Admin")
4. Select scope: `repo` (full control of private repositories)
5. Generate and copy the token

### 5. Deploy to Vercel

1. Go to [Vercel](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import the `gaby-website-admin` repository
4. Configure environment variables:
   - Add all required environment variables from the table above
   - Set `JWT_SECRET` to a secure random string
   - Set `ALLOWED_ORIGINS` to your website domain (e.g., `https://yourdomain.com`)
5. Deploy

### 6. Get API Base URL

After deployment, Vercel will provide a URL like:
```
https://gaby-website-admin.vercel.app
```

Your API endpoints will be:
- `https://gaby-website-admin.vercel.app/api/admin/login`
- `https://gaby-website-admin.vercel.app/api/admin/videos`
- etc.

## Security Features

1. **Password Authentication**: Simple password check against environment variable
2. **JWT Tokens**: Signed tokens with 24-hour expiration
3. **Rate Limiting**: 10 requests per minute per IP address
4. **CORS Protection**: Configurable allowed origins
5. **Input Validation**: All inputs validated with Zod schemas
6. **Error Handling**: Proper error responses without exposing sensitive data

## Rate Limiting

- **Limit**: 10 requests per minute per IP address
- **Window**: 60 seconds
- **Response**: `429 Too Many Requests` when limit exceeded

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message"
}
```

For validation errors:

```json
{
  "error": "Invalid input",
  "details": {
    "fieldName": ["Error message"]
  }
}
```

## Video Schema

Videos follow this schema:

```typescript
interface Video {
  id: number                    // Auto-generated, unique
  title: string                 // Required
  description: string          // Optional, defaults to ""
  thumbnail: string            // Optional, defaults to ""
  videoUrl: string             // Required (YouTube URL or local path)
  youtubeId?: string           // Optional, auto-extracted for YouTube videos
  date?: string                // Optional, format: "YYYY"
  category: string             // Required
  year: number                 // Required, extracted from date or YouTube publish date
}
```

## GitHub API Integration

The API automatically:
1. Reads `public/data/videos.json` from the GitHub repository
2. Parses the JSON content
3. Updates the video array (add/update/delete)
4. Commits the changes back to the repository
5. GitHub Actions automatically rebuilds and deploys the website

**Commit Messages:**
- `Add video: [title]` - When adding a new video
- `Update video: [title]` - When updating a video
- `Delete video: [title]` - When deleting a video

## YouTube Integration

The API uses YouTube Data API v3 to extract:
- **Title**: Video title
- **Description**: Video description
- **Thumbnail**: Highest quality thumbnail available
- **Published Date**: Used to set `date` and `year` fields

**Supported URL Formats:**
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- Just the video ID: `VIDEO_ID`

## Troubleshooting

### "YOUTUBE_API_KEY is not configured"
- Make sure you've added `YOUTUBE_API_KEY` to Vercel environment variables
- Verify the API key is valid and YouTube Data API v3 is enabled

### "GITHUB_TOKEN must be defined"
- Make sure you've added `GITHUB_TOKEN` to Vercel environment variables
- Verify the token has `repo` scope

### "Video not found" (YouTube)
- Check that the YouTube URL is valid
- Verify the video is public (private videos cannot be accessed via API)

### "Failed to write videos.json"
- Check that `GITHUB_TOKEN` has write permissions
- Verify `GITHUB_REPO_OWNER` and `GITHUB_REPO_NAME` are correct
- Check that the repository exists and is accessible

### Authentication fails
- Verify `ADMIN_PASSWORD` is set correctly in Vercel
- Check that `JWT_SECRET` is set (should be a secure random string)
- Ensure you're sending the token in the `Authorization: Bearer <token>` header

## Development

### Local Testing

To test locally, you can use a tool like `vercel dev` or set up a simple Express server:

```bash
# Install Vercel CLI
npm i -g vercel

# Run local development server
vercel dev
```

Or use a simple test script:

```javascript
// test-api.js
const axios = require('axios');

const API_URL = 'http://localhost:3000/api/admin';

async function test() {
  // Login
  const loginRes = await axios.post(`${API_URL}/login`, {
    password: process.env.ADMIN_PASSWORD
  });
  const token = loginRes.data.token;

  // Get videos
  const videosRes = await axios.get(`${API_URL}/videos`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log(videosRes.data);
}

test();
```

## RAG FAQ Scraper

The repository now includes `scripts/ragFaqScraper.js`, a configurable pipeline that crawls the public site and turns each page (or SPA view) into Retrieval-Augmented Generation (RAG) friendly FAQ rows.

```bash
node scripts/ragFaqScraper.js \
  --url https://gabriella-jose.com \
  --siteName "Gabriella Jose" \
  --seedPaths "/" \
  --spaViews "timeline=Cronología,photos=Fotos,videos=Videos,wall=Muro,book=Libro" \
  --maxPages 12 \
  --output data/gabriella_faq.json
```

Key flags:

- `--url`: starting URL to crawl (required)
- `--seedPaths`: comma-separated list of additional server paths to enqueue
- `--spaViews`: `id=Label` pairs that tell the scraper how to click SPA navigation buttons (enables client-rendered pages like Timeline or Photos)
- `--maxPages`, `--maxFaqs`, `--minSectionChars`: knobs for controlling crawl size and FAQ density
- `--renderWithBrowser=false`: disable Puppeteer rendering if you only need static HTML

The latest dataset for `gabriella-jose.com` lives at `data/gabriella_faq.json` and includes crawl metrics plus the normalized FAQ array that can be fed directly into a RAG index.

## License

ISC

## Support

For issues or questions, please refer to the main website repository or create an issue in this repository.

