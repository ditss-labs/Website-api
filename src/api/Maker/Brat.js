import axios from "axios";
import { createApiKeyMiddleware } from "../../middleware/apikey.js";

export default (app) => {
  async function getBratImage(text) {
    try {
      const encodedText = encodeURIComponent(text);
      const urls = [
        `https://aqul-brat.hf.space/?text=${encodedText}`,
        `https://api-faa.my.id/faa/brathd?text=${encodedText}`,
        `https://izukumii-brat.hf.space/api?text=${encodedText}`,
      ];

      const shuffledUrls = urls.sort(() => Math.random() - 0.5);
      let imageBuffer = null;

      for (let url of shuffledUrls) {
        try {
          console.log(`[INFO] Mencoba URL (acak): ${url}`);
          const response = await axios.get(url, {
            responseType: "arraybuffer",
            timeout: 10000,
          });
          imageBuffer = Buffer.from(response.data);
          if (imageBuffer && imageBuffer.length > 0) {
            console.log("[SUCCESS] Gambar berhasil diambil.");
            break;
          }
        } catch (err) {
          console.warn(`[WARN] Gagal mengambil gambar dari: ${url} - ${err.message}`);
        }
      }

      if (!imageBuffer) {
        throw new Error("Semua API gagal digunakan.");
      }

      return imageBuffer;
    } catch (error) {
      throw error;
    }
  }
async function getBratVideo(text, format = "mp4") {
  try {
    const background = "#ffffff";   
    const color = "#000000";        
    const emojiStyle = "apple";
    const delay = Math.floor(Math.random() * (2000 - 100 + 1)) + 100;        // 100–2000
    const endDelay = Math.floor(Math.random() * (5000 - 500 + 1)) + 500;     // 500–5000
    const width = Math.floor(Math.random() * (1000 - 100 + 1)) + 100;        // 100–1000
    const height = Math.floor(Math.random() * (1000 - 100 + 1)) + 100;       // 100–1000

    const baseUrl = `https://brat.siputzx.my.id/${format}`;
    const url = `${baseUrl}?text=${encodeURIComponent(text)}&background=${background}&color=${color}&emojiStyle=${emojiStyle}&delay=${delay}&endDelay=${endDelay}&width=${width}&height=${height}`;

    console.log("[Brat Video Request]", url);

    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 20000,
    });

    return Buffer.from(response.data);
  } catch (error) {
    throw new Error(`Gagal generate video Brat: ${error.message}`);
  }
}
  app.get("/v1/maker/brat", createApiKeyMiddleware(), async (req, res) => {
    try {
      const text = req.query.text || req.body?.text;
      if (!text) {
        return res.status(400).json({ status: false, error: "Text is required" });
      }
      const imageBuffer = await getBratImage(text);
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": imageBuffer.length,
      });
      res.end(imageBuffer);
    } catch (error) {
      console.error("[ERROR] " + error.message);
      res.status(500).json({
        status: false,
        error: error.message || "Failed to generate BRAT image",
      });
    }
  });

  app.post("/v2/maker/brat", createApiKeyMiddleware(), async (req, res) => {
    try {
      const text = req.query.text || req.body?.text;

      if (!text) {
        return res.status(400).json({ status: false, error: "Text is required" });
      }

      const imageBuffer = await getBratImage(text);

      res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": imageBuffer.length,
      });
      res.end(imageBuffer);
    } catch (error) {
      console.error("[ERROR] " + error.message);
      res.status(500).json({
        status: false,
        error: error.message || "Failed to generate BRAT image",
      });
    }
  });

  app.get("/v1/maker/bratvid", createApiKeyMiddleware(), async (req, res) => {
    try {
      const text = req.query.text || req.body?.text;

      if (!text) {
        return res.status(400).json({ status: false, error: "Text is required" });
      }

      const videoBuffer = await getBratVideo(text, "mp4");

      res.writeHead(200, {
        "Content-Type": "video/mp4",
        "Content-Length": videoBuffer.length,
      });
      res.end(videoBuffer);
    } catch (error) {
      console.error("[ERROR] " + error.message);
      res.status(500).json({
        status: false,
        error: error.message || "Failed to generate BRAT video",
      });
    }
  });

  app.post("/v2/maker/bratvid", createApiKeyMiddleware(), async (req, res) => {
    try {
      const text = req.query.text || req.body?.text;

      if (!text) {
        return res.status(400).json({ status: false, error: "Text is required" });
      }

      const videoBuffer = await getBratVideo(text, "mp4");

      res.writeHead(200, {
        "Content-Type": "video/mp4",
        "Content-Length": videoBuffer.length,
      });
      res.end(videoBuffer);
    } catch (error) {
      console.error("[ERROR] " + error.message);
      res.status(500).json({
        status: false,
        error: error.message || "Failed to generate BRAT video",
      });
    }
  });
};
        
