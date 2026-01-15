import express from "express"
import chalk from "chalk"
import fs from "fs"
import cors from "cors"
import path from "path"
import { fileURLToPath, pathToFileURL } from "url"
import { createRequire } from "module"
import dotenv from "dotenv"
import { WebSocketServer } from "ws"
import cookieParser from "cookie-parser"
import session from "express-session"
import { requireAuthForDashboard } from './src/middleware/auth.js';
import { connectDB } from './src/database/db.js'
import { createLogger } from './src/middleware/logger.js'

const nodeVersion = process.versions.node.split(".")[0]
if (Number.parseInt(nodeVersion) < 20) {
  console.error("\x1b[31m%s\x1b[0m", "╔════════════════════════════════════════════════════════╗")
  console.error("\x1b[31m%s\x1b[0m", "║                   ERROR: NODE.JS VERSION               ║")
  console.error("\x1b[31m%s\x1b[0m", "╚════════════════════════════════════════════════════════╝")
  console.error("\x1b[31m%s\x1b[0m", `[ERROR] You are using Node.js v${process.versions.node}`)
  console.error("\x1b[31m%s\x1b[0m", "[ERROR] Raol-UI requires Node.js v20 or higher to run properly")
  console.error("\x1b[31m%s\x1b[0m", "[ERROR] Please update your Node.js installation and try again")
  console.error("\x1b[31m%s\x1b[0m", "[ERROR] Visit https://nodejs.org to download the latest version")
  console.error("\x1b[31m%s\x1b[0m", "╔════════════════════════════════════════════════════════╗")
  console.error("\x1b[31m%s\x1b[0m", "║                  SHUTTING DOWN...                      ║")
  console.error("\x1b[31m%s\x1b[0m", "╚════════════════════════════════════════════════════════╝")
  process.exit(1)
}

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)

const app = express()
let PORT = process.env.PORT || 3000

console.log(chalk.blue('🔄 Initializing MongoDB connection...'))
connectDB().catch(err => {
  console.error(chalk.red('❌ Initial DB connection failed:'), err)
  process.exit(1)
})

app.enable("trust proxy")
app.set("json spaces", 2)

app.use(cookieParser())
app.use(session({
  secret: process.env.SESSION_SECRET || 'raol-api-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}))

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cors({
  origin: true,
  credentials: true
}))

console.log(chalk.blue('📝 Setting up API Logger...'))
app.use(createLogger())

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("X-Frame-Options", "DENY")
  res.setHeader("X-XSS-Protection", "1; mode=block")
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
  next()
})

app.use("/src/images", express.static(path.join(__dirname, "src", "images")))
app.use("/assets", express.static(path.join(__dirname, "page", "assets")))
app.use("/public", express.static(path.join(__dirname, "public")))

app.get("/assets/styles.css", (req, res) => {
  res.setHeader("Content-Type", "text/css")
  res.sendFile(path.join(__dirname, "page", "docs", "styles.css"))
})

app.get("/assets/script.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript")
  res.sendFile(path.join(__dirname, "page", "docs", "script.js"))
})

app.get("/page/sponsor.json", (req, res) => {
  try {
    const sponsorData = JSON.parse(fs.readFileSync(path.join(__dirname, "src", "sponsor.json"), "utf-8"))
    res.json(sponsorData)
  } catch (error) {
    res.status(500).json({ error: "Failed to load sponsor data" })
  }
})

app.get("/api/preview-image", (req, res) => {
  try {
    const previewImagePath = path.join(__dirname, "src", "images", "preview.png")
    if (fs.existsSync(previewImagePath)) {
      res.setHeader("Content-Type", "image/png")
      res.setHeader("Cache-Control", "public, max-age=86400")
      res.sendFile(previewImagePath)
    } else {
      const bannerPath = path.join(__dirname, "src", "images", "banner.jpg")
      if (fs.existsSync(bannerPath)) {
        res.setHeader("Content-Type", "image/jpeg")
        res.setHeader("Cache-Control", "public, max-age=86400")
        res.sendFile(bannerPath)
      } else {
        const iconPath = path.join(__dirname, "src", "images", "icon.png")
        res.setHeader("Content-Type", "image/png")
        res.setHeader("Cache-Control", "public, max-age=86400")
        res.sendFile(iconPath)
      }
    }
  } catch (error) {
    console.error("Error serving preview image:", error)
    res.status(404).json({ error: "Preview image not found" })
  }
})

app.get("/api/settings", (req, res) => {
  try {
    const settings = JSON.parse(fs.readFileSync(path.join(__dirname, "src", "settings.json"), "utf-8"))
    res.json(settings)
  } catch (error) {
    res.status(500).sendFile(path.join(__dirname, "page", "status", "5xx", "500.html"))
  }
})

app.get("/api/notifications", (req, res) => {
  try {
    const notifications = JSON.parse(fs.readFileSync(path.join(__dirname, "src", "notifications.json"), "utf-8"))
    res.json(notifications)
  } catch (error) {
    res.status(500).sendFile(path.join(__dirname, "page", "status", "5xx", "500.html"))
  }
})

app.get("/support", (req, res) => {
  res.sendFile(path.join(__dirname, "page", "support.html"))
})

app.use((req, res, next) => {
  const blockedPaths = [
    "/page/",
    "/src/settings.json",
    "/src/notifications.json",
    "/page/styles.css",
    "/page/script.js",
  ]
  const isBlocked = blockedPaths.some((blocked) => {
    if (blocked.endsWith("/")) return req.path.startsWith(blocked)
    return req.path === blocked
  })
  if (isBlocked) return res.status(403).sendFile(path.join(__dirname, "page", "status", "4xx", "403.html"))
  next()
})

app.use("/publik", express.static(path.join(__dirname, "publik")))
app.use("/src", (req, res, next) => {
  if (req.path.match(/\.(jpg|jpeg|png|gif|svg|ico)$/i)) {
    express.static(path.join(__dirname, "src"))(req, res, next)
  } else {
    res.status(403).sendFile(path.join(__dirname, "page", "status", "4xx", "403.html"))
  }
})

const settingsPath = path.join(__dirname, "./src/settings.json")
const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"))

app.use((req, res, next) => {
  const originalJson = res.json
  res.json = function (data) {
    if (data && typeof data === "object") {
      const responseData = {
        status: data.status ?? true,
        creator: settings.apiSettings.creator || "RaolByte",
        ...data,
      }
      return originalJson.call(this, responseData)
    }
    return originalJson.call(this, data)
  }
  next()
})

const requestCounts = new Map()
const RATE_LIMIT_WINDOW = 1 * 60 * 1000
const RATE_LIMIT_MAX = 50

app.use((req, res, next) => {
  try {
    const settings = JSON.parse(fs.readFileSync(path.join(__dirname, "./src/settings.json"), "utf-8"))
    const isApiEndpoint = req.path.startsWith('/api/') || 
                         req.path.startsWith('/ai/') || 
                         req.path.startsWith('/random/') || 
                         req.path.startsWith('/maker/')
    if (isApiEndpoint) {
      const endpoint = req.path.replace('/api/', '').replace('/ai/', 'ai/').replace('/random/', 'random/').replace('/maker/', 'maker/')
    }
    if (isApiEndpoint && settings.apiSettings && settings.apiSettings.requireApikey === false) return next()
  } catch (error) {
    console.error("Error loading settings for rate limiting:", error)
  }
  const ip = req.ip || req.connection.remoteAddress
  const now = Date.now()
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
  } else {
    const data = requestCounts.get(ip)
    if (now > data.resetTime) {
      data.count = 1
      data.resetTime = now + RATE_LIMIT_WINDOW
    } else {
      data.count++
      if (data.count > RATE_LIMIT_MAX) {
        return res.status(429).sendFile(path.join(__dirname, "page", "status", "4xx", "429.html"))
      }
    }
  }
  next()
})

setInterval(() => {
  const now = Date.now()
  for (const [ip, data] of requestCounts.entries()) {
    if (now > data.resetTime) requestCounts.delete(ip)
  }
}, RATE_LIMIT_WINDOW)

app.use((req, res, next) => {
  try {
    const settings = JSON.parse(fs.readFileSync(path.join(__dirname, "./src/settings.json"), "utf-8"))
    const skipPaths = ["/api/settings", "/assets/", "/src/", "/api/preview-image", "/src/sponsor.json", "/support"]
    const shouldSkip = skipPaths.some((path) => req.path.startsWith(path))
    if (settings.maintenance && settings.maintenance.enabled && !shouldSkip) {
      if (req.path.startsWith("/api/") || req.path.startsWith("/ai/")) {
        return res.status(503).json({
          status: false,
          error: "Service temporarily unavailable",
          message: "The API is currently under maintenance. Please try again later.",
          maintenance: true,
          creator: settings.apiSettings?.creator || "VGX Team",
        })
      }
      return res.status(503).sendFile(path.join(__dirname, "page", "status", "maintenance", "maintenance.html"))
    }
    next()
  } catch (error) {
    console.error("Error checking maintenance mode:", error)
    next()
  }
})
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "page", "index.html"))
})

app.get("/docs/", (req, res) => {
  res.sendFile(path.join(__dirname, "page", "docs", "index.html"))
})

app.get("/docs/api", (req, res) => {
  res.sendFile(path.join(__dirname, "page", "docs", "api.html"))
})
app.get("/admin/dashboard", requireAuthForDashboard, (req, res) => {
  res.sendFile(path.join(__dirname, "publik", "dashboard.html"))
})
app.get("/api/auth/check", async (req, res) => {
  try {
    if (req.session.userId) {
      const user = await User.findById(req.session.userId).select('-passwordHash');
      if (user) {
        return res.json({ status: true, user });
      }
    }
    res.json({ status: false });
  } catch (error) {
    res.json({ status: false });
  }
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "page", "login.html"))
})

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "page", "register.html"))
})

app.get("/assets/dashboard.css", (req, res) => {
  res.sendFile(path.join(__dirname, "page", "dashboard.css"))
})

app.get("/assets/dashboard.js", (req, res) => {
  res.sendFile(path.join(__dirname, "page", "dashboard.js"))
})

const wss = new WebSocketServer({ noServer: true })
wss.on("connection", (ws) => {
  const sendStats = () => {
    ws.send(JSON.stringify({
      type: "stats",
      data: {
        totalRequests: Math.floor(Math.random() * 1000) + 500,
        requestsLast5Min: Math.floor(Math.random() * 50) + 10,
        activeUsers: Math.floor(Math.random() * 100) + 10,
        timestamp: new Date().toISOString()
      }
    }))
  }
  const interval = setInterval(sendStats, 5000)
  ws.on("close", () => clearInterval(interval))
})

let totalRoutes = 0
const apiFolder = path.join(__dirname, "./src/api")

const loadApiRoutes = async () => {
  const subfolders = fs.readdirSync(apiFolder)
  for (const subfolder of subfolders) {
    const subfolderPath = path.join(apiFolder, subfolder)
    if (fs.statSync(subfolderPath).isDirectory()) {
      const files = fs.readdirSync(subfolderPath)
      for (const file of files) {
        const filePath = path.join(subfolderPath, file)
        if (path.extname(file) === ".js") {
          try {
            const module = await import(pathToFileURL(filePath).href)
            const routeHandler = module.default
            if (typeof routeHandler === "function") {
              routeHandler(app)
              totalRoutes++
              console.log(chalk.bgHex("#FFFF99").hex("#333").bold(` Loaded Route: ${subfolder}/${file} `))
            }
          } catch (error) {
            console.error(`Error loading route ${file}:`, error)
          }
        }
      }
    }
  }
}

const findAvailablePort = (startPort) => {
  return new Promise((resolve) => {
    const server = app
      .listen(startPort, () => {
        const port = server.address().port
        server.close(() => resolve(port))
      })
      .on("error", () => {
        resolve(findAvailablePort(startPort + 1))
      })
  })
}

const startApplication = async () => {
  try {
    await loadApiRoutes()
    
    const authRoute = await import('./src/api/auth/auth.js')
    authRoute.default(app)
    
    const userRoutes = await import('./src/api/user/apikey.js')
    userRoutes.default(app)
    
    PORT = await findAvailablePort(PORT)
    const server = app.listen(PORT, () => {
      console.log(chalk.bgHex("#90EE90").hex("#333").bold(`✅ Server running on port ${PORT}`))
      console.log(chalk.bgHex("#90EE90").hex("#333").bold(`📊 Total Routes Loaded: ${totalRoutes}`))
      console.log(chalk.cyan(`🔗 Login: http://localhost:${PORT}/login`))
      console.log(chalk.cyan(`🔗 Dashboard: http://localhost:${PORT}/admin/dashboard`))
    })

    server.on("upgrade", (req, socket, head) => {
      if (req.url === "/admin/stats/ws") {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit("connection", ws, req)
        })
      } else {
        socket.destroy()
      }
    })

    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully')
      server.close(() => {
        console.log('Process terminated')
        process.exit(0)
      })
    })

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully')
      server.close(() => {
        console.log('Process terminated')
        process.exit(0)
      })
    })

  } catch (error) {
    console.error(chalk.red('❌ Failed to start server:'), error)
    process.exit(1)
  }
}

app.use((err, req, res, next) => {
  console.error(err.stack)
  if (err.status === 400) {
    res.status(400).sendFile(path.join(__dirname, "page", "status", "4xx", "400.html"))
  } else if (err.status === 401) {
    res.status(401).sendFile(path.join(__dirname, "page", "status", "4xx", "401.html"))
  } else if (err.status === 402) {
    res.status(402).sendFile(path.join(__dirname, "page", "status", "4xx", "402.html"))
  } else if (err.status === 403) {
    res.status(403).sendFile(path.join(__dirname, "page", "status", "4xx", "403.html"))
  } else if (err.status === 405) {
    res.status(405).sendFile(path.join(__dirname, "page", "status", "4xx", "405.html"))
  } else if (err.status === 406) {
    res.status(406).sendFile(path.join(__dirname, "page", "status", "4xx", "406.html"))
  } else if (err.status === 407) {
    res.status(407).sendFile(path.join(__dirname, "page", "status", "4xx", "407.html"))
  } else if (err.status === 408) {
    res.status(408).sendFile(path.join(__dirname, "page", "status", "4xx", "408.html"))
  } else if (err.status === 409) {
    res.status(409).sendFile(path.join(__dirname, "page", "status", "4xx", "409.html"))
  } else if (err.status === 410) {
    res.status(410).sendFile(path.join(__dirname, "page", "status", "4xx", "410.html"))
  } else if (err.status === 411) {
    res.status(411).sendFile(path.join(__dirname, "page", "status", "4xx", "411.html"))
  } else if (err.status === 412) {
    res.status(412).sendFile(path.join(__dirname, "page", "status", "4xx", "412.html"))
  } else if (err.status === 413) {
    res.status(413).sendFile(path.join(__dirname, "page", "status", "4xx", "413.html"))
  } else if (err.status === 414) {
    res.status(414).sendFile(path.join(__dirname, "page", "status", "4xx", "414.html"))
  } else if (err.status === 415) {
    res.status(415).sendFile(path.join(__dirname, "page", "status", "4xx", "415.html"))
  } else if (err.status === 416) {
    res.status(416).sendFile(path.join(__dirname, "page", "status", "4xx", "416.html"))
  } else if (err.status === 417) {
    res.status(417).sendFile(path.join(__dirname, "page", "status", "4xx", "417.html"))
  } else if (err.status === 418) {
    res.status(418).sendFile(path.join(__dirname, "page", "status", "4xx", "418.html"))
  } else if (err.status === 421) {
    res.status(421).sendFile(path.join(__dirname, "page", "status", "4xx", "421.html"))
  } else if (err.status === 422) {
    res.status(422).sendFile(path.join(__dirname, "page", "status", "4xx", "422.html"))
  } else if (err.status === 423) {
    res.status(423).sendFile(path.join(__dirname, "page", "status", "4xx", "423.html"))
  } else if (err.status === 424) {
    res.status(424).sendFile(path.join(__dirname, "page", "status", "4xx", "424.html"))
  } else if (err.status === 425) {
    res.status(425).sendFile(path.join(__dirname, "page", "status", "4xx", "425.html"))
  } else if (err.status === 426) {
    res.status(426).sendFile(path.join(__dirname, "page", "status", "4xx", "426.html"))
  } else if (err.status === 428) {
    res.status(428).sendFile(path.join(__dirname, "page", "status", "4xx", "428.html"))
  } else if (err.status === 429) {
    res.status(429).sendFile(path.join(__dirname, "page", "status", "4xx", "429.html"))
  } else if (err.status === 431) {
    res.status(431).sendFile(path.join(__dirname, "page", "status", "4xx", "431.html"))
  } else if (err.status === 451) {
    res.status(451).sendFile(path.join(__dirname, "page", "status", "4xx", "451.html"))
  } else if (err.status === 501) {
    res.status(501).sendFile(path.join(__dirname, "page", "status", "5xx", "501.html"))
  } else if (err.status === 502) {
    res.status(502).sendFile(path.join(__dirname, "page", "status", "5xx", "502.html"))
  } else if (err.status === 503) {
    res.status(503).sendFile(path.join(__dirname, "page", "status", "5xx", "503.html"))
  } else if (err.status === 504) {
    res.status(504).sendFile(path.join(__dirname, "page", "status", "5xx", "504.html"))
  } else if (err.status === 505) {
    res.status(505).sendFile(path.join(__dirname, "page", "status", "5xx", "505.html"))
  } else if (err.status === 506) {
    res.status(506).sendFile(path.join(__dirname, "page", "status", "5xx", "506.html"))
  } else if (err.status === 507) {
    res.status(507).sendFile(path.join(__dirname, "page", "status", "5xx", "507.html"))
  } else if (err.status === 508) {
    res.status(508).sendFile(path.join(__dirname, "page", "status", "5xx", "508.html"))
  } else if (err.status === 510) {
    res.status(510).sendFile(path.join(__dirname, "page", "status", "5xx", "510.html"))
  } else if (err.status === 511) {
    res.status(511).sendFile(path.join(__dirname, "page", "status", "5xx", "511.html"))
  } else {
    res.status(500).sendFile(path.join(__dirname, "page", "status", "5xx", "500.html"))
  }
})

startApplication()

export default app
