// Video management endpoints

const { z } = require("zod");
const {
  applyCors,
  enforceRateLimit,
  getRequestContext,
  logInfo,
  logError,
} = require("../utils");
const { verifyToken } = require("./auth");
const {
  readVideosJson,
  writeVideosJson,
  getNextVideoId,
} = require("../github");
const { getMetadataFromUrl, extractYouTubeId } = require("../youtube");

const videoSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().default(""),
  thumbnail: z.string().default(""),
  videoUrl: z.string().min(1, "Video URL is required"),
  youtubeId: z.string().optional(),
  date: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  year: z.number().int().positive(),
});

const youtubeVideoSchema = z.object({
  url: z.string().url("Invalid YouTube URL"),
  category: z.string().min(1, "Category is required").default("Family"),
  date: z.string().optional(),
});

const updateVideoSchema = videoSchema.partial().extend({
  id: z.number().int().positive(),
});

// GET /api/admin/videos - List all videos
async function handleGet(req, res) {
  try {
    const { videos } = await readVideosJson();
    return res.status(200).json({ data: videos });
  } catch (err) {
    logError("GET /admin/videos error", err, getRequestContext(req));
    return res.status(500).json({ error: "Failed to fetch videos" });
  }
}

// POST /api/admin/videos/youtube - Add YouTube video
async function handlePostYouTube(req, res) {
  try {
    const validation = youtubeVideoSchema.safeParse(req.body ?? {});
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: validation.error.flatten().fieldErrors,
      });
    }

    const { url, category, date } = validation.data;

    // Extract metadata from YouTube
    const metadata = await getMetadataFromUrl(url);
    const videoId = extractYouTubeId(url);

    // Read current videos.json
    const { videos, sha } = await readVideosJson();

    // Generate next ID
    const nextId = await getNextVideoId();

    // Create new video entry
    const newVideo = {
      id: nextId,
      title: metadata.title,
      description: metadata.description,
      thumbnail: metadata.thumbnail,
      videoUrl: url,
      youtubeId: videoId,
      date: date || metadata.date,
      category: category,
      year: metadata.year,
    };

    // Add to videos array
    videos.push(newVideo);

    // Commit to GitHub
    const commitMessage = `Add video: ${metadata.title}`;
    await writeVideosJson(videos, sha, commitMessage);

    logInfo("Added YouTube video", {
      videoId: nextId,
      title: metadata.title,
    });

    return res.status(201).json({
      data: newVideo,
      message: "Video added successfully",
    });
  } catch (err) {
    logError("POST /admin/videos/youtube error", err, getRequestContext(req));
    if (err.message.includes("YouTube API") || err.message.includes("Invalid YouTube")) {
      return res.status(400).json({ error: err.message });
    }
    // Return the actual error message instead of generic one
    return res.status(500).json({ 
      error: err.message || "Failed to add video",
      details: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
  }
}

// POST /api/admin/videos/local - Add local video file
async function handlePostLocal(req, res) {
  try {
    // For now, we'll accept JSON with file URL
    // File upload handling would require multipart/form-data parsing
    const body = req.body ?? {};
    
    const localVideoSchema = z.object({
      title: z.string().min(1, "Title is required"),
      description: z.string().default(""),
      thumbnail: z.string().default(""),
      videoUrl: z.string().min(1, "Video URL is required"),
      date: z.string().optional(),
      category: z.string().min(1, "Category is required"),
      year: z.number().int().positive(),
    });

    const validation = localVideoSchema.safeParse(body);
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: validation.error.flatten().fieldErrors,
      });
    }

    const videoData = validation.data;

    // Read current videos.json
    const { videos, sha } = await readVideosJson();

    // Generate next ID
    const nextId = await getNextVideoId();

    // Create new video entry
    const newVideo = {
      id: nextId,
      ...videoData,
    };

    // Add to videos array
    videos.push(newVideo);

    // Commit to GitHub
    const commitMessage = `Add video: ${videoData.title}`;
    await writeVideosJson(videos, sha, commitMessage);

    logInfo("Added local video", {
      videoId: nextId,
      title: videoData.title,
    });

    return res.status(201).json({
      data: newVideo,
      message: "Video added successfully",
    });
  } catch (err) {
    logError("POST /admin/videos/local error", err, getRequestContext(req));
    return res.status(500).json({ 
      error: err.message || "Failed to add video",
      details: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
  }
}

// PUT /api/admin/videos/:id - Update video
async function handlePut(req, res) {
  try {
    const urlParts = req.url.split("/");
    const videoId = parseInt(urlParts[urlParts.length - 1], 10);

    if (isNaN(videoId)) {
      return res.status(400).json({ error: "Invalid video ID" });
    }

    const validation = updateVideoSchema.safeParse({
      ...req.body,
      id: videoId,
    });
    if (!validation.success) {
      return res.status(400).json({
        error: "Invalid input",
        details: validation.error.flatten().fieldErrors,
      });
    }

    // Read current videos.json
    const { videos, sha } = await readVideosJson();

    // Find video index
    const videoIndex = videos.findIndex((v) => v.id === videoId);
    if (videoIndex === -1) {
      return res.status(404).json({ error: "Video not found" });
    }

    // Update video
    const updatedVideo = {
      ...videos[videoIndex],
      ...validation.data,
      id: videoId, // Ensure ID doesn't change
    };
    videos[videoIndex] = updatedVideo;

    // Commit to GitHub
    const commitMessage = `Update video: ${updatedVideo.title}`;
    await writeVideosJson(videos, sha, commitMessage);

    logInfo("Updated video", { videoId, title: updatedVideo.title });

    return res.status(200).json({
      data: updatedVideo,
      message: "Video updated successfully",
    });
  } catch (err) {
    logError("PUT /admin/videos/:id error", err, getRequestContext(req));
    return res.status(500).json({ 
      error: err.message || "Failed to update video",
      details: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
  }
}

// DELETE /api/admin/videos/:id - Delete video
async function handleDelete(req, res) {
  try {
    const urlParts = req.url.split("/");
    const videoId = parseInt(urlParts[urlParts.length - 1], 10);

    if (isNaN(videoId)) {
      return res.status(400).json({ error: "Invalid video ID" });
    }

    // Read current videos.json
    const { videos, sha } = await readVideosJson();

    // Find video
    const videoIndex = videos.findIndex((v) => v.id === videoId);
    if (videoIndex === -1) {
      return res.status(404).json({ error: "Video not found" });
    }

    const deletedVideo = videos[videoIndex];

    // Remove video
    videos.splice(videoIndex, 1);

    // Commit to GitHub
    const commitMessage = `Delete video: ${deletedVideo.title}`;
    await writeVideosJson(videos, sha, commitMessage);

    logInfo("Deleted video", { videoId, title: deletedVideo.title });

    return res.status(200).json({
      message: "Video deleted successfully",
    });
  } catch (err) {
    logError("DELETE /admin/videos/:id error", err, getRequestContext(req));
    return res.status(500).json({ 
      error: err.message || "Failed to delete video",
      details: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
  }
}

module.exports = async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const requestMeta = getRequestContext(req);

  if (!enforceRateLimit(requestMeta, res)) return;

  // Verify authentication (except for OPTIONS)
  const token = verifyToken(req, res);
  if (!token) return; // Response already sent by verifyToken

  // Route to appropriate handler
  if (req.method === "GET") {
    return handleGet(req, res);
  } else if (req.method === "POST") {
    // Check if it's YouTube or local video
    const body = req.body ?? {};
    if (body.url && (body.url.includes("youtube.com") || body.url.includes("youtu.be") || /^[a-zA-Z0-9_-]{11}$/.test(body.url))) {
      return handlePostYouTube(req, res);
    } else {
      return handlePostLocal(req, res);
    }
  } else if (req.method === "PUT") {
    return handlePut(req, res);
  } else if (req.method === "DELETE") {
    return handleDelete(req, res);
  } else {
    res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE", "OPTIONS"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }
}

