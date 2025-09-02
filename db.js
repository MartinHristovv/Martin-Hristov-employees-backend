const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./employee.db", (err) => {
  if (err) console.error(err.message);
  else console.log("Connected to SQLite database.");
});

// Create table if not exists
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS EmployeeProject (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      EmpID INTEGER,
      ProjectID INTEGER,
      DateFrom TEXT,
      DateTo TEXT
    )
  `);
});

module.exports = db;
