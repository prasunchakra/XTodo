import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Project } from '../models/task';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  constructor(private apiService: ApiService) {}

  // Get all projects
  getProjects(): Observable<Project[]> {
    return this.apiService.getProjects();
  }

  // Get a specific project by ID
  getProjectById(id: string): Observable<Project> {
    return this.apiService.getProjectById(id);
  }

  // Create a new project
  addProject(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Observable<Project> {
    return this.apiService.createProject(projectData);
  }

  // Update an existing project
  updateProject(id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>): Observable<Project> {
    return this.apiService.updateProject(id, updates);
  }

  // Delete a project
  deleteProject(id: string): Observable<void> {
    return this.apiService.deleteProject(id);
  }
}
