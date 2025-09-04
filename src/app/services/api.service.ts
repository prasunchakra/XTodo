import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Task, Project, TaskFilters } from '../models/task';

export interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
}

export interface TaskStatistics {
  total: number;
  completed: number;
  active: number;
  overdue: number;
  dueToday: number;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = environment.apiUrl;
  
  // Loading states
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Task endpoints
  getTasks(filters?: TaskFilters): Observable<Task[]> {
    let params = new HttpParams();
    
    if (filters) {
      if (filters.search) params = params.set('search', filters.search);
      if (filters.priority) params = params.set('priority', filters.priority);
      if (filters.projectId) params = params.set('projectId', filters.projectId);
      if (filters.dueDate) params = params.set('dueDate', filters.dueDate.toISOString());
      if (filters.completed !== undefined) params = params.set('completed', filters.completed.toString());
    }

    return this.http.get<Task[]>(`${this.baseUrl}/tasks`, { params })
      .pipe(
        map(tasks => this.convertDatesInTasks(tasks)),
        catchError(this.handleError)
      );
  }

  getTaskById(id: string): Observable<Task> {
    return this.http.get<Task>(`${this.baseUrl}/tasks/${id}`)
      .pipe(
        map(task => this.convertDatesInTask(task)),
        catchError(this.handleError)
      );
  }

  createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Observable<Task> {
    this.setLoading(true);
    return this.http.post<Task>(`${this.baseUrl}/tasks`, taskData)
      .pipe(
        map(task => this.convertDatesInTask(task)),
        catchError(this.handleError),
        map(task => {
          this.setLoading(false);
          return task;
        })
      );
  }

  updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Observable<Task> {
    this.setLoading(true);
    return this.http.put<Task>(`${this.baseUrl}/tasks/${id}`, updates)
      .pipe(
        map(task => this.convertDatesInTask(task)),
        catchError(this.handleError),
        map(task => {
          this.setLoading(false);
          return task;
        })
      );
  }

  toggleTaskCompletion(id: string): Observable<Task> {
    this.setLoading(true);
    return this.http.patch<Task>(`${this.baseUrl}/tasks/${id}/toggle`, {})
      .pipe(
        map(task => this.convertDatesInTask(task)),
        catchError(this.handleError),
        map(task => {
          this.setLoading(false);
          return task;
        })
      );
  }

  deleteTask(id: string): Observable<void> {
    this.setLoading(true);
    return this.http.delete<void>(`${this.baseUrl}/tasks/${id}`)
      .pipe(
        catchError(this.handleError),
        map(() => {
          this.setLoading(false);
          return;
        })
      );
  }

  getTasksGroupedByProject(): Observable<{ [projectId: string]: Task[] }> {
    return this.http.get<{ [projectId: string]: Task[] }>(`${this.baseUrl}/tasks/grouped/project`)
      .pipe(
        map(grouped => {
          const converted: { [projectId: string]: Task[] } = {};
          Object.keys(grouped).forEach(key => {
            converted[key] = this.convertDatesInTasks(grouped[key]);
          });
          return converted;
        }),
        catchError(this.handleError)
      );
  }

  getTasksWithProjects(): Observable<(Task & { project?: Project })[]> {
    return this.http.get<(Task & { project?: Project })[]>(`${this.baseUrl}/tasks/with-projects`)
      .pipe(
        map(tasks => this.convertDatesInTasks(tasks)),
        catchError(this.handleError)
      );
  }

  getTasksDueToday(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.baseUrl}/tasks/due-today`)
      .pipe(
        map(tasks => this.convertDatesInTasks(tasks)),
        catchError(this.handleError)
      );
  }

  getOverdueTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.baseUrl}/tasks/overdue`)
      .pipe(
        map(tasks => this.convertDatesInTasks(tasks)),
        catchError(this.handleError)
      );
  }

  getTasksByPriority(priority: Task['priority']): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.baseUrl}/tasks/priority/${priority}`)
      .pipe(
        map(tasks => this.convertDatesInTasks(tasks)),
        catchError(this.handleError)
      );
  }

  getCompletedTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.baseUrl}/tasks/completed`)
      .pipe(
        map(tasks => this.convertDatesInTasks(tasks)),
        catchError(this.handleError)
      );
  }

  getActiveTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.baseUrl}/tasks/active`)
      .pipe(
        map(tasks => this.convertDatesInTasks(tasks)),
        catchError(this.handleError)
      );
  }

  getTaskStatistics(): Observable<TaskStatistics> {
    return this.http.get<TaskStatistics>(`${this.baseUrl}/tasks/statistics`)
      .pipe(
        catchError(this.handleError)
      );
  }

  // Project endpoints
  getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.baseUrl}/projects`)
      .pipe(
        map(projects => this.convertDatesInProjects(projects)),
        catchError(this.handleError)
      );
  }

  getProjectById(id: string): Observable<Project> {
    return this.http.get<Project>(`${this.baseUrl}/projects/${id}`)
      .pipe(
        map(project => this.convertDatesInProject(project)),
        catchError(this.handleError)
      );
  }

  createProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Observable<Project> {
    this.setLoading(true);
    return this.http.post<Project>(`${this.baseUrl}/projects`, projectData)
      .pipe(
        map(project => this.convertDatesInProject(project)),
        catchError(this.handleError),
        map(project => {
          this.setLoading(false);
          return project;
        })
      );
  }

  updateProject(id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>): Observable<Project> {
    this.setLoading(true);
    return this.http.put<Project>(`${this.baseUrl}/projects/${id}`, updates)
      .pipe(
        map(project => this.convertDatesInProject(project)),
        catchError(this.handleError),
        map(project => {
          this.setLoading(false);
          return project;
        })
      );
  }

  deleteProject(id: string): Observable<void> {
    this.setLoading(true);
    return this.http.delete<void>(`${this.baseUrl}/projects/${id}`)
      .pipe(
        catchError(this.handleError),
        map(() => {
          this.setLoading(false);
          return;
        })
      );
  }

  // Utility methods
  private setLoading(loading: boolean): void {
    this.loadingSubject.next(loading);
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Server Error: ${error.status} - ${error.error?.message || error.message}`;
    }
    
    console.error('API Error:', errorMessage, error);
    return throwError(() => new Error(errorMessage));
  }

  // Date conversion helpers
  private convertDatesInTasks(tasks: Task[]): Task[] {
    return tasks.map(task => this.convertDatesInTask(task));
  }

  private convertDatesInTask(task: Task): Task {
    return {
      ...task,
      createdAt: new Date(task.createdAt),
      updatedAt: new Date(task.updatedAt),
      dueDate: task.dueDate ? new Date(task.dueDate) : undefined
    };
  }

  private convertDatesInProjects(projects: Project[]): Project[] {
    return projects.map(project => this.convertDatesInProject(project));
  }

  private convertDatesInProject(project: Project): Project {
    return {
      ...project,
      createdAt: new Date(project.createdAt),
      updatedAt: new Date(project.updatedAt)
    };
  }
}
