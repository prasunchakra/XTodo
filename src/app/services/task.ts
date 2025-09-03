import { Injectable } from '@angular/core';
import { Observable, combineLatest, map, switchMap, of } from 'rxjs';
import { StorageService } from './storage';
import { Task, Project, TaskFilters } from '../models/task';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  constructor(private storageService: StorageService) {}

  // Get all tasks with optional filtering
  getTasks(filters?: TaskFilters): Observable<Task[]> {
    return this.storageService.getTasks().pipe(
      map(tasks => this.applyFilters(tasks, filters))
    );
  }

  // Get tasks grouped by project
  getTasksByProject(): Observable<{ [projectId: string]: Task[] }> {
    return this.storageService.getTasks().pipe(
      map(tasks => {
        const grouped: { [projectId: string]: Task[] } = {};
        tasks.forEach(task => {
          const projectId = task.projectId || 'unassigned';
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
      this.storageService.getTasks(),
      this.storageService.getProjects()
    ]).pipe(
      map(([tasks, projects]) => {
        return tasks.map(task => ({
          ...task,
          project: projects.find(p => p.id === task.projectId)
        }));
      })
    );
  }

  // Get tasks due today
  getTasksDueToday(): Observable<Task[]> {
    return this.storageService.getTasks().pipe(
      map(tasks => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        return tasks.filter(task => 
          task.dueDate && 
          !task.completed &&
          task.dueDate >= today && 
          task.dueDate < tomorrow
        );
      })
    );
  }

  // Get overdue tasks
  getOverdueTasks(): Observable<Task[]> {
    return this.storageService.getTasks().pipe(
      map(tasks => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return tasks.filter(task => 
          task.dueDate && 
          !task.completed &&
          task.dueDate < today
        );
      })
    );
  }

  // Get tasks by priority
  getTasksByPriority(priority: Task['priority']): Observable<Task[]> {
    return this.storageService.getTasks().pipe(
      map(tasks => tasks.filter(task => task.priority === priority))
    );
  }

  // Get completed tasks
  getCompletedTasks(): Observable<Task[]> {
    return this.storageService.getTasks().pipe(
      map(tasks => tasks.filter(task => task.completed))
    );
  }

  // Get active tasks (not completed)
  getActiveTasks(): Observable<Task[]> {
    return this.storageService.getTasks().pipe(
      map(tasks => tasks.filter(task => !task.completed))
    );
  }

  // Add a new task
  addTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Observable<Task> {
    return this.storageService.addTask(taskData);
  }

  // Update a task
  updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Observable<Task | undefined> {
    return this.storageService.updateTask(id, updates);
  }

  // Toggle task completion
  toggleTaskCompletion(id: string): Observable<Task | undefined> {
    return this.storageService.getTaskById(id).pipe(
      switchMap(task => {
        if (task) {
          return this.storageService.updateTask(id, { completed: !task.completed });
        }
        return of(undefined);
      })
    );
  }

  // Delete a task
  deleteTask(id: string): Observable<boolean> {
    return this.storageService.deleteTask(id);
  }

  // Get task statistics
  getTaskStatistics(): Observable<{
    total: number;
    completed: number;
    active: number;
    overdue: number;
    dueToday: number;
  }> {
    return combineLatest([
      this.storageService.getTasks(),
      this.getOverdueTasks(),
      this.getTasksDueToday()
    ]).pipe(
      map(([allTasks, overdueTasks, dueTodayTasks]) => ({
        total: allTasks.length,
        completed: allTasks.filter(t => t.completed).length,
        active: allTasks.filter(t => !t.completed).length,
        overdue: overdueTasks.length,
        dueToday: dueTodayTasks.length
      }))
    );
  }

  // Private helper methods
  private applyFilters(tasks: Task[], filters?: TaskFilters): Task[] {
    if (!filters) return tasks;

    return tasks.filter(task => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!task.title.toLowerCase().includes(searchLower) &&
            !(task.description?.toLowerCase().includes(searchLower))) {
          return false;
        }
      }

      // Priority filter
      if (filters.priority && task.priority !== filters.priority) {
        return false;
      }

      // Project filter
      if (filters.projectId && task.projectId !== filters.projectId) {
        return false;
      }

      // Due date filter
      if (filters.dueDate) {
        const filterDate = new Date(filters.dueDate);
        filterDate.setHours(0, 0, 0, 0);
        if (task.dueDate) {
          const taskDate = new Date(task.dueDate);
          taskDate.setHours(0, 0, 0, 0);
          if (taskDate.getTime() !== filterDate.getTime()) {
            return false;
          }
        } else {
          return false;
        }
      }

      // Completion filter
      if (filters.completed !== undefined && task.completed !== filters.completed) {
        return false;
      }

      return true;
    });
  }
}
