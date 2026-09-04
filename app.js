const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const dbPath = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Database connection error:", err);
  } else {
    console.log("Connected to SQLite database");
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      event_id INTEGER,
      event_type TEXT,
      budget REAL,
      event_date TEXT,
      venue TEXT,
      guests INTEGER,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(event_id) REFERENCES events(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      company_name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  console.log("Database tables initialized");
}

// Middleware
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "sections"));
app.use(express.static(__dirname));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "your_secret_key_change_this",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 }, // 24 hours
  }),
);

// ========================
// API Routes - Get EJS Files
// ========================

// Get all sections/EJS files
app.get("/api/sections", (req, res) => {
  const fs = require("fs");
  const sectionsPath = path.join(__dirname, "sections");

  fs.readdir(sectionsPath, (err, files) => {
    if (err) {
      return res.status(500).json({ error: "Failed to read sections" });
    }

    const ejsFiles = files.filter((file) => file.endsWith(".ejs"));
    res.json({
      success: true,
      sections: ejsFiles,
      count: ejsFiles.length,
    });
  });
});

// Get specific EJS file content
app.get("/api/sections/:name", (req, res) => {
  const fs = require("fs");
  const sectionName = req.params.name;
  const sectionPath = path.join(__dirname, "sections", `${sectionName}.ejs`);

  fs.readFile(sectionPath, "utf8", (err, data) => {
    if (err) {
      return res.status(404).json({ error: "Section not found" });
    }
    res.json({
      success: true,
      section: sectionName,
      content: data,
    });
  });
});

// ========================
// Main Routes
// ========================

// Home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Render individual sections
app.get("/sections/:name", (req, res) => {
  const sectionName = req.params.name;
  res.render(sectionName, (err, html) => {
    if (err) {
      res.status(404).send("Section not found");
    } else {
      res.send(html);
    }
  });
});

// ========================
// Database Query Examples
// ========================

// Get all events
app.get("/api/events", (req, res) => {
  db.all("SELECT * FROM events", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, events: rows });
  });
});

// Get all vendors
app.get("/api/vendors", (req, res) => {
  db.all(
    "SELECT * FROM vendors WHERE status = ?",
    ["approved"],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, vendors: rows });
    },
  );
});

// Get user bookings
app.get("/api/bookings/user/:userId", (req, res) => {
  const userId = req.params.userId;
  db.all("SELECT * FROM bookings WHERE user_id = ?", [userId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, bookings: rows });
  });
});

// ========================
// Start Server
// ========================

// ========================
// Authentication Routes
// ========================

// Register user
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  if (!username || !email || !password || confirmPassword !== password) {
    return res
      .status(400)
      .json({ error: "Invalid input or passwords don't match" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  db.run(
    "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
    [username, email, hashedPassword, "user"],
    function (err) {
      if (err) {
        return res.status(400).json({ error: "User already exists" });
      }
      req.session.userId = this.lastID;
      req.session.username = username;
      res.json({ success: true, message: "Registration successful" });
    },
  );
});

// Login user
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, user) => {
      if (err || !user) {
        return res.status(400).json({ error: "Invalid username or password" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: "Invalid username or password" });
      }

      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      res.json({
        success: true,
        message: "Login successful",
        user: { id: user.id, username: user.username, role: user.role },
      });
    },
  );
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.json({ success: true, message: "Logged out successfully" });
  });
});

// Check session
app.get("/api/auth/session", (req, res) => {
  if (req.session.userId) {
    res.json({
      loggedIn: true,
      user: {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.role,
      },
    });
  } else {
    res.json({ loggedIn: false });
  }
});

// ========================
// Booking Routes
// ========================

// Submit booking
app.post("/api/bookings/create", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { eventType, budget, eventDate, venue, guests } = req.body;

  db.run(
    "INSERT INTO bookings (user_id, event_type, budget, event_date, venue, guests, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      req.session.userId,
      eventType,
      budget,
      eventDate,
      venue,
      guests,
      "pending",
    ],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        success: true,
        message: "Booking created",
        bookingId: this.lastID,
      });
    },
  );
});

// Get all bookings
app.get("/api/bookings", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  db.all(
    "SELECT * FROM bookings WHERE user_id = ?",
    [req.session.userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, bookings: rows });
    },
  );
});

// ========================
// Vendor Routes
// ========================

// Apply as vendor
app.post("/api/vendors/apply", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { companyName, category, description, phone, email, website } =
    req.body;

  db.run(
    "INSERT INTO vendors (user_id, company_name, category, description, phone, email, website, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      req.session.userId,
      companyName,
      category,
      description,
      phone,
      email,
      website,
      "pending",
    ],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        success: true,
        message: "Application submitted",
        vendorId: this.lastID,
      });
    },
  );
});

// Get all vendors (paginated)
app.get("/api/vendors/all", (req, res) => {
  const page = req.query.page || 1;
  const limit = 12;
  const offset = (page - 1) * limit;

  db.all(
    "SELECT * FROM vendors WHERE status = ? LIMIT ? OFFSET ?",
    ["approved", limit, offset],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, vendors: rows });
    },
  );
});

// Get vendor by category
app.get("/api/vendors/category/:category", (req, res) => {
  const category = req.params.category;

  db.all(
    "SELECT * FROM vendors WHERE category = ? AND status = ?",
    [category, "approved"],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, vendors: rows });
    },
  );
});

// ========================
// Events Routes
// ========================

// Add event (admin only)
app.post("/api/events/create", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { title, description, category, imageUrl } = req.body;

  db.run(
    "INSERT INTO events (title, description, category, image_url) VALUES (?, ?, ?, ?)",
    [title, description, category, imageUrl],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        success: true,
        message: "Event created",
        eventId: this.lastID,
      });
    },
  );
});

// Get events by category
app.get("/api/events/category/:category", (req, res) => {
  const category = req.params.category;

  db.all("SELECT * FROM events WHERE category = ?", [category], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, events: rows });
  });
});

// ========================
// Admin Routes
// ========================

// Get pending vendor applications
app.get("/api/admin/vendors/pending", (req, res) => {
  if (!req.session.userId || req.session.role !== "admin") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  db.all("SELECT * FROM vendors WHERE status = ?", ["pending"], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, applications: rows });
  });
});

// Approve/Reject vendor
app.post("/api/admin/vendors/:vendorId/approve", (req, res) => {
  if (!req.session.userId || req.session.role !== "admin") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const vendorId = req.params.vendorId;
  const status = req.body.status || "approved";

  db.run(
    "UPDATE vendors SET status = ? WHERE id = ?",
    [status, vendorId],
    (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, message: `Vendor ${status}` });
    },
  );
});

// Get dashboard statistics
app.get("/api/admin/stats", (req, res) => {
  if (!req.session.userId || req.session.role !== "admin") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  db.all("SELECT COUNT(*) as count FROM bookings", [], (err, bookingCount) => {
    db.all(
      "SELECT COUNT(*) as count FROM vendors WHERE status = ?",
      ["approved"],
      (err, vendorCount) => {
        db.all("SELECT COUNT(*) as count FROM users", [], (err, userCount) => {
          res.json({
            success: true,
            stats: {
              totalBookings: bookingCount[0].count,
              totalVendors: vendorCount[0].count,
              totalUsers: userCount[0].count,
            },
          });
        });
      },
    );
  });
});

// ========================
// Error Handling
// ========================

app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`API Documentation:`);
  console.log(`- GET / - Home page`);
  console.log(`- GET /api/sections - List all sections`);
  console.log(`- GET /api/events - All events`);
  console.log(`- GET /api/vendors - Approved vendors`);
  console.log(`- POST /api/auth/register - Register user`);
  console.log(`- POST /api/auth/login - Login user`);
  console.log(`- POST /api/bookings/create - Create booking`);
  console.log(`- POST /api/vendors/apply - Apply as vendor`);
});
