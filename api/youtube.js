// YouTube API client for extracting video metadata

const axios = require("axios");

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

if (!YOUTUBE_API_KEY) {
  console.warn("YOUTUBE_API_KEY not set. YouTube metadata extraction will fail.");
}

/**
 * Extract YouTube video ID from various URL formats
 * @param {string} urlOrId - YouTube URL or video ID
 * @returns {string|null} Video ID or null if invalid
 */
function extractYouTubeId(urlOrId) {
  if (!urlOrId) return null;

  // If it's already just an ID (11 characters)
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) {
    return urlOrId;
  }

  // Extract from various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
    /youtube\.com\/embed\/([^"&?\/\s]{11})/,
    /youtube\.com\/v\/([^"&?\/\s]{11})/,
  ];

  for (const pattern of patterns) {
    const match = urlOrId.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Fetch video metadata from YouTube Data API
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Object>} Video metadata
 */
async function fetchVideoMetadata(videoId) {
  if (!YOUTUBE_API_KEY) {
    throw new Error("YOUTUBE_API_KEY is not configured");
  }

  if (!videoId) {
    throw new Error("Video ID is required");
  }

  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/videos`, {
      params: {
        part: "snippet",
        id: videoId,
        key: YOUTUBE_API_KEY,
      },
    });

    if (!response.data.items || response.data.items.length === 0) {
      throw new Error(`Video not found: ${videoId}`);
    }

    const item = response.data.items[0];
    const snippet = item.snippet;

    // Extract published date
    const publishedAt = new Date(snippet.publishedAt);
    const year = publishedAt.getFullYear();
    const date = publishedAt.toISOString().split("T")[0].substring(0, 4); // YYYY format

    // Get thumbnail (prefer maxres, fallback to high)
    const thumbnail =
      snippet.thumbnails.maxres?.url ||
      snippet.thumbnails.high?.url ||
      snippet.thumbnails.medium?.url ||
      snippet.thumbnails.default?.url ||
      "";

    return {
      title: snippet.title,
      description: snippet.description || "",
      thumbnail: thumbnail,
      date: date,
      year: year,
      publishedAt: snippet.publishedAt,
      channelTitle: snippet.channelTitle,
    };
  } catch (error) {
    if (error.response) {
      throw new Error(
        `YouTube API error: ${error.response.status} - ${error.response.data?.error?.message || error.message}`
      );
    }
    throw new Error(`Failed to fetch YouTube metadata: ${error.message}`);
  }
}

/**
 * Extract metadata from YouTube URL
 * @param {string} url - YouTube URL
 * @returns {Promise<Object>} Video metadata
 */
async function getMetadataFromUrl(url) {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    throw new Error("Invalid YouTube URL or video ID");
  }

  return await fetchVideoMetadata(videoId);
}

module.exports = {
  extractYouTubeId,
  fetchVideoMetadata,
  getMetadataFromUrl,
};

