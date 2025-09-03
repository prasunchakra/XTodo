import { Component, OnInit, OnDestroy } from '@angular/core';
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
import { StorageService } from '../../services/storage';
import { Task, Project, TaskFilters } from '../../models/task';

type ViewType = 'all' | 'active' | 'completed';

@Component({
  selector: 'app-todo',
  standalone: true,
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
  styleUrls: ['./todo.css']
})
export class TodoComponent implements OnInit, OnDestroy {
  tasks: Task[] = [];
  projects: Project[] = [];
  filteredTasks: Task[] = [];
  statistics: any = {};
  
  // Form data
  newTask: Partial<Task> = {
    title: '',
    description: '',
    priority: 'Medium',
    dueDate: undefined,
    projectId: undefined
  };
  
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

  constructor(
    private taskService: TaskService,
    private storageService: StorageService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.loadStatistics();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.taskService.getTasksWithProjects()
      .pipe(takeUntil(this.destroy$))
      .subscribe(tasks => {
        this.tasks = tasks;
        this.applyFilters();
      });

    this.storageService.getProjects()
      .pipe(takeUntil(this.destroy$))
      .subscribe(projects => {
        this.projects = projects;
      });
  }

  loadStatistics(): void {
    this.taskService.getTaskStatistics()
      .pipe(takeUntil(this.destroy$))
      .subscribe(stats => {
        this.statistics = stats;
      });
  }

  addTask(): void {
    if (!this.newTask.title?.trim()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Task title is required'
      });
      return;
    }

    const taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
      title: this.newTask.title.trim(),
      description: this.newTask.description?.trim() || '',
      completed: false,
      priority: this.newTask.priority || 'Medium',
      dueDate: this.newTask.dueDate,
      projectId: this.newTask.projectId
    };

    this.taskService.addTask(taskData)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Task added successfully'
        });
        this.resetNewTask();
        this.showAddDialog = false;
        this.loadData();
        this.loadStatistics();
      });
  }

  toggleTaskCompletion(task: Task): void {
    this.taskService.toggleTaskCompletion(task.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadData();
        this.loadStatistics();
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
          .subscribe(() => {
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Task deleted successfully'
            });
            this.loadData();
            this.loadStatistics();
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
    let filtered = [...this.tasks];

    // Apply view filter
    switch (this.selectedView) {
      case 'active':
        filtered = filtered.filter(task => !task.completed);
        break;
      case 'completed':
        filtered = filtered.filter(task => task.completed);
        break;
    }

    // Apply other filters
    if (this.filters.search) {
      const searchLower = this.filters.search.toLowerCase();
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchLower) ||
        (task.description?.toLowerCase().includes(searchLower))
      );
    }

    if (this.filters.priority) {
      filtered = filtered.filter(task => task.priority === this.filters.priority);
    }

    if (this.filters.projectId) {
      filtered = filtered.filter(task => task.projectId === this.filters.projectId);
    }

    this.filteredTasks = filtered;
  }

  resetNewTask(): void {
    this.newTask = {
      title: '',
      description: '',
      priority: 'Medium',
      dueDate: undefined,
      projectId: undefined
    };
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
}
