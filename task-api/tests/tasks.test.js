const request = require('supertest');
const app = require('../src/app');
const { _reset } = require('../src/services/taskService');

// Reset tasks before each test to ensure clean state
beforeEach(() => {
  _reset();
});

describe('Task API', () => {
  
  // Helper function to create a test task
  const createTestTask = async (title = 'Test Task', priority = 'medium') => {
    const response = await request(app)
      .post('/tasks')
      .send({ title, priority });
    return response.body;
  };

  describe('POST /tasks', () => {
    it('should create a new task with valid data', async () => {
      const response = await request(app)
        .post('/tasks')
        .send({ title: 'My New Task', priority: 'high' })
        .expect(201);
      
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('My New Task');
      expect(response.body.priority).toBe('high');
      expect(response.body.status).toBe('todo');
      expect(response.body.completedAt).toBeNull();
    });

    it('should return 400 if title is missing', async () => {
      const response = await request(app)
        .post('/tasks')
        .send({ priority: 'high' })
        .expect(400);
      
      expect(response.body.error).toContain('title is required');
    });

    it('should return 400 if title is empty string', async () => {
      const response = await request(app)
        .post('/tasks')
        .send({ title: '', priority: 'high' })
        .expect(400);
      
      expect(response.body.error).toContain('title is required');
    });

    it('should use default status "todo" when not provided', async () => {
      const response = await request(app)
        .post('/tasks')
        .send({ title: 'Default Status Task' })
        .expect(201);
      
      expect(response.body.status).toBe('todo');
    });
  });

  describe('GET /tasks', () => {
    it('should return all tasks', async () => {
      await createTestTask('Task 1');
      await createTestTask('Task 2');
      await createTestTask('Task 3');
      
      const response = await request(app).get('/tasks').expect(200);
      expect(response.body.length).toBe(3);
    });

    it('should return empty array when no tasks exist', async () => {
      const response = await request(app).get('/tasks').expect(200);
      expect(response.body.length).toBe(0);
    });

    it('should filter tasks by status', async () => {
      const task1 = await createTestTask('Task 1');
      await request(app).patch(`/tasks/${task1.id}/complete`);
      await createTestTask('Task 2');
      
      const response = await request(app).get('/tasks?status=todo').expect(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].status).toBe('todo');
    });

    it('should paginate results', async () => {
      // Create 15 tasks
      for (let i = 1; i <= 15; i++) {
        await createTestTask(`Task ${i}`);
      }
      
      const response = await request(app).get('/tasks?page=2&limit=5').expect(200);
      expect(response.body.length).toBe(5);
    });
  });

  describe('GET /tasks/:id', () => {
    it('should return a single task by id', async () => {
      const task = await createTestTask('Find Me');
      
      const response = await request(app).get(`/tasks/${task.id}`).expect(200);
      expect(response.body.title).toBe('Find Me');
    });

    it('should return 404 for non-existent task', async () => {
      await request(app).get('/tasks/non-existent-id').expect(404);
    });
  });

  describe('PUT /tasks/:id', () => {
    it('should fully update a task', async () => {
      const task = await createTestTask('Original Title');
      
      const response = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ title: 'Updated Title', status: 'in_progress', priority: 'high' })
        .expect(200);
      
      expect(response.body.title).toBe('Updated Title');
      expect(response.body.status).toBe('in_progress');
    });

    it('should return 404 for updating non-existent task', async () => {
      await request(app)
        .put('/tasks/non-existent-id')
        .send({ title: 'Updated' })
        .expect(404);
    });
  });

  describe('PATCH /tasks/:id/complete', () => {
    it('should mark a task as complete', async () => {
      const task = await createTestTask('Complete Me', 'high');
      
      const response = await request(app)
        .patch(`/tasks/${task.id}/complete`)
        .expect(200);
      
      expect(response.body.status).toBe('done');
      expect(response.body.completedAt).not.toBeNull();
      // BUG: This should NOT change to 'medium' - this is Bug #4
      expect(response.body.priority).toBe('high'); // This will FAIL currently!
    });

    it('should return 404 for non-existent task', async () => {
      await request(app)
        .patch('/tasks/non-existent-id/complete')
        .expect(404);
    });

    it('should set completedAt timestamp', async () => {
      const task = await createTestTask('Timestamp Test');
      const beforeComplete = Date.now();
      
      const response = await request(app)
        .patch(`/tasks/${task.id}/complete`)
        .expect(200);
      
      const completedAtTime = new Date(response.body.completedAt).getTime();
      expect(completedAtTime).toBeGreaterThanOrEqual(beforeComplete);
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('should delete a task and return 204', async () => {
      const task = await createTestTask('Delete Me');
      
      await request(app)
        .delete(`/tasks/${task.id}`)
        .expect(204);
      
      // Verify task is deleted
      const allTasks = await request(app).get('/tasks');
      expect(allTasks.body.length).toBe(0);
    });

    it('should return 404 when deleting non-existent task', async () => {
      await request(app)
        .delete('/tasks/non-existent-id')
        .expect(404);
    });
  });

  describe('GET /tasks/stats', () => {
    it('should return task statistics', async () => {
      const task1 = await createTestTask('Task 1');
      const task2 = await createTestTask('Task 2');
      await request(app).patch(`/tasks/${task1.id}/complete`);
      
      const response = await request(app).get('/tasks/stats').expect(200);
      
      // BUG: These field names don't match API spec (Bug #5)
      expect(response.body).toHaveProperty('todo');
      expect(response.body).toHaveProperty('in_progress');
      expect(response.body).toHaveProperty('done');
      expect(response.body).toHaveProperty('overdue');
    });
  });

  describe('PATCH /tasks/:id/assign', () => {
    it('should assign a task to a user', async () => {
      const task = await createTestTask('Assignable Task');
      
      const response = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ userId: 'user-123' })
        .expect(200);
      
      expect(response.body.assignedTo).toBe('user-123');
    });

    it('should return 400 if userId is missing', async () => {
      const task = await createTestTask('Task');
      
      await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({})
        .expect(400);
    });

    it('should return 400 if userId is empty string', async () => {
      const task = await createTestTask('Task');
      
      await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ userId: '' })
        .expect(400);
    });

    it('should return 404 for non-existent task', async () => {
      await request(app)
        .patch('/tasks/non-existent-id/assign')
        .send({ userId: 'user-123' })
        .expect(404);
    });

    it('should not allow assigning a completed task', async () => {
      const task = await createTestTask('Complete then Assign');
      await request(app).patch(`/tasks/${task.id}/complete`);
      
      await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ userId: 'user-123' })
        .expect(400);
    });
  });
});