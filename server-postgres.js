const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('Hiányzó DATABASE_URL environment variable.');
    process.exit(1);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS projects (
            id BIGSERIAL PRIMARY KEY,
            name TEXT UNIQUE NOT NULL
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS tasks (
            id BIGSERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            manday NUMERIC DEFAULT 1,
            project_name TEXT,
            week_number TEXT DEFAULT 'backlog',
            url TEXT DEFAULT '',
            completed INTEGER DEFAULT 0
        );
    `);

    await pool.query(`
        ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS url TEXT DEFAULT '';
    `);

    await pool.query(`
        ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS completed INTEGER DEFAULT 0;
    `);

await pool.query(`
    ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS priority TEXT;
`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS developer_capacities (
            id BIGSERIAL PRIMARY KEY,
            sprint_key TEXT NOT NULL,
            developer_name TEXT NOT NULL,
            manday NUMERIC DEFAULT 0
        );
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS milestones (
            id BIGSERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            date TEXT NOT NULL,
            type TEXT DEFAULT 'code_freeze',
            project_name TEXT DEFAULT ''
        );
    `);

    console.log('Kapcsolódva a Supabase/PostgreSQL adatbázishoz.');
}

function sendError(res, err) {
    console.error(err);
    res.status(500).json({
        error: err.message || 'Ismeretlen szerverhiba'
    });
}

app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');

        res.json({
            status: 'ok',
            storage: 'postgres',
            database: 'supabase'
        });
    } catch (err) {
        sendError(res, err);
    }
});

// Tasks
app.get('/api/tasks', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id::int AS id,
                title,
                manday::float AS manday,
                project_name,
                week_number,
                url,
                completed,
                priority
            FROM tasks
            ORDER BY id ASC
        `);

        res.json(result.rows || []);
    } catch (err) {
        sendError(res, err);
    }
});

app.post('/api/tasks', async (req, res) => {
    try {
        if (req.body.action === 'schedule') {
            const taskId = Number(req.body.id);
            const weekNumber = req.body.week_number || 'backlog';

            if (!Number.isInteger(taskId) || taskId <= 0) {
                return res.status(400).json({
                    error: 'Érvénytelen task azonosító'
                });
            }

            const result = await pool.query(
                `
                UPDATE tasks
                SET week_number = $1
                WHERE id = $2
                RETURNING
                    id::int AS id,
                    title,
                    manday::float AS manday,
                    project_name,
                    week_number,
                    url,
                    completed,
                    priority
                `,
                [weekNumber, taskId]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({
                    error: 'A feladat nem található'
                });
            }

            return res.json({
                success: true,
                changed: result.rowCount,
                task: result.rows[0]
            });
        }

        const title = req.body.title || 'Névtelen feladat';
        const manday = parseFloat(req.body.manday) || 1;
        const projectName = req.body.project_name || 'Általános';
        const weekNumber = req.body.week_number || 'backlog';
        const url = req.body.url || '';
        const priority = req.body.priority || null;

        const result = await pool.query(
            `
            INSERT INTO tasks (
                title,
                manday,
                project_name,
                week_number,
                url,
                completed,
                priority
            )
            VALUES ($1, $2, $3, $4, $5, 0, $6)
            RETURNING
                id::int AS id,
                title,
                manday::float AS manday,
                project_name,
                week_number,
                url,
                completed,
                priority
            `,
            [
                title,
                manday,
                projectName,
                weekNumber,
                url,
                priority
            ]
        );

        return res.json(result.rows[0]);
    } catch (err) {
        sendError(res, err);
    }
});

app.put('/api/tasks/:id', async (req, res) => {
    try {
        const title = req.body.title || 'Névtelen feladat';
        const manday = parseFloat(req.body.manday) || 1;
        const projectName = req.body.project_name || 'Általános';
        const url = req.body.url || '';
        const priority = req.body.priority || null;
        const weekNumber = req.body.week_number || null;

        const result = await pool.query(
            `
            UPDATE tasks
            SET
                title = $1,
                manday = $2,
                project_name = $3,
                url = $4,
                priority = $5,
                week_number = COALESCE($6, week_number)
            WHERE id = $7
            `,
            [
                title,
                manday,
                projectName,
                url,
                priority,
                weekNumber,
                req.params.id
            ]
        );

        res.json({
            success: true,
            changed: result.rowCount
        });
    } catch (err) {
        sendError(res, err);
    }
});

app.patch('/api/tasks/:id/schedule', async (req, res) => {
    try {
        const weekNumber = req.body.week_number || 'backlog';

        const result = await pool.query(
            `
            UPDATE tasks
            SET week_number = $1
            WHERE id = $2
            `,
            [weekNumber, req.params.id]
        );

        res.json({
            success: true,
            changed: result.rowCount
        });
    } catch (err) {
        sendError(res, err);
    }
});
app.post('/api/tasks/:id/schedule', async (req, res) => {
    try {
        const weekNumber = req.body.week_number || 'backlog';

        const result = await pool.query(
            `
            UPDATE tasks
            SET week_number = $1
            WHERE id = $2
            `,
            [weekNumber, req.params.id]
        );

        res.json({
            success: true,
            changed: result.rowCount
        });
    } catch (err) {
        sendError(res, err);
    }
});

app.patch('/api/tasks/:id/complete', async (req, res) => {
    try {
        const completed = req.body.completed ? 1 : 0;

        const result = await pool.query(
            `
            UPDATE tasks
            SET completed = $1
            WHERE id = $2
            `,
            [completed, req.params.id]
        );

        res.json({
            success: true,
            completed,
            changed: result.rowCount
        });
    } catch (err) {
        sendError(res, err);
    }
});

app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `
            DELETE FROM tasks
            WHERE id = $1
            `,
            [req.params.id]
        );

        res.json({
            success: true,
            changed: result.rowCount
        });
    } catch (err) {
        sendError(res, err);
    }
});

// Projects
app.get('/api/projects', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id::int AS id,
                name
            FROM projects
            ORDER BY name ASC
        `);

        res.json(result.rows || []);
    } catch (err) {
        sendError(res, err);
    }
});

app.post('/api/projects', async (req, res) => {
    try {
        const name = (req.body.name || '').trim();

        if (!name) {
            return res.status(400).json({
                error: 'A projekt neve kötelező'
            });
        }

        const result = await pool.query(
            `
            INSERT INTO projects (name)
            VALUES ($1)
            ON CONFLICT (name) DO UPDATE
            SET name = EXCLUDED.name
            RETURNING
                id::int AS id,
                name
            `,
            [name]
        );

        res.json({
            success: true,
            ...result.rows[0]
        });
    } catch (err) {
        sendError(res, err);
    }
});

// Settings
app.get('/api/settings', async (req, res) => {
    try {
        const defaultSettings = {
            start_day_of_week: 3,
            sprint_days: 7,
            view_start_date: '2026-01-01',
            view_end_date: '2026-12-31'
        };

        const result = await pool.query(`
            SELECT key, value
            FROM settings
        `);

        const settings = { ...defaultSettings };

        (result.rows || []).forEach((row) => {
            try {
                settings[row.key] = JSON.parse(row.value);
            } catch (e) {
                settings[row.key] = row.value;
            }
        });

        res.json(settings);
    } catch (err) {
        sendError(res, err);
    }
});

app.post('/api/settings', async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const entries = Object.entries(req.body || {});

        for (const [key, value] of entries) {
            await client.query(
                `
                INSERT INTO settings (key, value)
                VALUES ($1, $2)
                ON CONFLICT (key) DO UPDATE
                SET value = EXCLUDED.value
                `,
                [key, JSON.stringify(value)]
            );
        }

        await client.query('COMMIT');

        res.json(req.body);
    } catch (err) {
        await client.query('ROLLBACK');
        sendError(res, err);
    } finally {
        client.release();
    }
});

// Developer capacities
app.get('/api/developer-capacities', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                sprint_key,
                developer_name,
                manday::float AS manday
            FROM developer_capacities
            ORDER BY sprint_key ASC, developer_name ASC
        `);

        const capacities = {};

        (result.rows || []).forEach((row) => {
            if (!capacities[row.sprint_key]) {
                capacities[row.sprint_key] = [];
            }

            capacities[row.sprint_key].push({
                developer_name: row.developer_name,
                manday: row.manday
            });
        });

        res.json(capacities);
    } catch (err) {
        sendError(res, err);
    }
});

app.post('/api/developer-capacities', async (req, res) => {
    const client = await pool.connect();

    try {
        const sprintKey = req.body.sprint_key;
        const developers = Array.isArray(req.body.developers) ? req.body.developers : [];

        if (!sprintKey) {
            return res.status(400).json({
                error: 'A sprint_key kötelező'
            });
        }

        await client.query('BEGIN');

        await client.query(
            `
            DELETE FROM developer_capacities
            WHERE sprint_key = $1
            `,
            [sprintKey]
        );

        for (const developer of developers) {
            const developerName = (developer.developer_name || '').trim();
            const manday = parseFloat(developer.manday) || 0;

            if (developerName) {
                await client.query(
                    `
                    INSERT INTO developer_capacities (
                        sprint_key,
                        developer_name,
                        manday
                    )
                    VALUES ($1, $2, $3)
                    `,
                    [sprintKey, developerName, manday]
                );
            }
        }

        await client.query('COMMIT');

        res.json({
            success: true
        });
    } catch (err) {
        await client.query('ROLLBACK');
        sendError(res, err);
    } finally {
        client.release();
    }
});

// Milestones
app.get('/api/milestones', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id::int AS id,
                title,
                date,
                type,
                project_name
            FROM milestones
            ORDER BY date ASC, id ASC
        `);

        res.json(result.rows || []);
    } catch (err) {
        sendError(res, err);
    }
});

app.post('/api/milestones', async (req, res) => {
    try {
        const title = req.body.title || 'Mérföldkő';
        const date = req.body.date || new Date().toISOString().split('T')[0];
        const type = req.body.type || 'code_freeze';
        const projectName = req.body.project_name || '';

        const result = await pool.query(
            `
            INSERT INTO milestones (
                title,
                date,
                type,
                project_name
            )
            VALUES ($1, $2, $3, $4)
            RETURNING
                id::int AS id,
                title,
                date,
                type,
                project_name
            `,
            [title, date, type, projectName]
        );

        res.json(result.rows[0]);
    } catch (err) {
        sendError(res, err);
    }
});

app.put('/api/milestones/:id', async (req, res) => {
    try {
        const title = req.body.title || 'Mérföldkő';
        const date = req.body.date || new Date().toISOString().split('T')[0];
        const type = req.body.type || 'code_freeze';
        const projectName = req.body.project_name || '';

        const result = await pool.query(
            `
            UPDATE milestones
            SET
                title = $1,
                date = $2,
                type = $3,
                project_name = $4
            WHERE id = $5
            `,
            [title, date, type, projectName, req.params.id]
        );

        res.json({
            success: true,
            changed: result.rowCount
        });
    } catch (err) {
        sendError(res, err);
    }
});

app.delete('/api/milestones/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `
            DELETE FROM milestones
            WHERE id = $1
            `,
            [req.params.id]
        );

        res.json({
            success: true,
            changed: result.rowCount
        });
    } catch (err) {
        sendError(res, err);
    }
});

initDatabase()
    .then(() => {
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Szerver fut a ${PORT}-as porton`);
        });
    })
    .catch((err) => {
        console.error('Adatbázis inicializálási hiba:', err);
        process.exit(1);
    });