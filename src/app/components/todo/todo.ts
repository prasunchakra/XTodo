import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

// PrimeNG Components
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ChipModule } from 'primeng/chip';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';

// Services and Models
import { TaskService } from '../../services/task';
import { ProjectService } from '../../services/project.service';
import { SyncService, SyncStatus, PendingChangesSummary } from '../../services/sync.service';
import { Task, Project, TaskFilters } from '../../models/task';

type ViewType = 'all' | 'active' | 'completed';

@Component({
  selector: 'app-todo',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    CheckboxModule,
    DialogModule,
    ConfirmDialogModule,
    ToastModule,
    ChipModule,
    BadgeModule,
    TooltipModule
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './todo.html',
  styleUrls: ['./todo.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodoComponent implements OnInit, OnDestroy {
  tasks: Task[] = [];
  projects: Project[] = [];
  filteredTasks: Task[] = [];
  groupedTasks: { project: Project | null; tasks: Task[] }[] = [];
  statistics: any = {};
  isSyncing = false;
  pendingChanges = 0;
  pendingChangesSummary: PendingChangesSummary | null = null;
  showProjectGroups = true;
  syncStatus: SyncStatus = 'idle';
  lastSyncTime: Date | null = null;
  isOnline = true;
  showPendingDetailsDialog = false;
  
  // Form data
  newTask: Partial<Task> = {
    title: '',
    description: '',
    priority: 'Medium',
    dueDate: undefined,
    projectId: undefined
  };
  
  // Validation errors
  taskTitleError = '';
  taskDescriptionError = '';
  
  // UI state
  showAddDialog = false;
  showProjectDialog = false;
  filters: TaskFilters = {};
  selectedView: ViewType = 'all';
  
  // Priority options
  priorityOptions = [
    { label: 'Low', value: 'Low', color: 'bg-green-100 text-green-800' },
    { label: 'Medium', value: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
    { label: 'High', value: 'High', color: 'bg-red-100 text-red-800' }
  ];
  
  // View options
  viewOptions: ViewType[] = ['all', 'active', 'completed'];
  
  private destroy$ = new Subject<void>();

  private taskService = inject(TaskService);
  private projectService = inject(ProjectService);
  private syncService = inject(SyncService);
  private confirmationService = inject(ConfirmationService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.loadData();
    this.loadStatistics();
    this.subscribeToPendingChanges();
    this.subscribeToSyncStatus();
    this.subscribeToOnlineStatus();
    this.subscribeToLastSyncTime();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.taskService.getTasksWithProjects()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tasks) => {
          this.tasks = tasks;
          this.applyFilters();
        },
        error: (error) => {
          console.error('Error loading tasks:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load tasks. Please try again.'
          });
        }
      });

    this.projectService.getProjects()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (projects) => {
          this.projects = projects;
        },
        error: (error) => {
          console.error('Error loading projects:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load projects. Please try again.'
          });
        }
      });
  }

  loadStatistics(): void {
    this.taskService.getTaskStatistics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.statistics = stats;
        },
        error: (error) => {
          console.error('Error loading statistics:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load statistics. Please try again.'
          });
        }
      });
  }

  // Sanitize input by removing HTML tags and trimming
  private sanitizeInput(input: string): string {
    return input.replace(/<[^>]*>/g, '').trim();
  }

  validateTaskTitle(): void {
    const title = this.newTask.title?.trim() || '';
    if (!title) {
      this.taskTitleError = 'Task title is required';
    } else if (title.length > 200) {
      this.taskTitleError = 'Task title must be less than 200 characters';
    } else {
      this.taskTitleError = '';
    }
  }

  validateTaskDescription(): void {
    const description = this.newTask.description?.trim() || '';
    if (description.length > 1000) {
      this.taskDescriptionError = 'Description must be less than 1000 characters';
    } else {
      this.taskDescriptionError = '';
    }
  }

  addTask(): void {
    this.validateTaskTitle();
    this.validateTaskDescription();

    if (this.taskTitleError || this.taskDescriptionError) {
      return;
    }

    if (!this.newTask.title?.trim()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Task title is required. Please enter a title for your task.'
      });
      return;
    }

    if (this.newTask.title.trim().length > 200) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Task title is too long. Maximum 200 characters allowed.'
      });
      return;
    }

    if (this.newTask.description && this.newTask.description.trim().length > 1000) {
      this.messageService.add({
        severity: 'error',
        summary: 'Validation Error',
        detail: 'Task description is too long. Maximum 1000 characters allowed.'
      });
      return;
    }

    const taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'userId'> = {
      title: this.sanitizeInput(this.newTask.title),
      description: this.sanitizeInput(this.newTask.description || ''),
      completed: false,
      priority: this.newTask.priority || 'Medium',
      dueDate: this.newTask.dueDate,
      projectId: this.newTask.projectId
    };

    this.taskService.addTask(taskData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Task added successfully'
          });
          this.resetNewTask();
          this.showAddDialog = false;
          this.loadData();
          this.loadStatistics();
        },
        error: (error) => {
          console.error('Error adding task:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to add task. Please try again.'
          });
        }
      });
  }

  toggleTaskCompletion(task: Task): void {
    this.taskService.toggleTaskCompletion(task.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadData();
          this.loadStatistics();
        },
        error: (error) => {
          console.error('Error toggling task completion:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to update task. Please try again.'
          });
        }
      });
  }

  deleteTask(task: Task): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete "${task.title}"?`,
      header: 'Delete Confirmation',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.taskService.deleteTask(task.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Task deleted successfully'
              });
              this.loadData();
              this.loadStatistics();
            },
            error: (error) => {
              console.error('Error deleting task:', error);
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to delete task. Please try again.'
              });
            }
          });
      }
    });
  }

  addProject(): void {
    // This will be implemented in the project management component
    this.showProjectDialog = true;
  }

  setView(view: ViewType): void {
    this.selectedView = view;
    this.applyFilters();
  }

  applyFilters(): void {
    // Create filters object for backend
    const backendFilters: TaskFilters = { ...this.filters };

    // Apply view filter
    switch (this.selectedView) {
      case 'active':
        backendFilters.completed = false;
        break;
      case 'completed':
        backendFilters.completed = true;
        break;
    }

    // Load tasks with filters from backend
    this.taskService.getTasksWithProjects()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tasks) => {
          this.tasks = tasks;
          this.filteredTasks = tasks;
          this.groupTasksByProject();
        },
        error: (error) => {
          console.error('Error applying filters:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to apply filters. Please try again.'
          });
        }
      });
  }

  groupTasksByProject(): void {
    const grouped: { project: Project | null; tasks: Task[] }[] = [];
    
    // Group tasks by project
    const tasksByProject = new Map<string, Task[]>();
    const tasksWithoutProject: Task[] = [];
    
    this.filteredTasks.forEach(task => {
      if (task.projectId) {
        const projectTasks = tasksByProject.get(task.projectId) || [];
        projectTasks.push(task);
        tasksByProject.set(task.projectId, projectTasks);
      } else {
        tasksWithoutProject.push(task);
      }
    });
    
    // Add tasks without project first
    if (tasksWithoutProject.length > 0) {
      grouped.push({ project: null, tasks: tasksWithoutProject });
    }
    
    // Add tasks grouped by project
    this.projects.forEach(project => {
      const projectTasks = tasksByProject.get(project.id);
      if (projectTasks && projectTasks.length > 0) {
        grouped.push({ project, tasks: projectTasks });
      }
    });
    
    this.groupedTasks = grouped;
  }

  toggleProjectGrouping(): void {
    this.showProjectGroups = !this.showProjectGroups;
  }

  resetNewTask(): void {
    this.newTask = {
      title: '',
      description: '',
      priority: 'Medium',
      dueDate: undefined,
      projectId: undefined
    };
    this.taskTitleError = '';
    this.taskDescriptionError = '';
  }

  getPriorityColor(priority: Task['priority']): string {
    const option = this.priorityOptions.find(p => p.value === priority);
    return option?.color || 'bg-gray-100 text-gray-800';
  }

  getProjectColor(projectId?: string): string {
    if (!projectId) return 'bg-gray-100 text-gray-600';
    const project = this.projects.find(p => p.id === projectId);
    return project ? `bg-[${project.color}]20 text-[${project.color}]` : 'bg-gray-100 text-gray-600';
  }

  getProjectName(projectId?: string): string {
    if (!projectId) return '';
    const project = this.projects.find(p => p.id === projectId);
    return project?.name || '';
  }

  isOverdue(task: Task): boolean {
    if (!task.dueDate || task.completed) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return task.dueDate < today;
  }

  isDueToday(task: Task): boolean {
    if (!task.dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return task.dueDate >= today && task.dueDate < tomorrow;
  }

  // Sync methods
  syncWithServer(): void {
    if (this.isSyncing) return;
    
    // Check if online
    if (!this.isOnline) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Offline',
        detail: 'Cannot sync while offline. Changes will be synced when connection is restored.'
      });
      return;
    }
    
    this.isSyncing = true;
    this.syncService.syncWithServer()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Sync Complete',
            detail: 'Data synchronized successfully with server'
          });
          this.isSyncing = false;
          this.loadData();
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Sync failed:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Sync Failed',
            detail: 'Failed to sync with server. Your changes are saved locally and will sync later.'
          });
          this.isSyncing = false;
          this.cdr.markForCheck();
        }
      });
  }

  private subscribeToPendingChanges(): void {
    this.syncService.pendingChanges$
      .pipe(takeUntil(this.destroy$))
      .subscribe(changes => {
        this.pendingChanges = changes.length;
        this.cdr.markForCheck();
      });
    
    // Also subscribe to detailed summary
    this.syncService.getPendingChangesSummary()
      .pipe(takeUntil(this.destroy$))
      .subscribe(summary => {
        this.pendingChangesSummary = summary;
        this.cdr.markForCheck();
      });
  }

  private subscribeToSyncStatus(): void {
    this.syncService.syncStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.syncStatus = status;
        this.cdr.markForCheck();
      });
  }

  private subscribeToOnlineStatus(): void {
    this.syncService.onlineStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.isOnline = status.isOnline;
        
        // Show notification when going offline/online
        if (!status.isOnline && this.isOnline !== status.isOnline) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Offline',
            detail: 'You are offline. Changes will be saved locally.'
          });
        } else if (status.isOnline && this.isOnline !== status.isOnline) {
          this.messageService.add({
            severity: 'info',
            summary: 'Online',
            detail: 'Connection restored. You can now sync your changes.'
          });
        }
        
        this.cdr.markForCheck();
      });
  }

  private subscribeToLastSyncTime(): void {
    this.syncService.lastSyncTime$
      .pipe(takeUntil(this.destroy$))
      .subscribe(time => {
        this.lastSyncTime = time;
        this.cdr.markForCheck();
      });
  }

  showPendingDetails(): void {
    // Refresh the summary before showing
    this.syncService.getPendingChangesSummary()
      .pipe(takeUntil(this.destroy$))
      .subscribe(summary => {
        this.pendingChangesSummary = summary;
        this.showPendingDetailsDialog = true;
        this.cdr.markForCheck();
      });
  }

  getSyncStatusIcon(): string {
    switch (this.syncStatus) {
      case 'syncing': return 'pi pi-spin pi-spinner';
      case 'success': return 'pi pi-check-circle';
      case 'error': return 'pi pi-exclamation-circle';
      default: return 'pi pi-circle';
    }
  }

  getSyncStatusColor(): string {
    switch (this.syncStatus) {
      case 'syncing': return 'text-blue-600';
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-400';
    }
  }

  getTimeSinceLastSync(): string {
    if (!this.lastSyncTime) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - this.lastSyncTime.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }

  // Data backup methods - Export/Import functionality
  // These methods help mitigate data loss risk from localStorage being cleared
  exportDataBackup(): void {
    try {
      const data = this.syncService.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `xtodo-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      this.messageService.add({
        severity: 'success',
        summary: 'Export Complete',
        detail: 'Data exported successfully. Keep this file safe for backup.'
      });
    } catch (error) {
      console.error('Export failed:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Export Failed',
        detail: 'Failed to export data. Please try again.'
      });
    }
  }

  importDataBackup(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = JSON.parse(e.target.result);
        this.syncService.importData(data);
        
        this.messageService.add({
          severity: 'success',
          summary: 'Import Complete',
          detail: 'Data imported successfully. Your tasks and projects have been restored.'
        });
        
        // Reload data
        this.loadData();
        this.loadStatistics();
      } catch (error) {
        console.error('Import failed:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Import Failed',
          detail: 'Failed to import data. Please check the file format.'
        });
      }
    };
    reader.readAsText(file);
  }
}
