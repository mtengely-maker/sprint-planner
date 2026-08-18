const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbPath = path.join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Hiba az adatbázis megnyitásakor:', err.message);
    } else {
        console.log('Kapcsolódva a SQLite adatbázishoz.');

        db.serialize(() => {
            db.run(`
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT,
                    manday REAL,
                    project_name TEXT,
                    week_number TEXT,
                    url TEXT,
                    completed INTEGER DEFAULT 0
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS projects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS developer_capacities (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sprint_key TEXT,
                    developer_name TEXT,
                    manday REAL
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS milestones (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT,
                    date TEXT,
                    type TEXT,
                    project_name TEXT
                )
            `);
        });
    }
});
