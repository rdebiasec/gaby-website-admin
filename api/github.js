// GitHub API client for reading and writing videos.json

const { Octokit } = require("@octokit/rest");

const config = {
  owner: process.env.GITHUB_REPO_OWNER || "rdebiasec",
  repo: process.env.GITHUB_REPO_NAME || "gabriellas-website",
  path: "public/data/videos.json",
  token: process.env.GITHUB_TOKEN,
};

if (!config.token) {
  throw new Error("GITHUB_TOKEN must be defined");
}

const octokit = new Octokit({
  auth: config.token,
});

/**
 * Read videos.json from GitHub repository
 * @returns {Promise<Array>} Array of video objects
 */
async function readVideosJson() {
  try {
    const response = await octokit.repos.getContent({
      owner: config.owner,
      repo: config.repo,
      path: config.path,
    });

    if (response.data.type !== "file") {
      throw new Error("Path is not a file");
    }

    // Decode base64 content
    const content = Buffer.from(response.data.content, "base64").toString(
      "utf-8"
    );
    const videos = JSON.parse(content);

    return {
      videos,
      sha: response.data.sha, // Required for updating the file
    };
  } catch (error) {
    if (error.status === 404) {
      // File doesn't exist, return empty array
      return { videos: [], sha: null };
    }
    throw error;
  }
}

/**
 * Write videos.json to GitHub repository
 * @param {Array} videos - Array of video objects
 * @param {string} sha - SHA of the current file (for update)
 * @param {string} message - Commit message
 * @returns {Promise<Object>} GitHub API response
 */
async function writeVideosJson(videos, sha, message) {
  try {
    // Encode content to base64
    const content = JSON.stringify(videos, null, 2);
    const encodedContent = Buffer.from(content, "utf-8").toString("base64");

    const params = {
      owner: config.owner,
      repo: config.repo,
      path: config.path,
      message: message,
      content: encodedContent,
      branch: "main",
    };

    // Include sha if updating existing file
    if (sha) {
      params.sha = sha;
    }

    const response = await octokit.repos.createOrUpdateFileContents(params);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to write videos.json: ${error.message}`);
  }
}

/**
 * Get next available video ID
 * @returns {Promise<number>} Next available ID
 */
async function getNextVideoId() {
  const { videos } = await readVideosJson();
  if (videos.length === 0) {
    return 1;
  }
  const maxId = Math.max(...videos.map((v) => v.id || 0));
  return maxId + 1;
}

module.exports = {
  readVideosJson,
  writeVideosJson,
  getNextVideoId,
};

