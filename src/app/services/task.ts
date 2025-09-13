import { Injectable } from '@angular/core';
import { Observable, combineLatest, map, of, throwError } from 'rxjs';
import { SyncService } from './sync.service';
import { Task, Project, TaskFilters } from '../models/task';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  constructor(private syncService: SyncService) {}

  // Get all tasks with optional filtering
  getTasks(filters?: TaskFilters): Observable<Task[]> {
    return this.syncService.tasks$.pipe(
      map(tasks => this.applyFilters(tasks, filters))
    );
  }

  // Get tasks grouped by project
  getTasksByProject(): Observable<{ [projectId: string]: Task[] }> {
    return this.syncService.tasks$.pipe(
      map(tasks => {
        const grouped: { [projectId: string]: Task[] } = {};
        tasks.forEach(task => {
          const projectId = task.projectId || 'no-project';
          if (!grouped[projectId]) {
            grouped[projectId] = [];
          }
          grouped[projectId].push(task);
        });
        return grouped;
      })
    );
  }

  // Get tasks with project information
  getTasksWithProjects(): Observable<(Task & { project?: Project })[]> {
    return combineLatest([
      this.syncService.tasks$,
      this.syncService.projects$
    ]).pipe(
      map(([tasks, projects]) => {
        const projectMap = new Map(projects.map(p => [p.id, p]));
        return tasks.map(task => ({
          ...task,
          project: task.projectId ? projectMap.get(task.projectId) : undefined
        }));
      })
    );
  }

  // Get tasks due today
  getTasksDueToday(): Observable<Task[]> {
    return this.syncService.tasks$.pipe(
      map(tasks => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        return tasks.filter(task => {
          if (!task.dueDate) return false;
          const dueDate = new Date(task.dueDate);
          return dueDate >= today && dueDate < tomorrow;
        });
      })
    );
  }

  // Get overdue tasks
  getOverdueTasks(): Observable<Task[]> {
    return this.syncService.tasks$.pipe(
      map(tasks => {
        const now = new Date();
        return tasks.filter(task => 
          !task.completed && 
          task.dueDate && 
          new Date(task.dueDate) < now
        );
      })
    );
  }

  // Get tasks by priority
  getTasksByPriority(priority: Task['priority']): Observable<Task[]> {
    return this.syncService.tasks$.pipe(
      map(tasks => tasks.filter(task => task.priority === priority))
    );
  }

  // Get completed tasks
  getCompletedTasks(): Observable<Task[]> {
    return this.syncService.tasks$.pipe(
      map(tasks => tasks.filter(task => task.completed))
    );
  }

  // Get active tasks (not completed)
  getActiveTasks(): Observable<Task[]> {
    return this.syncService.tasks$.pipe(
      map(tasks => tasks.filter(task => !task.completed))
    );
  }

  // Add a new task
  addTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Observable<Task> {
    const newTask = this.syncService.addTask(taskData);
    return of(newTask);
  }

  // Update a task
  updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>): Observable<Task> {
    const updatedTask = this.syncService.updateTask(id, updates);
    if (!updatedTask) {
      return throwError(() => new Error('Task not found'));
    }
    return of(updatedTask);
  }

  // Toggle task completion
  toggleTaskCompletion(id: string): Observable<Task> {
    const currentTasks = this.syncService.tasksSubject.value;
    const task = currentTasks.find(t => t.id === id);
    if (!task) {
      return throwError(() => new Error('Task not found'));
    }
    
    const updatedTask = this.syncService.updateTask(id, { completed: !task.completed });
    return of(updatedTask!);
  }

  // Delete a task
  deleteTask(id: string): Observable<void> {
    const success = this.syncService.deleteTask(id);
    if (!success) {
      return throwError(() => new Error('Task not found'));
    }
    return of(undefined);
  }

  // Get task statistics
  getTaskStatistics(): Observable<{
    total: number;
    completed: number;
    active: number;
    overdue: number;
    dueToday: number;
  }> {
    return this.syncService.getStatistics();
  }

  // Private helper method for filtering
  private applyFilters(tasks: Task[], filters?: TaskFilters): Task[] {
    if (!filters) return tasks;

    return tasks.filter(task => {
      if (filters.search && !task.title.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      if (filters.priority && task.priority !== filters.priority) {
        return false;
      }
      if (filters.projectId && task.projectId !== filters.projectId) {
        return false;
      }
      if (filters.completed !== undefined && task.completed !== filters.completed) {
        return false;
      }
      if (filters.dueDate) {
        const taskDueDate = task.dueDate ? new Date(task.dueDate) : null;
        const filterDueDate = new Date(filters.dueDate);
        if (!taskDueDate || taskDueDate.toDateString() !== filterDueDate.toDateString()) {
          return false;
        }
      }
      return true;
    });
  }
}