import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, interval, takeWhile } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface TokenData {
  token: string;
  expiresAt: number; // timestamp in milliseconds
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'xtodo_token';
  private readonly USER_KEY = 'xtodo_user';
  private readonly TOKEN_EXPIRY_MINUTES = 30; // 30 minutes expiration

  private http = inject(HttpClient);

  private currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    // Initialize user after currentUserSubject is created
    this.initializeUser();
    // Start token expiration check
    this.startTokenExpirationCheck();
  }

  signup(fullName: string, email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth`, { action: 'signup', fullName, email, password })
      .pipe(tap(res => this.persistAuth(res)));
  }

  signin(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth`, { action: 'signin', email, password })
      .pipe(tap(res => this.persistAuth(res)));
  }

  signout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
  }

  getToken(): string | null {
    const tokenData = this.getValidTokenData();
    return tokenData ? tokenData.token : null;
  }

  isAuthenticated(): boolean {
    const tokenData = this.getValidTokenData();
    return !!tokenData;
  }

  private getValidTokenData(skipSignout: boolean = false): TokenData | null {
    const tokenDataRaw = localStorage.getItem(this.TOKEN_KEY);
    if (!tokenDataRaw) return null;

    try {
      const tokenData: TokenData = JSON.parse(tokenDataRaw);
      const now = Date.now();
      
      // Check if token is expired
      if (now >= tokenData.expiresAt) {
        // Token expired, clear it
        if (!skipSignout) {
          this.signout();
        } else {
          // During initialization, just clear storage without calling signout
          localStorage.removeItem(this.TOKEN_KEY);
          localStorage.removeItem(this.USER_KEY);
        }
        return null;
      }
      
      return tokenData;
    } catch {
      // Invalid token format, clear it
      if (!skipSignout) {
        this.signout();
      } else {
        // During initialization, just clear storage without calling signout
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
      }
      return null;
    }
  }

  getCurrentUserSnapshot(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  private persistAuth(res: AuthResponse): void {
    const expiresAt = Date.now() + (this.TOKEN_EXPIRY_MINUTES * 60 * 1000); // 30 minutes from now
    const tokenData: TokenData = {
      token: res.token,
      expiresAt
    };
    
    localStorage.setItem(this.TOKEN_KEY, JSON.stringify(tokenData));
    localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
    this.currentUserSubject.next(res.user);
  }

  private initializeUser(): void {
    const user = this.loadUser();
    this.currentUserSubject.next(user);
  }

  private loadUser(): AuthUser | null {
    // Only load user if we have a valid token (skip signout during initialization)
    if (!this.getValidTokenData(true)) return null;
    
    const raw = localStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  private startTokenExpirationCheck(): void {
    // Check token validity every minute
    interval(60000) // 60 seconds
      .pipe(
        takeWhile(() => true) // Keep running
      )
      .subscribe(() => {
        // This will automatically sign out if token is expired
        this.getValidTokenData();
      });
  }

  getTimeUntilExpiration(): number | null {
    const tokenData = this.getValidTokenData();
    if (!tokenData) return null;
    
    const timeLeft = tokenData.expiresAt - Date.now();
    return Math.max(0, timeLeft);
  }

  getMinutesUntilExpiration(): number | null {
    const timeLeft = this.getTimeUntilExpiration();
    if (timeLeft === null) return null;
    
    return Math.ceil(timeLeft / (60 * 1000));
  }
}


