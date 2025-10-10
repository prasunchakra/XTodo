import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, tap, finalize } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Task, Project } from '../models/task';
import { AuthService } from './auth.service';

const DB_NAME = 'XTodoOfflineDB';
const DB_VERSION = 1;
const PENDING_CHANGES_STORE = 'pendingChanges';

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

// Sync status type for better tracking
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

// Online status tracking
export interface OnlineStatus {
  isOnline: boolean;
  lastChecked: Date;
}

// Detailed pending changes summary
export interface PendingChangesSummary {
  total: number;
  tasks: {
    create: number;
    update: number;
    delete: number;
  };
  projects: {
    create: number;
    update: number;
    delete: number;
  };
  changes: any[]; // Full list of changes for detailed view
}

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private tasksSubject = new BehaviorSubject<Task[]>([]);
  private projectsSubject = new BehaviorSubject<Project[]>([]);
  private pendingChangesSubject = new BehaviorSubject<any[]>([]);
  // New: Sync status tracking
  private syncStatusSubject = new BehaviorSubject<SyncStatus>('idle');
  private lastSyncTimeSubject = new BehaviorSubject<Date | null>(null);
  private onlineStatusSubject = new BehaviorSubject<OnlineStatus>({ 
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true, 
    lastChecked: new Date() 
  });

  public tasks$ = this.tasksSubject.asObservable();
  public projects$ = this.projectsSubject.asObservable();
  public pendingChanges$ = this.pendingChangesSubject.asObservable();
  // New: Observable for sync status
  public syncStatus$ = this.syncStatusSubject.asObservable();
  public lastSyncTime$ = this.lastSyncTimeSubject.asObservable();
  public onlineStatus$ = this.onlineStatusSubject.asObservable();

  private http = inject(HttpClient);
  private authService = inject(AuthService);

  // Sync lock to prevent race conditions
  // Ensures only one sync operation runs at a time
  private isSyncInProgress = false;
  private syncQueue: (() => void)[] = [];

  // IndexedDB instance for persistent storage
  private db: IDBDatabase | null = null;

  constructor() {
    this.initIndexedDB().then(() => {
      this.loadFromStorage();
      this.loadPendingChanges();
    });
  }

  
  private async initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB, falling back to localStorage');
        resolve(); // Continue even if IndexedDB fails
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store for pending changes if it doesn't exist
        if (!db.objectStoreNames.contains(PENDING_CHANGES_STORE)) {
          const objectStore = db.createObjectStore(PENDING_CHANGES_STORE, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          // Create index for userId to support multi-user scenarios
          objectStore.createIndex('userId', 'userId', { unique: false });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // Get user-specific storage keys
  private getStorageKeys() {
    const user = this.authService.getCurrentUserSnapshot();
    const userId = user?.id || 'anonymous';
    return {
      TASKS_KEY: `xtodo_tasks_${userId}`,
      PROJECTS_KEY: `xtodo_projects_${userId}`,
      LAST_SYNC_KEY: `xtodo_last_sync_${userId}`,
      PENDING_CHANGES_KEY: `xtodo_pending_changes_${userId}`
    };
  }

  // Synchronous snapshots for consumers that need immediate values
  public getCurrentTasksSnapshot(): Task[] {
    return this.tasksSubject.value;
  }

  public getCurrentProjectsSnapshot(): Project[] {
    return this.projectsSubject.value;
  }

  // Helper methods for project-task relationships
  public getTasksByProject(projectId: string): Task[] {
    return this.tasksSubject.value.filter(task => task.projectId === projectId);
  }

  public getTasksWithoutProject(): Task[] {
    return this.tasksSubject.value.filter(task => !task.projectId);
  }

  public getProjectWithTasks(projectId: string): Project | null {
    const project = this.projectsSubject.value.find(p => p.id === projectId);
    if (!project) return null;
    
    return {
      ...project,
      tasks: this.getTasksByProject(projectId)
    };
  }

  public getAllProjectsWithTasks(): Project[] {
    return this.projectsSubject.value.map(project => ({
      ...project,
      tasks: this.getTasksByProject(project.id)
    }));
  }

  // Initialize database (call once)
  initializeDatabase(): Observable<any> {
    return this.http.post(`${environment.apiUrl}/init-db`, {});
  }

  // Sync all data with server
  // Uses locking mechanism to prevent race conditions
  syncWithServer(): Observable<ServerResponse> {
    // Check if sync is already in progress
    if (this.isSyncInProgress) {
      console.log('Sync already in progress, operation will be queued');
      return new Observable(observer => {
        this.syncQueue.push(() => {
          this.performSync().subscribe(observer);
        });
      });
    }

    return this.performSync();
  }


  private performSync(): Observable<ServerResponse> {
    this.isSyncInProgress = true;

    const lastSync = this.getLastSync();
    const pendingChanges = this.getPendingChanges();
    
    // Update sync status to syncing
    this.syncStatusSubject.next('syncing');
    
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
        
        // Update sync status to success
        this.syncStatusSubject.next('success');
        
        // Update last sync time for display
        this.lastSyncTimeSubject.next(new Date());
      }),
      catchError(error => {
        console.error('Sync failed:', error);
        // Update sync status to error
        this.syncStatusSubject.next('error');
        return throwError(() => error);
      }),
      finalize(() => {
        // Release the lock and process queued sync operations
        this.isSyncInProgress = false;
        this.processNextQueuedSync();
      })
    );
  }


  private processNextQueuedSync(): void {
    if (this.syncQueue.length > 0) {
      const nextSync = this.syncQueue.shift();
      if (nextSync) {
        nextSync();
      }
    }
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
  addTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Task {
    const user = this.authService.getCurrentUserSnapshot();
    if (!user) {
      throw new Error('User must be authenticated to add tasks');
    }

    const newTask: Task = {
      ...task,
      id: this.generateId(),
      userId: user.id,
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
  addProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Project {
    const user = this.authService.getCurrentUserSnapshot();
    if (!user) {
      throw new Error('User must be authenticated to add projects');
    }

    const newProject: Project = {
      ...project,
      id: this.generateId(),
      userId: user.id,
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
      const keys = this.getStorageKeys();
      const tasks = JSON.parse(localStorage.getItem(keys.TASKS_KEY) || '[]');
      const projects = JSON.parse(localStorage.getItem(keys.PROJECTS_KEY) || '[]');
      
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
      const keys = this.getStorageKeys();
      localStorage.setItem(keys.TASKS_KEY, JSON.stringify(this.tasksSubject.value));
      localStorage.setItem(keys.PROJECTS_KEY, JSON.stringify(this.projectsSubject.value));
    } catch (error) {
      // Enhanced error handling - storage failures shouldn't crash the app
      console.error('Error saving to storage:', error);
      
      // Check for quota exceeded error
      if (error instanceof DOMException && 
          (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        console.error('Storage quota exceeded. Data is still available in memory but may be lost on refresh.');
        // The data is still in memory (BehaviorSubjects), so the app continues to work
        // but persistence is compromised until the issue is resolved
      }
    }
  }

  /**
   * Load pending changes from IndexedDB with localStorage fallback
   * Migrates data from localStorage to IndexedDB if found
   */
  private async loadPendingChanges(): Promise<void> {
    try {
      const user = this.authService.getCurrentUserSnapshot();
      const userId = user?.id || 'anonymous';

      // Try loading from IndexedDB first
      if (this.db) {
        const changes = await this.getFromIndexedDB(userId);
        if (changes && changes.length > 0) {
          this.pendingChangesSubject.next(changes);
          return;
        }
      }

      // Fallback to localStorage and migrate to IndexedDB
      const keys = this.getStorageKeys();
      const localStorageData = localStorage.getItem(keys.PENDING_CHANGES_KEY);
      
      if (localStorageData) {
        const pending = JSON.parse(localStorageData);
        this.pendingChangesSubject.next(pending);
        
        // Migrate to IndexedDB for better persistence
        if (this.db && pending.length > 0) {
          await this.saveToIndexedDB(userId, pending);
          // Clear from localStorage after successful migration
          localStorage.removeItem(keys.PENDING_CHANGES_KEY);
        }
      } else {
        this.pendingChangesSubject.next([]);
      }
    } catch (error) {
      console.error('Error loading pending changes:', error);
      this.pendingChangesSubject.next([]);
    }
  }

  /**
   * Get pending changes from IndexedDB for a specific user
   */
  private getFromIndexedDB(userId: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve([]);
        return;
      }

      try {
        const transaction = this.db.transaction([PENDING_CHANGES_STORE], 'readonly');
        const objectStore = transaction.objectStore(PENDING_CHANGES_STORE);
        const index = objectStore.index('userId');
        const request = index.getAll(userId);

        request.onsuccess = () => {
          const results = request.result || [];
          // Extract the actual change data (remove IndexedDB metadata)
          const changes = results.map((item: any) => ({
            type: item.type,
            action: item.action,
            data: item.data,
            timestamp: item.timestamp
          }));
          resolve(changes);
        };

        request.onerror = () => {
          console.error('Failed to load from IndexedDB');
          resolve([]);
        };
      } catch (error) {
        console.error('Error in getFromIndexedDB:', error);
        resolve([]);
      }
    });
  }

  /**
   * Save pending changes to IndexedDB
   */
  private async saveToIndexedDB(userId: string, changes: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      try {
        const transaction = this.db.transaction([PENDING_CHANGES_STORE], 'readwrite');
        const objectStore = transaction.objectStore(PENDING_CHANGES_STORE);

        // Clear existing entries for this user first
        const index = objectStore.index('userId');
        const clearRequest = index.openCursor(IDBKeyRange.only(userId));
        
        clearRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            // Add new entries
            changes.forEach(change => {
              objectStore.add({
                userId,
                type: change.type,
                action: change.action,
                data: change.data,
                timestamp: change.timestamp
              });
            });
          }
        };

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
          console.error('Failed to save to IndexedDB');
          resolve(); // Don't fail, fallback to localStorage
        };
      } catch (error) {
        console.error('Error in saveToIndexedDB:', error);
        resolve();
      }
    });
  }

  /**
   * Clear specific pending changes from IndexedDB
   */
  private async clearFromIndexedDB(userId: string, confirmedIds: Set<string>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      try {
        const transaction = this.db.transaction([PENDING_CHANGES_STORE], 'readwrite');
        const objectStore = transaction.objectStore(PENDING_CHANGES_STORE);
        const index = objectStore.index('userId');
        const request = index.openCursor(IDBKeyRange.only(userId));

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const change = cursor.value;
            if (confirmedIds.has(change.data?.id)) {
              cursor.delete();
            }
            cursor.continue();
          }
        };

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => {
          console.error('Failed to clear from IndexedDB');
          resolve();
        };
      } catch (error) {
        console.error('Error in clearFromIndexedDB:', error);
        resolve();
      }
    });
  }

  private getPendingChanges(): any[] {
    return this.pendingChangesSubject.value;
  }

  /**
   * Add a pending change to the queue
   * Uses IndexedDB for persistence with localStorage fallback
   */
  private addPendingChange(type: 'task' | 'project', action: 'create' | 'update' | 'delete', data: any): void {
    const pending = [...this.pendingChangesSubject.value];
    const newChange = {
      type,
      action,
      data: { ...data, _action: action },
      timestamp: new Date().toISOString()
    };
    pending.push(newChange);
    this.pendingChangesSubject.next(pending);

    // Save to IndexedDB
    const user = this.authService.getCurrentUserSnapshot();
    const userId = user?.id || 'anonymous';
    
    if (this.db) {
      this.saveToIndexedDB(userId, pending).catch(error => {
        console.error('Failed to save to IndexedDB, using localStorage fallback:', error);
        this.savePendingToLocalStorage(pending);
      });
    } else {
      // Fallback to localStorage
      this.savePendingToLocalStorage(pending);
    }
  }

  /**
   * Fallback method to save pending changes to localStorage
   */
  private savePendingToLocalStorage(pending: any[]): void {
    const keys = this.getStorageKeys();
    try {
      localStorage.setItem(keys.PENDING_CHANGES_KEY, JSON.stringify(pending));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  /**
   * Clear confirmed changes from the pending queue
   * Updates both IndexedDB and in-memory state
   */
  private clearConfirmedChanges(confirmed: any): void {
    // Remove confirmed changes from pending
    const pending = this.pendingChangesSubject.value;
    const confirmedIds = new Set([
      ...confirmed.tasks.map((t: any) => t.id),
      ...confirmed.projects.map((p: any) => p.id)
    ]);
    
    const remaining = pending.filter(change => !confirmedIds.has(change.data.id));
    this.pendingChangesSubject.next(remaining);

    // Update IndexedDB
    const user = this.authService.getCurrentUserSnapshot();
    const userId = user?.id || 'anonymous';
    
    if (this.db) {
      this.clearFromIndexedDB(userId, confirmedIds).then(() => {
        // Save updated state to IndexedDB
        return this.saveToIndexedDB(userId, remaining);
      }).catch(error => {
        console.error('Failed to update IndexedDB, using localStorage fallback:', error);
        this.savePendingToLocalStorage(remaining);
      });
    } else {
      // Fallback to localStorage
      this.savePendingToLocalStorage(remaining);
    }
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
    const keys = this.getStorageKeys();
    return localStorage.getItem(keys.LAST_SYNC_KEY);
  }

  private setLastSync(timestamp: string): void {
    const keys = this.getStorageKeys();
    localStorage.setItem(keys.LAST_SYNC_KEY, timestamp);
    this.lastSyncTimeSubject.next(new Date(timestamp));
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Get detailed summary of pending changes
  getPendingChangesSummary(): Observable<PendingChangesSummary> {
    return new Observable(observer => {
      const pendingChanges = this.pendingChangesSubject.value;
      
      // Count changes by type and action
      const tasks = { create: 0, update: 0, delete: 0 };
      const projects = { create: 0, update: 0, delete: 0 };
      
      pendingChanges.forEach(change => {
        if (change.type === 'task') {
          tasks[change.action as keyof typeof tasks]++;
        } else if (change.type === 'project') {
          projects[change.action as keyof typeof projects]++;
        }
      });
      
      const summary: PendingChangesSummary = {
        total: pendingChanges.length,
        tasks,
        projects,
        changes: pendingChanges
      };
      
      observer.next(summary);
      observer.complete();
    });
  }

  // Data backup/export functionality - Export all data as JSON
  // Usage: Users can manually trigger this to backup their data
  // This helps mitigate data loss risk from localStorage being cleared
  exportData(): { tasks: Task[]; projects: Project[]; pendingChanges: any[]; exportDate: string } {
    return {
      tasks: this.tasksSubject.value,
      projects: this.projectsSubject.value,
      pendingChanges: this.pendingChangesSubject.value,
      exportDate: new Date().toISOString()
    };
  }

  // Import data from backup - Restores data from exported JSON
  // Usage: Users can restore data if localStorage is cleared
  // This merges imported data with existing data to prevent overwrites
  importData(data: { tasks: Task[]; projects: Project[]; pendingChanges?: any[] }): void {
    try {
      // Convert date strings to Date objects
      const processedTasks = data.tasks.map((task: any) => ({
        ...task,
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt),
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined
      }));

      const processedProjects = data.projects.map((project: any) => ({
        ...project,
        createdAt: new Date(project.createdAt),
        updatedAt: new Date(project.updatedAt)
      }));

      // Merge with existing data (avoid duplicates by ID)
      const existingTasks = this.tasksSubject.value;
      const existingProjects = this.projectsSubject.value;
      
      const taskMap = new Map(existingTasks.map(t => [t.id, t]));
      processedTasks.forEach(t => taskMap.set(t.id, t));
      
      const projectMap = new Map(existingProjects.map(p => [p.id, p]));
      processedProjects.forEach(p => projectMap.set(p.id, p));

      this.tasksSubject.next(Array.from(taskMap.values()));
      this.projectsSubject.next(Array.from(projectMap.values()));
      
      // Import pending changes if available
      if (data.pendingChanges) {
        const existingPending = this.pendingChangesSubject.value;
        const allPending = [...existingPending, ...data.pendingChanges];
        this.pendingChangesSubject.next(allPending);
        const keys = this.getStorageKeys();
        localStorage.setItem(keys.PENDING_CHANGES_KEY, JSON.stringify(allPending));
      }
      
      this.saveToStorage();
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }
}
