import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("attendance.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    department TEXT,
    role TEXT
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    type TEXT CHECK(type IN ('IN', 'OUT')),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(employee_id) REFERENCES employees(id)
  );
`);

// Seed data if empty
const employeeCount = db.prepare("SELECT COUNT(*) as count FROM employees").get() as { count: number };
if (employeeCount.count === 0) {
  const insert = db.prepare("INSERT INTO employees (name, department, role) VALUES (?, ?, ?)");
  insert.run("Somchai Jaidee", "IT", "Developer");
  insert.run("Somsri Rakdee", "HR", "Manager");
  insert.run("Wichai Chuenjai", "Sales", "Sales Representative");
  insert.run("Anong Sookjai", "Marketing", "Designer");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const wss = new WebSocketServer({ server });

  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });

  const broadcast = (data: any) => {
    const message = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  // API Routes
  app.get("/api/employees", (req, res) => {
    const employees = db.prepare("SELECT * FROM employees").all();
    res.json(employees);
  });

  app.get("/api/logs", (req, res) => {
    const logs = db.prepare(`
      SELECT logs.*, employees.name as employee_name, employees.department 
      FROM logs 
      JOIN employees ON logs.employee_id = employees.id 
      ORDER BY timestamp DESC 
      LIMIT 50
    `).all();
    res.json(logs);
  });

  app.get("/api/status", (req, res) => {
    // Get current status of all employees (last log type)
    const status = db.prepare(`
      SELECT e.id, e.name, e.department, e.role,
      (SELECT type FROM logs WHERE employee_id = e.id ORDER BY timestamp DESC LIMIT 1) as current_status,
      (SELECT timestamp FROM logs WHERE employee_id = e.id ORDER BY timestamp DESC LIMIT 1) as last_event
      FROM employees e
    `).all();
    res.json(status);
  });

  app.post("/api/check", (req, res) => {
    const { employeeId, type } = req.body;
    if (!employeeId || !type) {
      return res.status(400).json({ error: "Missing employeeId or type" });
    }

    const info = db.prepare("INSERT INTO logs (employee_id, type) VALUES (?, ?)").run(employeeId, type);
    const logId = info.lastInsertRowid;

    const newLog = db.prepare(`
      SELECT logs.*, employees.name as employee_name, employees.department 
      FROM logs 
      JOIN employees ON logs.employee_id = employees.id 
      WHERE logs.id = ?
    `).get(logId);

    broadcast({ type: "NEW_LOG", data: newLog });
    res.json({ success: true, log: newLog });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }
}

startServer();
