import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Task, Project } from '../models/task';

interface SyncData {
  tasks: Task[];
  projects: Project[];
  lastSync: string;
}

interface ServerResponse {
  serverChanges: {
    tasks: Task[];
    projects: Project[];
  };
  clientChangesConfirmed: {
    tasks: any[];
    projects: any[];
  };
  newLastSync: string;
}

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private readonly TASKS_KEY = 'xtodo_tasks';
  private readonly PROJECTS_KEY = 'xtodo_projects';
  private readonly LAST_SYNC_KEY = 'xtodo_last_sync';
  private readonly PENDING_CHANGES_KEY = 'xtodo_pending_changes';

  private tasksSubject = new BehaviorSubject<Task[]>([]);
  private projectsSubject = new BehaviorSubject<Project[]>([]);
  private pendingChangesSubject = new BehaviorSubject<any[]>([]);

  public tasks$ = this.tasksSubject.asObservable();
  public projects$ = this.projectsSubject.asObservable();
  public pendingChanges$ = this.pendingChangesSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadFromStorage();
    this.loadPendingChanges();
  }

  // Synchronous snapshots for consumers that need immediate values
  public getCurrentTasksSnapshot(): Task[] {
    return this.tasksSubject.value;
  }

  public getCurrentProjectsSnapshot(): Project[] {
    return this.projectsSubject.value;
  }

  // Initialize database (call once)
  initializeDatabase(): Observable<any> {
    return this.http.post(`${environment.apiUrl}/init-db`, {});
  }

  // Sync all data with server
  syncWithServer(): Observable<ServerResponse> {
    const lastSync = this.getLastSync();
    const pendingChanges = this.getPendingChanges();
    
    // Group pending changes by type
    const clientTasks = pendingChanges.filter(change => change.type === 'task');
    const clientProjects = pendingChanges.filter(change => change.type === 'project');

    return this.http.post<ServerResponse>(`${environment.apiUrl}/sync-data`, {
      tasks: clientTasks,
      projects: clientProjects,
      lastSync
    }).pipe(
      tap(response => {
        // Update local storage with server changes
        this.updateLocalData(response.serverChanges);
        
        // Clear confirmed changes from pending
        this.clearConfirmedChanges(response.clientChangesConfirmed);
        
        // Update last sync timestamp
        this.setLastSync(response.newLastSync);
      }),
      catchError(error => {
        console.error('Sync failed:', error);
        return throwError(() => error);
      })
    );
  }

  // Get all data (from local storage)
  getAllData(): Observable<{ tasks: Task[]; projects: Project[] }> {
    return new Observable(observer => {
      observer.next({
        tasks: this.tasksSubject.value,
        projects: this.projectsSubject.value
      });
      observer.complete();
    });
  }

  // Task operations (optimistic updates)
  addTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task {
    const newTask: Task = {
      ...task,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Update local storage immediately
    const currentTasks = this.tasksSubject.value;
    const updatedTasks = [...currentTasks, newTask];
    this.tasksSubject.next(updatedTasks);
    this.saveToStorage();

    // Add to pending changes
    this.addPendingChange('task', 'create', newTask);

    return newTask;
  }

  updateTask(id: string, updates: Partial<Task>): Task | null {
    const currentTasks = this.tasksSubject.value;
    const taskIndex = currentTasks.findIndex(task => task.id === id);
    
    if (taskIndex === -1) return null;

    const updatedTask = {
      ...currentTasks[taskIndex],
      ...updates,
      updatedAt: new Date()
    };

    // Update local storage immediately
    const newTasks = [...currentTasks];
    newTasks[taskIndex] = updatedTask;
    this.tasksSubject.next(newTasks);
    this.saveToStorage();

    // Add to pending changes
    this.addPendingChange('task', 'update', updatedTask);

    return updatedTask;
  }

  deleteTask(id: string): boolean {
    const currentTasks = this.tasksSubject.value;
    const taskIndex = currentTasks.findIndex(task => task.id === id);
    
    if (taskIndex === -1) return false;

    // Update local storage immediately
    const newTasks = currentTasks.filter(task => task.id !== id);
    this.tasksSubject.next(newTasks);
    this.saveToStorage();

    // Add to pending changes
    this.addPendingChange('task', 'delete', { id });

    return true;
  }

  // Project operations (optimistic updates)
  addProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project {
    const newProject: Project = {
      ...project,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Update local storage immediately
    const currentProjects = this.projectsSubject.value;
    const updatedProjects = [...currentProjects, newProject];
    this.projectsSubject.next(updatedProjects);
    this.saveToStorage();

    // Add to pending changes
    this.addPendingChange('project', 'create', newProject);

    return newProject;
  }

  updateProject(id: string, updates: Partial<Project>): Project | null {
    const currentProjects = this.projectsSubject.value;
    const projectIndex = currentProjects.findIndex(project => project.id === id);
    
    if (projectIndex === -1) return null;

    const updatedProject = {
      ...currentProjects[projectIndex],
      ...updates,
      updatedAt: new Date()
    };

    // Update local storage immediately
    const newProjects = [...currentProjects];
    newProjects[projectIndex] = updatedProject;
    this.projectsSubject.next(newProjects);
    this.saveToStorage();

    // Add to pending changes
    this.addPendingChange('project', 'update', updatedProject);

    return updatedProject;
  }

  deleteProject(id: string): boolean {
    const currentProjects = this.projectsSubject.value;
    const projectIndex = currentProjects.findIndex(project => project.id === id);
    
    if (projectIndex === -1) return false;

    // Update local storage immediately
    const newProjects = currentProjects.filter(project => project.id !== id);
    this.projectsSubject.next(newProjects);
    this.saveToStorage();

    // Add to pending changes
    this.addPendingChange('project', 'delete', { id });

    return true;
  }

  // Get statistics (computed from local data)
  getStatistics(): Observable<{
    total: number;
    completed: number;
    active: number;
    overdue: number;
    dueToday: number;
  }> {
    return new Observable(observer => {
      const tasks = this.tasksSubject.value;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const stats = {
        total: tasks.length,
        completed: tasks.filter(task => task.completed).length,
        active: tasks.filter(task => !task.completed).length,
        overdue: tasks.filter(task => 
          !task.completed && 
          task.dueDate && 
          new Date(task.dueDate) < today
        ).length,
        dueToday: tasks.filter(task => 
          !task.completed && 
          task.dueDate && 
          new Date(task.dueDate).toDateString() === today.toDateString()
        ).length
      };

      observer.next(stats);
      observer.complete();
    });
  }

  // Private helper methods
  private loadFromStorage(): void {
    try {
      const tasks = JSON.parse(localStorage.getItem(this.TASKS_KEY) || '[]');
      const projects = JSON.parse(localStorage.getItem(this.PROJECTS_KEY) || '[]');
      
      // Convert date strings back to Date objects
      const processedTasks = tasks.map((task: any) => ({
        ...task,
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt),
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined
      }));

      const processedProjects = projects.map((project: any) => ({
        ...project,
        createdAt: new Date(project.createdAt),
        updatedAt: new Date(project.updatedAt)
      }));

      this.tasksSubject.next(processedTasks);
      this.projectsSubject.next(processedProjects);
    } catch (error) {
      console.error('Error loading from storage:', error);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.TASKS_KEY, JSON.stringify(this.tasksSubject.value));
      localStorage.setItem(this.PROJECTS_KEY, JSON.stringify(this.projectsSubject.value));
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  }

  private loadPendingChanges(): void {
    try {
      const pending = JSON.parse(localStorage.getItem(this.PENDING_CHANGES_KEY) || '[]');
      this.pendingChangesSubject.next(pending);
    } catch (error) {
      console.error('Error loading pending changes:', error);
    }
  }

  private getPendingChanges(): any[] {
    return this.pendingChangesSubject.value;
  }

  private addPendingChange(type: 'task' | 'project', action: 'create' | 'update' | 'delete', data: any): void {
    const pending = [...this.pendingChangesSubject.value];
    pending.push({
      type,
      action,
      data: { ...data, _action: action },
      timestamp: new Date().toISOString()
    });
    this.pendingChangesSubject.next(pending);
    localStorage.setItem(this.PENDING_CHANGES_KEY, JSON.stringify(pending));
  }

  private clearConfirmedChanges(confirmed: any): void {
    // Remove confirmed changes from pending
    const pending = this.pendingChangesSubject.value;
    const confirmedIds = new Set([
      ...confirmed.tasks.map((t: any) => t.id),
      ...confirmed.projects.map((p: any) => p.id)
    ]);
    
    const remaining = pending.filter(change => !confirmedIds.has(change.data.id));
    this.pendingChangesSubject.next(remaining);
    localStorage.setItem(this.PENDING_CHANGES_KEY, JSON.stringify(remaining));
  }

  private updateLocalData(serverData: { tasks: Task[]; projects: Project[] }): void {
    // Merge server data with local data
    const currentTasks = this.tasksSubject.value;
    const currentProjects = this.projectsSubject.value;

    // Update tasks
    const taskMap = new Map(currentTasks.map(task => [task.id, task]));
    serverData.tasks.forEach(serverTask => {
      taskMap.set(serverTask.id, serverTask);
    });
    this.tasksSubject.next(Array.from(taskMap.values()));

    // Update projects
    const projectMap = new Map(currentProjects.map(project => [project.id, project]));
    serverData.projects.forEach(serverProject => {
      projectMap.set(serverProject.id, serverProject);
    });
    this.projectsSubject.next(Array.from(projectMap.values()));

    this.saveToStorage();
  }

  private getLastSync(): string | null {
    return localStorage.getItem(this.LAST_SYNC_KEY);
  }

  private setLastSync(timestamp: string): void {
    localStorage.setItem(this.LAST_SYNC_KEY, timestamp);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
