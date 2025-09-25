import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
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
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  title = signal('xTodo');
  
  private auth = inject(AuthService);
  private router = inject(Router);

  isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  signout(): void {
    this.auth.signout();
    this.router.navigate(['/']);
  }
}
