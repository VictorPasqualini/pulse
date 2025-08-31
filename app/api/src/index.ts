import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma";


const app = express();
app.use(cors());
app.use(express.json());


app.get("/health", (_req, res) => res.json({ ok: true }));


app.get("/users", async (_req, res) => {
    const users = await prisma.user.findMany();
    res.json(users);
});


app.post("/users", async (req, res) => {
    const { name, email, password } = req.body as { name: string; email: string; password: string };
    if (!name || !email || !password) return res.status(400).json({ error: "Campos obrigatórios" });
    // Em produção: use bcrypt para hashear a senha
    const user = await prisma.user.create({ data: { name, email, passwordHash: password } });
    res.status(201).json({ id: user.id, name: user.name, email: user.email });
});


const port = Number(process.env.PORT ?? 3333);
app.listen(port, () => console.log(`API on http://localhost:${port}`));