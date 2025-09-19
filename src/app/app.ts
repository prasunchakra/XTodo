import { Component, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// PrimeNG Components
import { MenubarModule } from 'primeng/menubar';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet,   
    CommonModule,
    RouterModule,
    MenubarModule,
    ButtonModule,
    BadgeModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  title = signal('xTodo');
  
  constructor(private auth: AuthService, private router: Router) {}

  isAuthenticated(): boolean {
    return !!this.auth.getToken();
  }

  signout(): void {
    this.auth.signout();
    this.router.navigate(['/']);
  }
}
