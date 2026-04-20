
const express = require("express");
const axios   = require("axios");
const cors    = require("cors");
const path    = require("path");

const app  = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Import your existing api functions directly
const fetchHandler    = require("./api/fetch");
const downloadHandler = require("./api/download");

app.get("/api/fetch",    fetchHandler);
app.get("/api/download", downloadHandler);

app.listen(PORT, () => {
  console.log(`\n🔥 InstaDown running at http://localhost:${PORT}\n`);
});
