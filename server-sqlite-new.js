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
        return;
    }

    console.log('Kapcsolódva a SQLite adatbázishoz:', dbPath);

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

        db.run(`ALTER TABLE tasks ADD COLUMN url TEXT`, () => {});
        db.run(`ALTER TABLE tasks ADD COLUMN completed INTEGER DEFAULT 0`, () => {});

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
});

function sendError(res, err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Ismeretlen szerverhiba' });
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        storage: 'sqlite',
        database: 'database.sqlite'
    });
});

// Tasks
app.get('/api/tasks', (req, res) => {
    db.all(
        `SELECT id, title, manday, project_name, week_number, url, completed FROM tasks ORDER BY id ASC`,
        [],
        (err, rows) => {
            if (err) return sendError(res, err);
            res.json(rows || []);
        }
    );
});

app.post('/api/tasks', (req, res) => {
    const {
        title,
        manday,
        project_name,
        week_number,
        url
    } = req.body;

    db.run(
        `
        INSERT INTO tasks (
            title,
            manday,
            project_name,
            week_number,
            url,
            completed
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
            title || 'Névtelen feladat',
            parseFloat(manday) || 1,
            project_name || 'Általános',
            week_number || 'backlog',
            url || '',
            0
        ],
        function(err) {
            if (err) return sendError(res, err);

            res.json({
                id: this.lastID,
                title: title || 'Névtelen feladat',
                manday: parseFloat(manday) || 1,
                project_name: project_name || 'Általános',
                week_number: week_number || 'backlog',
                url: url || '',
                completed: 0
            });
        }
    );
});

app.put('/api/tasks/:id', (req, res) => {
    const {
        title,
        manday,
        project_name,
        url
    } = req.body;

    db.run(
        `
        UPDATE tasks
        SET title = ?,
            manday = ?,
            project_name = ?,
            url = ?
        WHERE id = ?
        `,
        [
            title || 'Névtelen feladat',
            parseFloat(manday) || 1,
            project_name || 'Általános',
            url || '',
            req.params.id
        ],
        function(err) {
            if (err) return sendError(res, err);

            res.json({
                success: true,
                changed: this.changes
            });
        }
    );
});

app.patch('/api/tasks/:id/schedule', (req, res) => {
    db.run(
        `
        UPDATE tasks
        SET week_number = ?
        WHERE id = ?
        `,
        [
            req.body.week_number || 'backlog',
            req.params.id
        ],
        function(err) {
            if (err) return sendError(res, err);

            res.json({
                success: true,
                changed: this.changes
            });
        }
    );
});

app.patch('/api/tasks/:id/complete', (req, res) => {
    const completed = req.body.completed ? 1 : 0;

    db.run(
        `
        UPDATE tasks
        SET completed = ?
        WHERE id = ?
        `,
        [
            completed,
            req.params.id
        ],
        function(err) {
            if (err) return sendError(res, err);

            res.json({
                success: true,
                completed,
                changed: this.changes
            });
        }
    );
});

app.delete('/api/tasks/:id', (req, res) => {
    db.run(
        `
        DELETE FROM tasks
        WHERE id = ?
        `,
        [req.params.id],
        function(err) {
            if (err) return sendError(res, err);

            res.json({
                success: true,
                changed: this.changes
            });
        }
    );
});

// Projects
app.get('/api/projects', (req, res) => {
    db.all(
        `SELECT id, name FROM projects ORDER BY name ASC`,
        [],
        (err, rows) => {
            if (err) return sendError(res, err);
            res.json(rows || []);
        }
    );
});

app.post('/api/projects', (req, res) => {
    const name = (req.body.name || '').trim();

    if (!name) {
        return res.status(400).json({
            error: 'A projekt neve kötelező'
        });
    }

    db.run(
        `
        INSERT OR IGNORE INTO projects (name)
        VALUES (?)
        `,
        [name],
        function(err) {
            if (err) return sendError(res, err);

            res.json({
                success: true,
                id: this.lastID,
                name
            });
        }
    );
});

// Settings
app.get('/api/settings', (req, res) => {
    const defaultSettings = {
        start_day_of_week: 3,
        sprint_days: 7,
        view_start_date: '2026-01-01',
        view_end_date: '2026-12-31'
    };

    db.all(
        `SELECT key, value FROM settings`,
        [],
        (err, rows) => {
            if (err) return sendError(res, err);

            const settings = { ...defaultSettings };

            (rows || []).forEach((row) => {
                try {
                    settings[row.key] = JSON.parse(row.value);
                } catch (e) {
                    settings[row.key] = row.value;
                }
            });

            res.json(settings);
        }
    );
});

app.post('/api/settings', (req, res) => {
    const entries = Object.entries(req.body || {});

    db.serialize(() => {
        const stmt = db.prepare(
            `
            INSERT OR REPLACE INTO settings (key, value)
            VALUES (?, ?)
            `
        );

        entries.forEach(([key, value]) => {
            stmt.run(key, JSON.stringify(value));
        });

        stmt.finalize((err) => {
            if (err) return sendError(res, err);
            res.json(req.body);
        });
    });
});

// Developer capacities
app.get('/api/developer-capacities', (req, res) => {
    db.all(
        `
        SELECT sprint_key, developer_name, manday
        FROM developer_capacities
        ORDER BY sprint_key ASC, developer_name ASC
        `,
        [],
        (err, rows) => {
            if (err) return sendError(res, err);

            const result = {};

            (rows || []).forEach((row) => {
                if (!result[row.sprint_key]) {
                    result[row.sprint_key] = [];
                }

                result[row.sprint_key].push({
                    developer_name: row.developer_name,
                    manday: row.manday
                });
            });

            res.json(result);
        }
    );
});

app.post('/api/developer-capacities', (req, res) => {
    const sprintKey = req.body.sprint_key;
    const developers = Array.isArray(req.body.developers) ? req.body.developers : [];

    if (!sprintKey) {
        return res.status(400).json({
            error: 'A sprint_key kötelező'
        });
    }

    db.serialize(() => {
        db.run(
            `DELETE FROM developer_capacities WHERE sprint_key = ?`,
            [sprintKey],
            (deleteErr) => {
                if (deleteErr) return sendError(res, deleteErr);

                const stmt = db.prepare(
                    `
                    INSERT INTO developer_capacities (
                        sprint_key,
                        developer_name,
                        manday
                    )
                    VALUES (?, ?, ?)
                    `
                );

                developers.forEach((developer) => {
                    const developerName = (developer.developer_name || '').trim();
                    const manday = parseFloat(developer.manday) || 0;

                    if (developerName) {
                        stmt.run(sprintKey, developerName, manday);
                    }
                });

                stmt.finalize((err) => {
                    if (err) return sendError(res, err);

                    res.json({
                        success: true
                    });
                });
            }
        );
    });
});

// Milestones
app.get('/api/milestones', (req, res) => {
    db.all(
        `
        SELECT id, title, date, type, project_name
        FROM milestones
        ORDER BY date ASC, id ASC
        `,
        [],
        (err, rows) => {
            if (err) return sendError(res, err);
            res.json(rows || []);
        }
    );
});

app.post('/api/milestones', (req, res) => {
    const {
        title,
        date,
        type,
        project_name
    } = req.body;

    db.run(
        `
        INSERT INTO milestones (
            title,
            date,
            type,
            project_name
        )
        VALUES (?, ?, ?, ?)
        `,
        [
            title || 'Mérföldkő',
            date || new Date().toISOString().split('T')[0],
            type || 'code_freeze',
            project_name || ''
        ],
        function(err) {
            if (err) return sendError(res, err);

            res.json({
                id: this.lastID,
                title: title || 'Mérföldkő',
                date: date || new Date().toISOString().split('T')[0],
                type: type || 'code_freeze',
                project_name: project_name || ''
            });
        }
    );
});

app.put('/api/milestones/:id', (req, res) => {
    const {
        title,
        date,
        type,
        project_name
    } = req.body;

    db.run(
        `
        UPDATE milestones
        SET title = ?,
            date = ?,
            type = ?,
            project_name = ?
        WHERE id = ?
        `,
        [
            title || 'Mérföldkő',
            date || new Date().toISOString().split('T')[0],
            type || 'code_freeze',
            project_name || '',
            req.params.id
        ],
        function(err) {
            if (err) return sendError(res, err);

            res.json({
                success: true,
                changed: this.changes
            });
        }
    );
});

app.delete('/api/milestones/:id', (req, res) => {
    db.run(
        `
        DELETE FROM milestones
        WHERE id = ?
        `,
        [req.params.id],
        function(err) {
            if (err) return sendError(res, err);

            res.json({
                success: true,
                changed: this.changes
            });
        }
    );
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Szerver fut a ${PORT}-as porton`);
});
