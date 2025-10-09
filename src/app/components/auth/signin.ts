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
  emailError = signal('');
  passwordError = signal('');
  fullNameError = signal('');

  private auth = inject(AuthService);
  private router = inject(Router);

  // Email validation pattern
  private emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  validateEmail(): void {
    const emailValue = this.email().trim();
    if (!emailValue) {
      this.emailError.set('Email is required');
    } else if (!this.emailPattern.test(emailValue)) {
      this.emailError.set('Please enter a valid email address');
    } else {
      this.emailError.set('');
    }
  }

  validatePassword(): void {
    const passwordValue = this.password();
    if (!passwordValue) {
      this.passwordError.set('Password is required');
    } else if (this.mode() === 'signup' && passwordValue.length < 6) {
      this.passwordError.set('Password must be at least 6 characters');
    } else {
      this.passwordError.set('');
    }
  }

  validateFullName(): void {
    const fullNameValue = this.fullName().trim();
    if (this.mode() === 'signup') {
      if (!fullNameValue) {
        this.fullNameError.set('Full name is required');
      } else if (fullNameValue.length > 100) {
        this.fullNameError.set('Full name must be less than 100 characters');
      } else {
        this.fullNameError.set('');
      }
    } else {
      this.fullNameError.set('');
    }
  }

  signin(): void {
    this.validateEmail();
    this.validatePassword();

    if (this.emailError() || this.passwordError()) {
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.auth.signin(this.email().trim(), this.password()).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/app']);
      },
      error: (e: any) => {
        this.loading.set(false);
        this.error.set(e?.error?.error || 'Sign in failed. Please check your credentials.');
      }
    });
  }

  signup(): void {
    this.validateFullName();
    this.validateEmail();
    this.validatePassword();

    if (this.fullNameError() || this.emailError() || this.passwordError()) {
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.auth.signup(this.fullName().trim(), this.email().trim(), this.password()).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/app']);
      },
      error: (e: any) => {
        this.loading.set(false);
        this.error.set(e?.error?.error || 'Sign up failed. Please try again.');
      }
    });
  }
}

