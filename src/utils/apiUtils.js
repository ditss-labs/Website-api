import axios from "axios"

export function formatResponseTime(ms) {
  return `${Math.round(ms)}ms`
}

export function sendResponse(req, res, statusCode, data, version = 'v1') {
  const responseTime = Date.now() - req.startTime
  const requestId = req.headers['x-vercel-id'] || `asuma-${Date.now()}`

  const response = {
    status: statusCode === 200 || statusCode === 201,
    version: version,
    creator: "DitssGanteng",
    requestId: requestId,
    responseTime: formatResponseTime(responseTime),
    ...data
  }

  res.status(statusCode).json(response)
}

export async function getBuffer(url) {
  const response = await axios.get(url, { responseType: "arraybuffer" })
  return response.data
}

export async function uploadToCDN(imageUrl, folder = null) {
  try {
    let apiUrl;
    if (folder) {
      apiUrl = `https://cdn.ditss.biz.id/uploadUrl?url=${encodeURIComponent(imageUrl)}&folder=${folder}`;
    } else {
      apiUrl = `https://cdn.ditss.biz.id/uploadUrl?url=${encodeURIComponent(imageUrl)}`;
    }
    
    const { data } = await axios.get(apiUrl, { timeout: 60000 });
    return data.url;
  } catch (error) {
    console.error('CDN upload failed:', error.message);
    return imageUrl;
  }
}
