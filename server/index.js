import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 2376;
const DB_PATH = path.join(__dirname, '..', 'checker', 'metrics.db');

app.use(express.json());

let db;

async function connectDB() {
    try {
        db = await open({
            filename: DB_PATH,
            mode: sqlite3.OPEN_READONLY,
            driver: sqlite3.Database
        });
        console.log('SQLite access approved (Read-Only).');
    } catch (err) {
        console.error('DB error:', err.message);
        process.exit(1);
    }
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token exists.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token.' });
        }
        req.user = user;
        next();
    });
}

app.post('/api/auth/login', async (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Enter password' });
    }

    const isMatch = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
    
    if (!isMatch) {
        return res.status(401).json({ error: 'Wrong password' });
    }

    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
});

app.get('/api/metrics/recent', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT * FROM system_metrics 
            WHERE timestamp >= datetime('now', '-1 day') 
            ORDER BY timestamp ASC
        `;
        const rows = await db.all(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'An error accured during reading DB', details: err.message });
    }
});

connectDB().then(() => {
    app.listen(PORT, () => { 
        console.log(`Server started successfully ${PORT}`);
    });
});