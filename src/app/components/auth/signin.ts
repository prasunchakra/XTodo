import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CardModule } from 'primeng/card';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signin',
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, CardModule],
  templateUrl: './signin.html',
  styleUrls: ['./signin.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SigninComponent {
  mode = signal<'signin' | 'signup'>('signin');
  fullName = signal('');
  email = signal('');
  password = signal('');
  loading = signal(false);
  error = signal('');

  private auth = inject(AuthService);
  private router = inject(Router);

  signin(): void {
    this.loading.set(true);
    this.error.set('');
    this.auth.signin(this.email(), this.password()).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/app']);
      },
      error: (e: any) => {
        this.loading.set(false);
        this.error.set(e?.error?.error || 'Sign in failed');
      }
    });
  }

  signup(): void {
    this.loading.set(true);
    this.error.set('');
    this.auth.signup(this.fullName(), this.email(), this.password()).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/app']);
      },
      error: (e: any) => {
        this.loading.set(false);
        this.error.set(e?.error?.error || 'Sign up failed');
      }
    });
  }
}

