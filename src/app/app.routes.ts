import { Routes } from '@angular/router';
import { TodoComponent } from './components/todo/todo';
import { ProjectManagementComponent } from './components/project-management/project-management';
import { SigninComponent } from './components/auth/signin';
import { AuthGuard } from './services/auth.guard';

export const routes: Routes = [
  { path: '', component: SigninComponent },
  { path: 'app', component: TodoComponent, canActivate: [AuthGuard] },
  { path: 'projects', component: ProjectManagementComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '' }
];
