const express = require('express');
const router = express.Router();
const taskService = require('../services/taskService');
const { validateCreateTask, validateUpdateTask, validateAssignTask } = require('../utils/validators');

router.get('/stats', (req, res) => {
  const stats = taskService.getStats();
  res.json(stats);
});

router.get('/', (req, res) => {
  const { status, page, limit } = req.query;

  if (status) {
    const tasks = taskService.getByStatus(status);
    return res.json(tasks);
  }

  if (page !== undefined || limit !== undefined) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const paginatedTasks = taskService.getPaginated(pageNum, limitNum);
    return res.json(paginatedTasks);
  }

  const allTasks = taskService.getAll();
  res.json(allTasks);
});

// GET /tasks/:id - Get a single task by ID (ADD THIS)
router.get('/:id', (req, res) => {
  const task = taskService.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json(task);
});

router.post('/', (req, res) => {
  const error = validateCreateTask(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const newTask = taskService.create(req.body);
  res.status(201).json(newTask);
});

router.put('/:id', (req, res) => {
  const error = validateUpdateTask(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const updatedTask = taskService.update(req.params.id, req.body);
  if (!updatedTask) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(updatedTask);
});

router.delete('/:id', (req, res) => {
  const deleted = taskService.remove(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.status(204).send();
});

router.patch('/:id/complete', (req, res) => {
  const completedTask = taskService.completeTask(req.params.id);
  if (!completedTask) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(completedTask);
});

router.patch('/:id/assign', (req, res) => {
  const error = validateAssignTask(req.body);
  if (error) {
    return res.status(400).json({ error });
  }
  
  try {
    const assignedTask = taskService.assignTask(req.params.id, req.body.userId);
    if (!assignedTask) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(assignedTask);
  } catch (err) {
    if (err.message === 'Cannot assign a completed task') {
      return res.status(400).json({ error: err.message });
    }
    throw err;
  }
});

module.exports = router;