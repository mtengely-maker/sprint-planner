const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ideiglenes memóriabeli adatok (vagy ide kötheted majd az adatbázisodat)
let tasks = [];
let projects = [];
let settings = { start_day_of_week: 3, sprint_days: 7, view_start_date: '2026-01-01', view_end_date: '2026-12-31' };
let developerCapacities = {};
let milestones = [];

// --- API VÉGPONTOK ---

// Tasks
app.get('/api/tasks', (req, res) => res.json(tasks));
app.post('/api/tasks', (req, res) => {
    const newTask = { id: Date.now(), ...req.body };
    tasks.push(newTask);
    res.json(newTask);
});
app.put('/api/tasks/:id', (req, res) => {
    const id = parseInt(req.params.id);
    tasks = tasks.map(t => t.id === id ? { ...t, ...req.body } : t);
    res.json({ success: true });
});
app.patch('/api/tasks/:id/schedule', (req, res) => {
    const id = parseInt(req.params.id);
    tasks = tasks.map(t => t.id === id ? { ...t, week_number: req.body.week_number } : t);
    res.json({ success: true });
});
app.patch('/api/tasks/:id/complete', (req, res) => {
    const id = parseInt(req.params.id);
    tasks = tasks.map(t => t.id === id ? { ...t, completed: req.body.completed } : t);
    res.json({ success: true });
});
app.delete('/api/tasks/:id', (req, res) => {
    const id = parseInt(req.params.id);
    tasks = tasks.filter(t => t.id !== id);
    res.json({ success: true });
});

// Projects
app.get('/api/projects', (req, res) => res.json(projects));
app.post('/api/projects', (req, res) => {
    projects.push(req.body);
    res.json(req.body);
});

// Settings
app.get('/api/settings', (req, res) => res.json(settings));
app.post('/api/settings', (req, res) => {
    settings = { ...settings, ...req.body };
    res.json(settings);
});

// Developer Capacities
app.get('/api/developer-capacities', (req, res) => res.json(developerCapacities));
app.post('/api/developer-capacities', (req, res) => {
    const { sprint_key, developers } = req.body;
    developerCapacities[sprint_key] = developers;
    res.json({ success: true });
});

// Milestones
app.get('/api/milestones', (req, res) => res.json(milestones));
app.post('/api/milestones', (req, res) => {
    const newM = { id: Date.now(), ...req.body };
    milestones.push(newM);
    res.json(newM);
});
app.put('/api/milestones/:id', (req, res) => {
    const id = parseInt(req.params.id);
    milestones = milestones.map(m => m.id === id ? { ...m, ...req.body } : m);
    res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Szerver fut a ${PORT}-as porton`);
});
