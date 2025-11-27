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
      console.log(JSON.stringify({
        level: "info",
        message: "videos.json not found, returning empty array",
        timestamp: new Date().toISOString(),
        path: config.path,
      }));
      return { videos: [], sha: null };
    }
    
    // Log read errors
    console.error(JSON.stringify({
      level: "error",
      message: "Failed to read videos.json from GitHub",
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        status: error.status,
        responseData: error.response?.data,
      },
    }));
    
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

    // Log the attempt (without sensitive data)
    console.log(JSON.stringify({
      level: "info",
      message: "Attempting to write videos.json to GitHub",
      timestamp: new Date().toISOString(),
      videoCount: videos.length,
      hasSha: !!sha,
      commitMessage: message,
      path: config.path,
      repo: `${config.owner}/${config.repo}`,
    }));

    const response = await octokit.repos.createOrUpdateFileContents(params);
    
    // Log success
    console.log(JSON.stringify({
      level: "info",
      message: "Successfully wrote videos.json to GitHub",
      timestamp: new Date().toISOString(),
      commitSha: response.data.commit?.sha,
      contentSha: response.data.content?.sha,
    }));

    return response.data;
  } catch (error) {
    // Extract detailed error information
    const errorDetails = {
      message: error.message,
      status: error.status,
      name: error.name,
    };

    // Try to get response data if available
    if (error.response) {
      errorDetails.responseStatus = error.response.status;
      errorDetails.responseData = error.response.data;
      errorDetails.responseHeaders = error.response.headers;
    }

    // Try to get request info if available
    if (error.request) {
      errorDetails.requestUrl = error.request.url;
      errorDetails.requestMethod = error.request.method;
    }

    // Log full error details
    console.error(JSON.stringify({
      level: "error",
      message: "Failed to write videos.json to GitHub",
      timestamp: new Date().toISOString(),
      error: errorDetails,
      stack: error.stack,
    }));

    // Throw error with more context
    const errorMessage = errorDetails.responseData?.message 
      ? `GitHub API error: ${errorDetails.responseData.message}`
      : `Failed to write videos.json: ${error.message}`;
    
    throw new Error(errorMessage);
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

