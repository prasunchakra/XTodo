import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CardModule } from 'primeng/card';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signin',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, CardModule],
  templateUrl: './signin.html',
  styleUrls: ['./signin.css']
})
export class SigninComponent {
  mode: 'signin' | 'signup' = 'signin';
  fullName = '';
  email = '';
  password = '';
  loading = false;
  error = '';

  constructor(private auth: AuthService, private router: Router) {}

  signin(): void {
    this.loading = true;
    this.error = '';
    this.auth.signin(this.email, this.password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/app']);
      },
      error: (e: any) => {
        this.loading = false;
        this.error = e?.error?.error || 'Sign in failed';
      }
    });
  }

  signup(): void {
    this.loading = true;
    this.error = '';
    this.auth.signup(this.fullName, this.email, this.password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/app']);
      },
      error: (e: any) => {
        this.loading = false;
        this.error = e?.error?.error || 'Sign up failed';
      }
    });
  }
}

