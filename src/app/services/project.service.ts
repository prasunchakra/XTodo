import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { SyncService } from './sync.service';
import { Project } from '../models/task';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private syncService = inject(SyncService);

  // Get all projects
  getProjects(): Observable<Project[]> {
    return this.syncService.projects$;
  }

  // Get a specific project by ID
  getProjectById(id: string): Observable<Project> {
    return this.syncService.projects$.pipe(
      map(projects => {
        const project = projects.find(p => p.id === id);
        if (!project) {
          throw new Error('Project not found');
        }
        return project;
      })
    );
  }

  // Create a new project
  addProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Observable<Project> {
    const newProject = this.syncService.addProject(projectData);
    return of(newProject);
  }

  // Update an existing project
  updateProject(id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>): Observable<Project> {
    const updatedProject = this.syncService.updateProject(id, updates);
    if (!updatedProject) {
      return throwError(() => new Error('Project not found'));
    }
    return of(updatedProject);
  }

  // Delete a project
  deleteProject(id: string): Observable<void> {
    const success = this.syncService.deleteProject(id);
    if (!success) {
      return throwError(() => new Error('Project not found'));
    }
    return of(undefined);
  }
}