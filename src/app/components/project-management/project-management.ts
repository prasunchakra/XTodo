import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

// PrimeNG Components
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ColorPickerModule } from 'primeng/colorpicker';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';

// Services and Models
import { ProjectService } from '../../services/project.service';
import { TaskService } from '../../services/task';
import { Project, Task } from '../../models/task';

@Component({
  selector: 'app-project-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    DialogModule,
    ConfirmDialogModule,
    ToastModule,
    ColorPickerModule,
    BadgeModule,
    TooltipModule
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './project-management.html',
  styleUrls: ['./project-management.css']
})
export class ProjectManagementComponent implements OnInit, OnDestroy {
  projects: Project[] = [];
  tasksByProject: { [projectId: string]: Task[] } = {};
  
  // Form data
  newProject: Partial<Project> = {
    name: '',
    description: '',
    color: '#3B82F6'
  };
  
  editingProject: Project | null = null;
  
  // UI state
  showAddDialog = false;
  showEditDialog = false;
  
  // Color presets
  colorPresets = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
  ];
  
  private destroy$ = new Subject<void>();

  constructor(
    private projectService: ProjectService,
    private taskService: TaskService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
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

    this.taskService.getTasksByProject()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (tasksByProject) => {
          this.tasksByProject = tasksByProject;
        },
        error: (error) => {
          console.error('Error loading tasks by project:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load task data. Please try again.'
          });
        }
      });
  }

  addProject(): void {
    if (!this.newProject.name?.trim()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Project name is required'
      });
      return;
    }

    const projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'> = {
      name: this.newProject.name.trim(),
      description: this.newProject.description?.trim() || '',
      color: this.newProject.color || '#3B82F6'
    };

    this.projectService.addProject(projectData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Project created successfully'
          });
          this.resetNewProject();
          this.showAddDialog = false;
          this.loadData();
        },
        error: (error) => {
          console.error('Error creating project:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to create project. Please try again.'
          });
        }
      });
  }

  editProject(): void {
    if (!this.editingProject || !this.editingProject.name?.trim()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Project name is required'
      });
      return;
    }

    const updates: Partial<Omit<Project, 'id' | 'createdAt'>> = {
      name: this.editingProject.name.trim(),
      description: this.editingProject.description?.trim() || '',
      color: this.editingProject.color
    };

    this.projectService.updateProject(this.editingProject.id, updates)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Project updated successfully'
          });
          this.editingProject = null;
          this.showEditDialog = false;
          this.loadData();
        },
        error: (error) => {
          console.error('Error updating project:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to update project. Please try again.'
          });
        }
      });
  }

  deleteProject(project: Project): void {
    const taskCount = this.tasksByProject[project.id]?.length || 0;
    const message = taskCount > 0 
      ? `Are you sure you want to delete "${project.name}"? This will remove the project from ${taskCount} associated tasks.`
      : `Are you sure you want to delete "${project.name}"?`;

    this.confirmationService.confirm({
      message: message,
      header: 'Delete Project Confirmation',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.projectService.deleteProject(project.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.messageService.add({
                severity: 'success',
                summary: 'Success',
                detail: 'Project deleted successfully'
              });
              this.loadData();
            },
            error: (error) => {
              console.error('Error deleting project:', error);
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Failed to delete project. Please try again.'
              });
            }
          });
      }
    });
  }

  openEditDialog(project: Project): void {
    this.editingProject = { ...project };
    this.showEditDialog = true;
  }

  resetNewProject(): void {
    this.newProject = {
      name: '',
      description: '',
      color: '#3B82F6'
    };
  }

  getTaskCount(projectId: string): number {
    return this.tasksByProject[projectId]?.length || 0;
  }

  getCompletedTaskCount(projectId: string): number {
    const tasks = this.tasksByProject[projectId] || [];
    return tasks.filter(task => task.completed).length;
  }

  getProjectProgress(projectId: string): number {
    const total = this.getTaskCount(projectId);
    if (total === 0) return 0;
    const completed = this.getCompletedTaskCount(projectId);
    return Math.round((completed / total) * 100);
  }

  selectColor(color: string): void {
    if (this.editingProject) {
      this.editingProject.color = color;
    } else {
      this.newProject.color = color;
    }
  }

  getProjectColorStyle(color: string): string {
    return `background-color: ${color}; color: white;`;
  }

  getProjectTextColor(color: string): string {
    // Simple logic to determine if text should be black or white based on background color
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? 'text-black' : 'text-white';
  }
}
