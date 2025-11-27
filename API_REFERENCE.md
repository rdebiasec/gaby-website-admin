# API Reference

Quick reference for all API endpoints.

## Base URL

After deployment to Vercel:
```
https://gaby-website-admin.vercel.app
```

## Authentication

All endpoints except `/api/admin/login` require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

Get a token by calling the login endpoint first.

---

## Endpoints

### POST /api/admin/login

**Description:** Authenticate and get JWT token

**Request:**
```bash
POST /api/admin/login
Content-Type: application/json

{
  "password": "your-password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": 1704067200000
}
```

---

### GET /api/admin/videos

**Description:** List all videos

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
      "title": "Video Title",
      "description": "Description",
      "thumbnail": "https://...",
      "videoUrl": "https://...",
      "date": "2024",
      "category": "Family",
      "year": 2024
    }
  ]
}
```

---

### POST /api/admin/videos/youtube

**Description:** Add YouTube video (auto-detects if URL contains youtube.com or youtu.be)

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
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
    "title": "Video Title",
    "description": "Description",
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

---

### POST /api/admin/videos/local

**Description:** Add local video file

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "title": "My Video",
  "description": "Description",
  "thumbnail": "/videos/thumbnails/thumb.jpg",
  "videoUrl": "/videos/video.mp4",
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
    ...
  },
  "message": "Video added successfully"
}
```

---

### PUT /api/admin/videos/:id

**Description:** Update video

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "title": "Updated Title",
  "description": "Updated description"
}
```

**Response:**
```json
{
  "data": {
    "id": 1,
    "title": "Updated Title",
    ...
  },
  "message": "Video updated successfully"
}
```

---

### DELETE /api/admin/videos/:id

**Description:** Delete video

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

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid input",
  "details": {
    "fieldName": ["Error message"]
  }
}
```

### 401 Unauthorized
```json
{
  "error": "Invalid password"
}
```
or
```json
{
  "error": "Missing or invalid authorization header"
}
```

### 404 Not Found
```json
{
  "error": "Video not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Too many requests"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to add video"
}
```

---

## Example Usage

### JavaScript/TypeScript

```typescript
const API_URL = 'https://gaby-website-admin.vercel.app/api/admin';

// Login
const loginRes = await fetch(`${API_URL}/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: 'your-password' })
});
const { token } = await loginRes.json();

// Add YouTube video
const addRes = await fetch(`${API_URL}/videos`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    url: 'https://www.youtube.com/watch?v=VIDEO_ID',
    category: 'Family'
  })
});
const result = await addRes.json();
```

### cURL

```bash
# Login
TOKEN=$(curl -X POST https://gaby-website-admin.vercel.app/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your-password"}' | jq -r '.token')

# List videos
curl -H "Authorization: Bearer $TOKEN" \
  https://gaby-website-admin.vercel.app/api/admin/videos

# Add YouTube video
curl -X POST https://gaby-website-admin.vercel.app/api/admin/videos \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=VIDEO_ID","category":"Family"}'
```

