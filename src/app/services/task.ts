import { Injectable } from '@angular/core';
import { Observable, combineLatest, map, switchMap, of } from 'rxjs';
import { ApiService } from './api.service';
import { Task, Project, TaskFilters } from '../models/task';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  constructor(private apiService: ApiService) {}

  // Get all tasks with optional filtering
  getTasks(filters?: TaskFilters): Observable<Task[]> {
    return this.apiService.getTasks(filters);
  }

  // Get tasks grouped by project
  getTasksByProject(): Observable<{ [projectId: string]: Task[] }> {
    return this.apiService.getTasksGroupedByProject();
  }

  // Get tasks with project information
  getTasksWithProjects(): Observable<(Task & { project?: Project })[]> {
    return this.apiService.getTasksWithProjects();
  }

  // Get tasks due today
  getTasksDueToday(): Observable<Task[]> {
    return this.apiService.getTasksDueToday();
  }

  // Get overdue tasks
  getOverdueTasks(): Observable<Task[]> {
    return this.apiService.getOverdueTasks();
  }

  // Get tasks by priority
  getTasksByPriority(priority: Task['priority']): Observable<Task[]> {
    return this.apiService.getTasksByPriority(priority);
  }

  // Get completed tasks
  getCompletedTasks(): Observable<Task[]> {
    return this.apiService.getCompletedTasks();
  }

  // Get active tasks (not completed)
  getActiveTasks(): Observable<Task[]> {
    return this.apiService.getActiveTasks();
  }

  // Add a new task
  addTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Observable<Task> {
    return this.apiService.createTask(taskData);
  }

  // Update a task
  updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Observable<Task> {
    return this.apiService.updateTask(id, updates);
  }

  // Toggle task completion
  toggleTaskCompletion(id: string): Observable<Task> {
    return this.apiService.toggleTaskCompletion(id);
  }

  // Delete a task
  deleteTask(id: string): Observable<void> {
    return this.apiService.deleteTask(id);
  }

  // Get task statistics
  getTaskStatistics(): Observable<{
    total: number;
    completed: number;
    active: number;
    overdue: number;
    dueToday: number;
  }> {
    return this.apiService.getTaskStatistics();
  }

}
