import http from "http";
import { MongoClient, ObjectId } from "mongodb";
import url from "url";
import jwt from "jsonwebtoken";

const PORT = 3000; // porta do backend
const MONGO_URI = "mongodb://localhost:27017";
const DB_NAME = "yearbook";
const JWT_SECRET = "super_secreto"; // muda em produção

const client = new MongoClient(MONGO_URI);
await client.connect();
const db = client.db(DB_NAME);
const usersCollection = db.collection("users");

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const { pathname } = parsedUrl;

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === "/register" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", async () => {
      const { username, email, password } = JSON.parse(body);
      if (!username || !email || !password) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "Campos em falta" }));
        return;
      }
      const exists = await usersCollection.findOne({ email });
      if (exists) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ success: false, message: "Email já registado" })
        );
        return;
      }
      const result = await usersCollection.insertOne({
        username,
        email,
        password,
      });
      const token = jwt.sign({ id: result.insertedId, email }, JWT_SECRET, {
        expiresIn: "1h",
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, token }));
    });
  } else if (pathname === "/login" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", async () => {
      const { username, password } = JSON.parse(body);
      if (!username || !password) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "Campos em falta" }));
        return;
      }
      const user = await usersCollection.findOne({ username, password });
      if (!user) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ success: false, message: "Credenciais inválidas" })
        );
        return;
      }
      const token = jwt.sign(
        { id: user._id, username: user.username },
        JWT_SECRET,
        { expiresIn: "1h" }
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, token }));
    });
  } else if (pathname === "/profile" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", async () => {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith("Bearer ")) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "Token em falta" }));
        return;
      }
      const token = auth.split(" ")[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { fullname, course, year } = JSON.parse(body);
        await usersCollection.updateOne(
          { _id: new ObjectId(decoded.id) },
          { $set: { fullname, course, year } }
        );
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, message: "Token inválido" }));
      }
    });
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, message: "Rota não encontrada" }));
  }
});

server.listen(PORT, () =>
  console.log(`Backend a correr em http://localhost:${PORT}`)
);
