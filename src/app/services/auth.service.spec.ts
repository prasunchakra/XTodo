import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthService, AuthUser, AuthResponse } from './auth.service';
import { environment } from '../../environments/environment';

/**
 * Unit tests for AuthService
 * 
 * Tests cover:
 * - User signup functionality
 * - User signin functionality
 * - Token management (storage, retrieval, validation)
 * - Token expiration handling
 * - User session management
 * - Authentication state tracking
 * 
 * These tests use Angular's HttpTestingController to mock HTTP requests,
 * ensuring tests are isolated and don't depend on external services.
 */
describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  const TOKEN_KEY = 'xtodo_token';
  const USER_KEY = 'xtodo_user';

  beforeEach(() => {
    // Clear localStorage before each test to ensure clean state
    localStorage.clear();
    
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Verify that no unmatched HTTP requests are outstanding
    httpMock.verify();
    // Clean up localStorage after each test
    localStorage.clear();
  });

  describe('User Authentication - Signup', () => {
    it('should successfully sign up a new user', (done) => {
      const mockUser: AuthUser = {
        id: 'test-user-id',
        fullName: 'Test User',
        email: 'test@example.com'
      };
      
      const mockResponse: AuthResponse = {
        token: 'mock-jwt-token',
        user: mockUser
      };

      service.signup('Test User', 'test@example.com', 'password123').subscribe(response => {
        expect(response).toEqual(mockResponse);
        expect(response.token).toBe('mock-jwt-token');
        expect(response.user.email).toBe('test@example.com');
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/auth`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        action: 'signup',
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      });
      req.flush(mockResponse);
    });

    it('should persist token and user data after successful signup', (done) => {
      const mockUser: AuthUser = {
        id: 'test-user-id',
        fullName: 'Test User',
        email: 'test@example.com'
      };
      
      const mockResponse: AuthResponse = {
        token: 'mock-jwt-token',
        user: mockUser
      };

      service.signup('Test User', 'test@example.com', 'password123').subscribe(() => {
        // Verify token is stored
        const storedToken = localStorage.getItem(TOKEN_KEY);
        expect(storedToken).toBeTruthy();
        
        const tokenData = JSON.parse(storedToken!);
        expect(tokenData.token).toBe('mock-jwt-token');
        
        // Verify user is stored
        const storedUser = localStorage.getItem(USER_KEY);
        expect(storedUser).toBeTruthy();
        expect(JSON.parse(storedUser!)).toEqual(mockUser);
        
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/auth`);
      req.flush(mockResponse);
    });
  });

  describe('User Authentication - Signin', () => {
    it('should successfully sign in an existing user', (done) => {
      const mockUser: AuthUser = {
        id: 'test-user-id',
        fullName: 'Test User',
        email: 'test@example.com'
      };
      
      const mockResponse: AuthResponse = {
        token: 'mock-jwt-token',
        user: mockUser
      };

      service.signin('test@example.com', 'password123').subscribe(response => {
        expect(response).toEqual(mockResponse);
        expect(response.token).toBe('mock-jwt-token');
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/auth`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        action: 'signin',
        email: 'test@example.com',
        password: 'password123'
      });
      req.flush(mockResponse);
    });

    it('should update currentUser$ observable after signin', (done) => {
      const mockUser: AuthUser = {
        id: 'test-user-id',
        fullName: 'Test User',
        email: 'test@example.com'
      };
      
      const mockResponse: AuthResponse = {
        token: 'mock-jwt-token',
        user: mockUser
      };

      // Subscribe to currentUser$ before signin
      service.currentUser$.subscribe(user => {
        if (user) {
          expect(user).toEqual(mockUser);
          done();
        }
      });

      service.signin('test@example.com', 'password123').subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth`);
      req.flush(mockResponse);
    });
  });

  describe('User Authentication - Signout', () => {
    it('should clear token and user data on signout', () => {
      // First, set up some data
      const mockUser: AuthUser = {
        id: 'test-user-id',
        fullName: 'Test User',
        email: 'test@example.com'
      };
      
      const tokenData = {
        token: 'mock-jwt-token',
        expiresAt: Date.now() + 30 * 60 * 1000 // 30 minutes from now
      };
      
      localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
      localStorage.setItem(USER_KEY, JSON.stringify(mockUser));

      // Now sign out
      service.signout();

      // Verify data is cleared
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(USER_KEY)).toBeNull();
    });

    it('should update currentUser$ to null on signout', (done) => {
      const mockUser: AuthUser = {
        id: 'test-user-id',
        fullName: 'Test User',
        email: 'test@example.com'
      };
      
      const tokenData = {
        token: 'mock-jwt-token',
        expiresAt: Date.now() + 30 * 60 * 1000
      };
      
      localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
      localStorage.setItem(USER_KEY, JSON.stringify(mockUser));

      // Subscribe to track changes
      let emissionCount = 0;
      service.currentUser$.subscribe(user => {
        emissionCount++;
        if (emissionCount === 2) { // Second emission after signout
          expect(user).toBeNull();
          done();
        }
      });

      service.signout();
    });
  });

  describe('Token Management', () => {
    it('should return valid token when token exists and is not expired', () => {
      const tokenData = {
        token: 'valid-jwt-token',
        expiresAt: Date.now() + 30 * 60 * 1000 // 30 minutes from now
      };
      
      localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));

      const token = service.getToken();
      expect(token).toBe('valid-jwt-token');
    });

    it('should return null when token is expired', () => {
      const tokenData = {
        token: 'expired-jwt-token',
        expiresAt: Date.now() - 1000 // 1 second ago
      };
      
      localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));

      const token = service.getToken();
      expect(token).toBeNull();
    });

    it('should return null when token does not exist', () => {
      const token = service.getToken();
      expect(token).toBeNull();
    });

    it('should calculate time until expiration correctly', () => {
      const futureTime = Date.now() + 10 * 60 * 1000; // 10 minutes from now
      const tokenData = {
        token: 'valid-jwt-token',
        expiresAt: futureTime
      };
      
      localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));

      const timeLeft = service.getTimeUntilExpiration();
      expect(timeLeft).toBeGreaterThan(0);
      expect(timeLeft).toBeLessThanOrEqual(10 * 60 * 1000);
    });

    it('should return minutes until expiration', () => {
      const futureTime = Date.now() + 15 * 60 * 1000; // 15 minutes from now
      const tokenData = {
        token: 'valid-jwt-token',
        expiresAt: futureTime
      };
      
      localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));

      const minutesLeft = service.getMinutesUntilExpiration();
      expect(minutesLeft).toBeGreaterThan(0);
      expect(minutesLeft).toBeLessThanOrEqual(15);
    });

    it('should return null for time until expiration when no token exists', () => {
      const timeLeft = service.getTimeUntilExpiration();
      expect(timeLeft).toBeNull();
    });
  });

  describe('Authentication State', () => {
    it('should return true when user is authenticated with valid token', () => {
      const tokenData = {
        token: 'valid-jwt-token',
        expiresAt: Date.now() + 30 * 60 * 1000
      };
      
      localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));

      expect(service.isAuthenticated()).toBe(true);
    });

    it('should return false when user is not authenticated', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should return false when token is expired', () => {
      const tokenData = {
        token: 'expired-jwt-token',
        expiresAt: Date.now() - 1000
      };
      
      localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));

      expect(service.isAuthenticated()).toBe(false);
    });

    it('should get current user snapshot', () => {
      const mockUser: AuthUser = {
        id: 'test-user-id',
        fullName: 'Test User',
        email: 'test@example.com'
      };
      
      const tokenData = {
        token: 'valid-jwt-token',
        expiresAt: Date.now() + 30 * 60 * 1000
      };
      
      localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
      localStorage.setItem(USER_KEY, JSON.stringify(mockUser));

      // Need to create a new service instance to pick up the localStorage data
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AuthService,
          provideHttpClient(),
          provideHttpClientTesting()
        ]
      });
      
      const newService = TestBed.inject(AuthService);
      const user = newService.getCurrentUserSnapshot();
      expect(user).toEqual(mockUser);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON in localStorage gracefully', () => {
      localStorage.setItem(TOKEN_KEY, 'invalid-json');
      
      const token = service.getToken();
      expect(token).toBeNull();
    });

    it('should handle missing user data gracefully', () => {
      const tokenData = {
        token: 'valid-jwt-token',
        expiresAt: Date.now() + 30 * 60 * 1000
      };
      
      localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
      // Don't set user data

      const user = service.getCurrentUserSnapshot();
      expect(user).toBeNull();
    });
  });
});
