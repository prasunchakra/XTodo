import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { SyncService } from './sync.service';
import { AuthService } from './auth.service';
import { Task, Project } from '../models/task';
import { environment } from '../../environments/environment';

/**
 * Unit tests for SyncService
 * 
 * Tests cover:
 * - Task CRUD operations (Create, Read, Update, Delete)
 * - Project CRUD operations
 * - Data synchronization with server
 * - Local storage operations
 * - Optimistic updates
 * - Project-task relationships
 * - User-specific data isolation
 * 
 * These tests verify both the business logic and data persistence
 * functionality of the sync service, ensuring data integrity and
 * proper synchronization between client and server.
 */
describe('SyncService', () => {
  let service: SyncService;
  let httpMock: HttpTestingController;
  let authService: AuthService;

  const mockUser = {
    id: 'test-user-123',
    fullName: 'Test User',
    email: 'test@example.com'
  };

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    
    TestBed.configureTestingModule({
      providers: [
        SyncService,
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    
    service = TestBed.inject(SyncService);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);

    // Mock authentication - set up token and user data
    const tokenData = {
      token: 'valid-jwt-token',
      expiresAt: Date.now() + 30 * 60 * 1000
    };
    localStorage.setItem('xtodo_token', JSON.stringify(tokenData));
    localStorage.setItem('xtodo_user', JSON.stringify(mockUser));
    
    // Manually initialize the currentUserSubject by calling private method
    // We need to create a new AuthService instance that will read from localStorage
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        SyncService,
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    
    authService = TestBed.inject(AuthService);
    service = TestBed.inject(SyncService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('Task Operations - Create', () => {
    it('should add a new task with optimistic update', () => {
      const newTask: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'userId'> = {
        title: 'Test Task',
        description: 'Test Description',
        completed: false,
        priority: 'Medium' as const,
        dueDate: new Date(),
        projectId: undefined
      };

      const createdTask = service.addTask(newTask);

      expect(createdTask).toBeTruthy();
      expect(createdTask.id).toBeTruthy();
      expect(createdTask.title).toBe('Test Task');
      expect(createdTask.userId).toBe(mockUser.id);
      expect(createdTask.completed).toBe(false);
    });

    it('should emit updated tasks through tasks$ observable', (done) => {
      const newTask: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'userId'> = {
        title: 'Test Task',
        description: 'Test Description',
        completed: false,
        priority: 'Medium' as const,
        dueDate: new Date(),
        projectId: undefined
      };

      let emissionCount = 0;
      service.tasks$.subscribe(tasks => {
        emissionCount++;
        if (emissionCount === 2) { // Skip initial empty array
          expect(tasks.length).toBe(1);
          expect(tasks[0].title).toBe('Test Task');
          done();
        }
      });

      service.addTask(newTask);
    });

    it('should store task in localStorage', () => {
      const newTask: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'userId'> = {
        title: 'Test Task',
        description: 'Test Description',
        completed: false,
        priority: 'Medium' as const,
        dueDate: new Date(),
        projectId: undefined
      };

      service.addTask(newTask);

      const storageKey = `xtodo_tasks_${mockUser.id}`;
      const storedTasks = localStorage.getItem(storageKey);
      expect(storedTasks).toBeTruthy();
      
      const tasks = JSON.parse(storedTasks!);
      expect(tasks.length).toBe(1);
      expect(tasks[0].title).toBe('Test Task');
    });
  });

  describe('Task Operations - Update', () => {
    it('should update an existing task', () => {
      // Create a task first
      const newTask = service.addTask({
        title: 'Original Title',
        description: 'Original Description',
        completed: false,
        priority: 'Low' as const,
        dueDate: new Date(),
        projectId: undefined
      });

      // Update the task
      const updatedTask = service.updateTask(newTask.id, {
        title: 'Updated Title',
        completed: true
      });

      expect(updatedTask).toBeTruthy();
      expect(updatedTask!.title).toBe('Updated Title');
      expect(updatedTask!.completed).toBe(true);
      expect(updatedTask!.description).toBe('Original Description'); // Should preserve other fields
    });

    it('should return null when updating non-existent task', () => {
      const result = service.updateTask('non-existent-id', { title: 'Updated' });
      expect(result).toBeNull();
    });

    it('should persist updates to localStorage', () => {
      const newTask = service.addTask({
        title: 'Original Title',
        description: 'Test',
        completed: false,
        priority: 'Medium' as const,
        dueDate: new Date(),
        projectId: undefined
      });

      service.updateTask(newTask.id, { completed: true });

      const storageKey = `xtodo_tasks_${mockUser.id}`;
      const storedTasks = JSON.parse(localStorage.getItem(storageKey)!);
      expect(storedTasks[0].completed).toBe(true);
    });
  });

  describe('Task Operations - Delete', () => {
    it('should delete an existing task', () => {
      const newTask = service.addTask({
        title: 'Task to Delete',
        description: 'Test',
        completed: false,
        priority: 'High' as const,
        dueDate: new Date(),
        projectId: undefined
      });

      const result = service.deleteTask(newTask.id);
      expect(result).toBe(true);

      const tasks = service.getCurrentTasksSnapshot();
      expect(tasks.length).toBe(0);
    });

    it('should return false when deleting non-existent task', () => {
      const result = service.deleteTask('non-existent-id');
      expect(result).toBe(false);
    });

    it('should remove task from localStorage', () => {
      const newTask = service.addTask({
        title: 'Task to Delete',
        description: 'Test',
        completed: false,
        priority: 'Medium' as const,
        dueDate: new Date(),
        projectId: undefined
      });

      service.deleteTask(newTask.id);

      const storageKey = `xtodo_tasks_${mockUser.id}`;
      const storedTasks = JSON.parse(localStorage.getItem(storageKey)!);
      expect(storedTasks.length).toBe(0);
    });
  });

  describe('Project Operations - Create', () => {
    it('should add a new project', () => {
      const newProject = service.addProject({
        name: 'Test Project',
        color: '#FF5733',
        description: 'Test Description'
      });

      expect(newProject).toBeTruthy();
      expect(newProject.id).toBeTruthy();
      expect(newProject.name).toBe('Test Project');
      expect(newProject.userId).toBe(mockUser.id);
    });

    it('should emit updated projects through projects$ observable', (done) => {
      let emissionCount = 0;
      service.projects$.subscribe(projects => {
        emissionCount++;
        if (emissionCount === 2) { // Skip initial empty array
          expect(projects.length).toBe(1);
          expect(projects[0].name).toBe('Test Project');
          done();
        }
      });

      service.addProject({
        name: 'Test Project',
        color: '#FF5733',
        description: 'Test Description'
      });
    });
  });

  describe('Project Operations - Update', () => {
    it('should update an existing project', () => {
      const newProject = service.addProject({
        name: 'Original Name',
        color: '#FF5733',
        description: 'Original Description'
      });

      const updatedProject = service.updateProject(newProject.id, {
        name: 'Updated Name',
        color: '#00FF00'
      });

      expect(updatedProject).toBeTruthy();
      expect(updatedProject!.name).toBe('Updated Name');
      expect(updatedProject!.color).toBe('#00FF00');
      expect(updatedProject!.description).toBe('Original Description');
    });

    it('should return null when updating non-existent project', () => {
      const result = service.updateProject('non-existent-id', { name: 'Updated' });
      expect(result).toBeNull();
    });
  });

  describe('Project Operations - Delete', () => {
    it('should delete an existing project', () => {
      const newProject = service.addProject({
        name: 'Project to Delete',
        color: '#FF5733',
        description: 'Test'
      });

      const result = service.deleteProject(newProject.id);
      expect(result).toBe(true);

      const projects = service.getCurrentProjectsSnapshot();
      expect(projects.length).toBe(0);
    });

    it('should return false when deleting non-existent project', () => {
      const result = service.deleteProject('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('Project-Task Relationships', () => {
    it('should get tasks by project ID', () => {
      const project = service.addProject({
        name: 'Test Project',
        color: '#FF5733',
        description: 'Test'
      });

      service.addTask({
        title: 'Task 1',
        description: 'Test',
        completed: false,
        priority: 'Medium' as const,
        dueDate: new Date(),
        projectId: project.id
      });

      service.addTask({
        title: 'Task 2',
        description: 'Test',
        completed: false,
        priority: 'Medium' as const,
        dueDate: new Date(),
        projectId: project.id
      });

      service.addTask({
        title: 'Task 3',
        description: 'Test',
        completed: false,
        priority: 'Medium' as const,
        dueDate: new Date(),
        projectId: undefined
      });

      const projectTasks = service.getTasksByProject(project.id);
      expect(projectTasks.length).toBe(2);
      expect(projectTasks.every(t => t.projectId === project.id)).toBe(true);
    });

    it('should get tasks without a project', () => {
      const project = service.addProject({
        name: 'Test Project',
        color: '#FF5733',
        description: 'Test'
      });

      service.addTask({
        title: 'Task with Project',
        description: 'Test',
        completed: false,
        priority: 'Medium' as const,
        dueDate: new Date(),
        projectId: project.id
      });

      service.addTask({
        title: 'Task without Project 1',
        description: 'Test',
        completed: false,
        priority: 'Medium' as const,
        dueDate: new Date(),
        projectId: undefined
      });

      service.addTask({
        title: 'Task without Project 2',
        description: 'Test',
        completed: false,
        priority: 'Medium' as const,
        dueDate: new Date(),
        projectId: undefined
      });

      const tasksWithoutProject = service.getTasksWithoutProject();
      expect(tasksWithoutProject.length).toBe(2);
      expect(tasksWithoutProject.every(t => !t.projectId)).toBe(true);
    });

    it('should get project with its tasks', () => {
      const project = service.addProject({
        name: 'Test Project',
        color: '#FF5733',
        description: 'Test'
      });

      service.addTask({
        title: 'Task 1',
        description: 'Test',
        completed: false,
        priority: 'Medium' as const,
        dueDate: new Date(),
        projectId: project.id
      });

      const projectWithTasks = service.getProjectWithTasks(project.id);
      expect(projectWithTasks).toBeTruthy();
      expect(projectWithTasks!.name).toBe('Test Project');
      expect(projectWithTasks!.tasks).toBeTruthy();
      expect(projectWithTasks!.tasks!.length).toBe(1);
    });

    it('should get all projects with their tasks', () => {
      const project1 = service.addProject({
        name: 'Project 1',
        color: '#FF5733',
        description: 'Test'
      });

      const project2 = service.addProject({
        name: 'Project 2',
        color: '#00FF00',
        description: 'Test'
      });

      service.addTask({
        title: 'Task 1',
        description: 'Test',
        completed: false,
        priority: 'Medium' as const,
        dueDate: new Date(),
        projectId: project1.id
      });

      service.addTask({
        title: 'Task 2',
        description: 'Test',
        completed: false,
        priority: 'Medium' as const,
        dueDate: new Date(),
        projectId: project2.id
      });

      const projectsWithTasks = service.getAllProjectsWithTasks();
      expect(projectsWithTasks.length).toBe(2);
      expect(projectsWithTasks[0].tasks).toBeTruthy();
      expect(projectsWithTasks[1].tasks).toBeTruthy();
      expect(projectsWithTasks[0].tasks!.length).toBe(1);
      expect(projectsWithTasks[1].tasks!.length).toBe(1);
    });
  });

  describe('Data Synchronization', () => {
    it('should initialize database', (done) => {
      service.initializeDatabase().subscribe(response => {
        expect(response).toBeTruthy();
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/init-db`);
      expect(req.request.method).toBe('POST');
      req.flush({ message: 'Database initialized' });
    });

    it('should sync data with server', (done) => {
      const mockServerResponse = {
        serverChanges: {
          tasks: [],
          projects: []
        },
        clientChangesConfirmed: {
          tasks: [],
          projects: []
        },
        newLastSync: new Date().toISOString()
      };

      service.syncWithServer().subscribe(response => {
        expect(response).toEqual(mockServerResponse);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/sync-data`);
      expect(req.request.method).toBe('POST');
      req.flush(mockServerResponse);
    });

    it('should get all data from local storage', (done) => {
      service.addTask({
        title: 'Test Task',
        description: 'Test',
        completed: false,
        priority: 'Medium' as const,
        dueDate: new Date(),
        projectId: undefined
      });

      service.addProject({
        name: 'Test Project',
        color: '#FF5733',
        description: 'Test'
      });

      service.getAllData().subscribe(data => {
        expect(data.tasks.length).toBe(1);
        expect(data.projects.length).toBe(1);
        done();
      });
    });
  });

  describe('Snapshot Methods', () => {
    it('should get current tasks snapshot', () => {
      service.addTask({
        title: 'Test Task 1',
        description: 'Test',
        completed: false,
        priority: 'Medium' as const,
        dueDate: new Date(),
        projectId: undefined
      });

      service.addTask({
        title: 'Test Task 2',
        description: 'Test',
        completed: false,
        priority: 'High' as const,
        dueDate: new Date(),
        projectId: undefined
      });

      const tasks = service.getCurrentTasksSnapshot();
      expect(tasks.length).toBe(2);
      expect(tasks[0].title).toBe('Test Task 1');
      expect(tasks[1].title).toBe('Test Task 2');
    });

    it('should get current projects snapshot', () => {
      service.addProject({
        name: 'Project 1',
        color: '#FF5733',
        description: 'Test'
      });

      service.addProject({
        name: 'Project 2',
        color: '#00FF00',
        description: 'Test'
      });

      const projects = service.getCurrentProjectsSnapshot();
      expect(projects.length).toBe(2);
      expect(projects[0].name).toBe('Project 1');
      expect(projects[1].name).toBe('Project 2');
    });
  });

  describe('User-Specific Data Isolation', () => {
    it('should use user-specific storage keys', () => {
      service.addTask({
        title: 'Test Task',
        description: 'Test',
        completed: false,
        priority: 'Medium' as const,
        dueDate: new Date(),
        projectId: undefined
      });

      const taskKey = `xtodo_tasks_${mockUser.id}`;
      const storedTasks = localStorage.getItem(taskKey);
      expect(storedTasks).toBeTruthy();
    });

    it('should associate tasks with the current user', () => {
      const task = service.addTask({
        title: 'Test Task',
        description: 'Test',
        completed: false,
        priority: 'Medium' as const,
        dueDate: new Date(),
        projectId: undefined
      });

      expect(task.userId).toBe(mockUser.id);
    });

    it('should associate projects with the current user', () => {
      const project = service.addProject({
        name: 'Test Project',
        color: '#FF5733',
        description: 'Test'
      });

      expect(project.userId).toBe(mockUser.id);
    });
  });
});
