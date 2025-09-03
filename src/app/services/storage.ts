import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Task, Project } from '../models/task';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly TASKS_KEY = 'xtodo_tasks';
  private readonly PROJECTS_KEY = 'xtodo_projects';
  
  private tasksSubject = new BehaviorSubject<Task[]>([]);
  private projectsSubject = new BehaviorSubject<Project[]>([]);

  constructor() {
    this.loadInitialData();
  }

  // Task methods
  getTasks(): Observable<Task[]> {
    return this.tasksSubject.asObservable();
  }

  getTaskById(id: string): Observable<Task | undefined> {
    return this.tasksSubject.pipe(
      map(tasks => tasks.find(task => task.id === id))
    );
  }

  addTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Observable<Task> {
    const newTask: Task = {
      ...task,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const currentTasks = this.tasksSubject.value;
    const updatedTasks = [...currentTasks, newTask];
    
    this.tasksSubject.next(updatedTasks);
    this.saveToStorage(this.TASKS_KEY, updatedTasks);
    
    return new Observable(observer => {
      observer.next(newTask);
      observer.complete();
    });
  }

  updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Observable<Task | undefined> {
    const currentTasks = this.tasksSubject.value;
    const taskIndex = currentTasks.findIndex(task => task.id === id);
    
    if (taskIndex === -1) {
      return new Observable(observer => {
        observer.next(undefined);
        observer.complete();
      });
    }

    const updatedTask: Task = {
      ...currentTasks[taskIndex],
      ...updates,
      updatedAt: new Date()
    };

    const updatedTasks = [...currentTasks];
    updatedTasks[taskIndex] = updatedTask;
    
    this.tasksSubject.next(updatedTasks);
    this.saveToStorage(this.TASKS_KEY, updatedTasks);
    
    return new Observable(observer => {
      observer.next(updatedTask);
      observer.complete();
    });
  }

  deleteTask(id: string): Observable<boolean> {
    const currentTasks = this.tasksSubject.value;
    const updatedTasks = currentTasks.filter(task => task.id !== id);
    
    this.tasksSubject.next(updatedTasks);
    this.saveToStorage(this.TASKS_KEY, updatedTasks);
    
    return new Observable(observer => {
      observer.next(true);
      observer.complete();
    });
  }

  // Project methods
  getProjects(): Observable<Project[]> {
    return this.projectsSubject.asObservable();
  }

  getProjectById(id: string): Observable<Project | undefined> {
    return this.projectsSubject.pipe(
      map(projects => projects.find(project => project.id === id))
    );
  }

  addProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Observable<Project> {
    const newProject: Project = {
      ...project,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const currentProjects = this.projectsSubject.value;
    const updatedProjects = [...currentProjects, newProject];
    
    this.projectsSubject.next(updatedProjects);
    this.saveToStorage(this.PROJECTS_KEY, updatedProjects);
    
    return new Observable(observer => {
      observer.next(newProject);
      observer.complete();
    });
  }

  updateProject(id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>): Observable<Project | undefined> {
    const currentProjects = this.projectsSubject.value;
    const projectIndex = currentProjects.findIndex(project => project.id === id);
    
    if (projectIndex === -1) {
      return new Observable(observer => {
        observer.next(undefined);
        observer.complete();
      });
    }

    const updatedProject: Project = {
      ...currentProjects[projectIndex],
      ...updates,
      updatedAt: new Date()
    };

    const updatedProjects = [...currentProjects];
    updatedProjects[projectIndex] = updatedProject;
    
    this.projectsSubject.next(updatedProjects);
    this.saveToStorage(this.PROJECTS_KEY, updatedProjects);
    
    return new Observable(observer => {
      observer.next(updatedProject);
      observer.complete();
    });
  }

  deleteProject(id: string): Observable<boolean> {
    const currentProjects = this.projectsSubject.value;
    const updatedProjects = currentProjects.filter(project => project.id !== id);
    
    // Also remove projectId from all tasks
    const currentTasks = this.tasksSubject.value;
    const updatedTasks = currentTasks.map(task => 
      task.projectId === id ? { ...task, projectId: undefined } : task
    );
    
    this.projectsSubject.next(updatedProjects);
    this.tasksSubject.next(updatedTasks);
    this.saveToStorage(this.PROJECTS_KEY, updatedProjects);
    this.saveToStorage(this.TASKS_KEY, updatedTasks);
    
    return new Observable(observer => {
      observer.next(true);
      observer.complete();
    });
  }

  // Private methods
  private loadInitialData(): void {
    const tasks = this.loadFromStorage<Task[]>(this.TASKS_KEY, []);
    const projects = this.loadFromStorage<Project[]>(this.PROJECTS_KEY, this.getDefaultProjects());
    
    this.tasksSubject.next(tasks);
    this.projectsSubject.next(projects);
  }

  private getDefaultProjects(): Project[] {
    return [
      {
        id: 'personal',
        name: 'Personal',
        description: 'Personal tasks and goals',
        color: '#3B82F6',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'work',
        name: 'Work',
        description: 'Work-related tasks and projects',
        color: '#10B981',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private saveToStorage<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  private loadFromStorage<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        // Handle date conversion for stored data
        if (Array.isArray(parsed)) {
          return parsed.map((item: any) => this.convertDates(item)) as T;
        }
        return this.convertDates(parsed) as T;
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
    }
    return defaultValue;
  }

  private convertDates(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.convertDates(item));
    }

    const converted: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (key === 'createdAt' || key === 'updatedAt' || key === 'dueDate') {
          converted[key] = new Date(obj[key]);
        } else {
          converted[key] = this.convertDates(obj[key]);
        }
      }
    }
    return converted;
  }
}
