const express = require("express");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const db = require("./db");
const cors = require("cors");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
dayjs.extend(customParseFormat);

const app = express();

app.use(cors());

const PORT = 5000;

const upload = multer({ dest: "uploads/" });

app.get("/", (req, res) => {
  res.send("Employee Collaboration API is running");
});

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");

  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (data) => {
      if (Object.values(data).some((v) => v && v.trim() !== "")) {
        const row = {};
        for (const key in data) row[key] = data[key].trim();
        results.push(row);
      }
    })
    .on("end", () => {
      db.serialize(() => {
        db.run("DELETE FROM EmployeeProject");

        const stmt = db.prepare(
          "INSERT INTO EmployeeProject (EmpID, ProjectID, DateFrom, DateTo) VALUES (?, ?, ?, ?)"
        );

        results.forEach((row) => {
          stmt.run(row.EmpID, row.ProjectID, row.DateFrom, row.DateTo || null);
        });

        stmt.finalize(() => {
          fs.unlinkSync(req.file.path);
          res.send("CSV uploaded and saved");
        });
      });
    });
});

app.get("/pair-projects", (req, res) => {
  db.all("SELECT * FROM EmployeeProject", [], (err, rows) => {
    if (err) return res.status(500).send(err.message);

    const projects = {};
    rows.forEach((row) => {
      const { EmpID, ProjectID, DateFrom, DateTo } = row;
      if (!projects[ProjectID]) projects[ProjectID] = [];
      projects[ProjectID].push({
        EmpID,
        DateFrom: dayjs(DateFrom, "YYYY-MM-DD"),
        DateTo: DateTo ? dayjs(DateTo, "YYYY-MM-DD") : dayjs(),
      });
    });

    const result = [];

    Object.entries(projects).forEach(([projectID, employees]) => {
      for (let i = 0; i < employees.length; i++) {
        for (let j = i + 1; j < employees.length; j++) {
          const e1 = employees[i];
          const e2 = employees[j];

          const start = e1.DateFrom.isAfter(e2.DateFrom)
            ? e1.DateFrom
            : e2.DateFrom;
          const end = e1.DateTo.isBefore(e2.DateTo) ? e1.DateTo : e2.DateTo;
          const diff = end.diff(start, "day");

          if (diff > 0) {
            result.push({
              Emp1: e1.EmpID,
              Emp2: e2.EmpID,
              ProjectID: projectID,
              daysWorked: diff,
            });
          }
        }
      }
    });
    result.sort(
      (a, b) => a.ProjectID - b.ProjectID || a.Emp1 - b.Emp1 || a.Emp2 - b.Emp2
    );

    res.send(result);
  });
});

// Start server
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
