import { Routes } from '@angular/router';
import { TodoComponent } from './components/todo/todo';
import { ProjectManagementComponent } from './components/project-management/project-management';

export const routes: Routes = [
  { path: '', component: TodoComponent },
  { path: 'projects', component: ProjectManagementComponent },
  { path: '**', redirectTo: '' }
];
