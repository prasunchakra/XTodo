import { Injectable, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

// Modern functional interceptor (preferred)
export const authInterceptorFn: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  const token = authService.getToken();
  
  if (token) {
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    
    return next(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // Handle 401 Unauthorized responses (token expired or invalid)
        if (error.status === 401) {
          // Token is invalid or expired, sign out user
          authService.signout();
          router.navigate(['/']);
        }
        return throwError(() => error);
      })
    );
  }
  
  return next(req);
};

// Legacy class-based interceptor (for compatibility)
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private authService = inject(AuthService);
  private router = inject(Router);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();
    
    if (token) {
      const authReq = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      });
      
      return next.handle(authReq).pipe(
        catchError((error: HttpErrorResponse) => {
          // Handle 401 Unauthorized responses (token expired or invalid)
          if (error.status === 401) {
            // Token is invalid or expired, sign out user
            this.authService.signout();
            this.router.navigate(['/']);
          }
          return throwError(() => error);
        })
      );
    }
    
    return next.handle(req);
  }
}
