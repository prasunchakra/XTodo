import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService]
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('signup', () => {
    it('should send user data correctly', () => {
      const fullName = 'John Doe';
      const email = 'test@example.com';
      const password = 'password123';

      service.signup(fullName, email, password).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        action: 'signup',
        fullName: fullName,
        email: email,
        password: password
      });

      req.flush({ token: 'test-token', user: { id: '1', email: 'test@example.com', fullName: 'John Doe' } });
    });

    it('should persist auth data after successful signup', () => {
      const response = { token: 'test-token', user: { id: '1', email: 'test@example.com', fullName: 'John Doe' } };

      service.signup('John Doe', 'test@example.com', 'password123').subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth`);
      req.flush(response);

      expect(localStorage.getItem('xtodo_token')).toBeTruthy();
      expect(localStorage.getItem('xtodo_user')).toBeTruthy();
      expect(service.getCurrentUserSnapshot()).toEqual(response.user);
    });
  });

  describe('signin', () => {
    it('should send credentials correctly', () => {
      const email = 'test@example.com';
      const password = 'password123';

      service.signin(email, password).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        action: 'signin',
        email: email,
        password: password
      });

      req.flush({ token: 'test-token', user: { id: '1', email: 'test@example.com', fullName: 'John Doe' } });
    });

    it('should persist auth data after successful signin', () => {
      const response = { token: 'test-token', user: { id: '1', email: 'test@example.com', fullName: 'John Doe' } };

      service.signin('test@example.com', 'password123').subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth`);
      req.flush(response);

      expect(localStorage.getItem('xtodo_token')).toBeTruthy();
      expect(localStorage.getItem('xtodo_user')).toBeTruthy();
      expect(service.getCurrentUserSnapshot()).toEqual(response.user);
    });
  });

  describe('signout', () => {
    it('should clear local storage and user state', () => {
      localStorage.setItem('xtodo_token', JSON.stringify({ token: 'test', expiresAt: Date.now() + 10000 }));
      localStorage.setItem('xtodo_user', JSON.stringify({ id: '1', email: 'test@example.com', fullName: 'John Doe' }));

      service.signout();

      expect(localStorage.getItem('xtodo_token')).toBeNull();
      expect(localStorage.getItem('xtodo_user')).toBeNull();
      expect(service.getCurrentUserSnapshot()).toBeNull();
    });
  });

  describe('token management', () => {
    it('should return token if valid and not expired', () => {
      const expiresAt = Date.now() + 10000; // 10 seconds from now
      localStorage.setItem('xtodo_token', JSON.stringify({ token: 'test-token', expiresAt }));

      expect(service.getToken()).toBe('test-token');
    });

    it('should return null if token is expired', () => {
      const expiresAt = Date.now() - 10000; // 10 seconds ago
      localStorage.setItem('xtodo_token', JSON.stringify({ token: 'test-token', expiresAt }));

      expect(service.getToken()).toBeNull();
      expect(localStorage.getItem('xtodo_token')).toBeNull(); // Should be cleared
    });

    it('should return true for isAuthenticated if token is valid', () => {
      const expiresAt = Date.now() + 10000;
      localStorage.setItem('xtodo_token', JSON.stringify({ token: 'test-token', expiresAt }));

      expect(service.isAuthenticated()).toBe(true);
    });

    it('should return false for isAuthenticated if token is expired', () => {
      const expiresAt = Date.now() - 10000;
      localStorage.setItem('xtodo_token', JSON.stringify({ token: 'test-token', expiresAt }));

      expect(service.isAuthenticated()).toBe(false);
    });

    it('should return false for isAuthenticated if no token exists', () => {
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('token expiration tracking', () => {
    it('should calculate time until expiration correctly', () => {
      const expiresAt = Date.now() + 60000; // 1 minute from now
      localStorage.setItem('xtodo_token', JSON.stringify({ token: 'test-token', expiresAt }));

      const timeLeft = service.getTimeUntilExpiration();
      expect(timeLeft).toBeGreaterThan(0);
      expect(timeLeft).toBeLessThanOrEqual(60000);
    });

    it('should calculate minutes until expiration correctly', () => {
      const expiresAt = Date.now() + 120000; // 2 minutes from now
      localStorage.setItem('xtodo_token', JSON.stringify({ token: 'test-token', expiresAt }));

      const minutesLeft = service.getMinutesUntilExpiration();
      expect(minutesLeft).toBe(2);
    });

    it('should return null for expiration time if token is invalid', () => {
      expect(service.getTimeUntilExpiration()).toBeNull();
      expect(service.getMinutesUntilExpiration()).toBeNull();
    });
  });
});
