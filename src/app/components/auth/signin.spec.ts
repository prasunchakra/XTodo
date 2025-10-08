import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { SigninComponent } from './signin';
import { AuthService } from '../../services/auth.service';
import { of, throwError } from 'rxjs';

describe('SigninComponent', () => {
  let component: SigninComponent;
  let fixture: ComponentFixture<SigninComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', ['signup', 'signin']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [SigninComponent, HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    }).compileComponents();

    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    fixture = TestBed.createComponent(SigninComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('password validation', () => {
    it('should validate password with minimum length of 8', () => {
      component.password.set('abc123');
      component.validatePassword();

      const reqs = component.passwordRequirements();
      expect(reqs.minLength).toBe(false);

      component.password.set('abcd1234');
      component.validatePassword();

      const updatedReqs = component.passwordRequirements();
      expect(updatedReqs.minLength).toBe(true);
    });

    it('should validate password contains at least one letter', () => {
      component.password.set('12345678');
      component.validatePassword();

      const reqs = component.passwordRequirements();
      expect(reqs.hasLetter).toBe(false);

      component.password.set('a1234567');
      component.validatePassword();

      const updatedReqs = component.passwordRequirements();
      expect(updatedReqs.hasLetter).toBe(true);
    });

    it('should validate password contains at least one number', () => {
      component.password.set('abcdefgh');
      component.validatePassword();

      const reqs = component.passwordRequirements();
      expect(reqs.hasNumber).toBe(false);

      component.password.set('abcdefg1');
      component.validatePassword();

      const updatedReqs = component.passwordRequirements();
      expect(updatedReqs.hasNumber).toBe(true);
    });

    it('should validate password meets all requirements', () => {
      component.password.set('password123');
      component.validatePassword();

      const reqs = component.passwordRequirements();
      expect(reqs.minLength).toBe(true);
      expect(reqs.hasLetter).toBe(true);
      expect(reqs.hasNumber).toBe(true);
    });
  });

  describe('signup', () => {
    beforeEach(() => {
      component.mode.set('signup');
      component.fullName.set('John Doe');
      component.email.set('test@example.com');
      component.password.set('password123');
      component.validatePassword();
    });

    it('should trim inputs before calling auth service', () => {
      component.fullName.set('  John Doe  ');
      component.email.set('  test@example.com  ');
      component.password.set('  password123  ');
      component.validatePassword();

      authService.signup.and.returnValue(of({ token: 'token', user: { id: '1', email: 'test@example.com', fullName: 'John Doe' } }));

      component.signup();

      expect(authService.signup).toHaveBeenCalledWith('John Doe', 'test@example.com', 'password123');
    });

    it('should show error if password requirements are not met', () => {
      component.password.set('weak');
      component.validatePassword();

      component.signup();

      expect(component.error()).toBe('Please meet all password requirements');
      expect(authService.signup).not.toHaveBeenCalled();
    });

    it('should navigate to /app on successful signup', () => {
      authService.signup.and.returnValue(of({ token: 'token', user: { id: '1', email: 'test@example.com', fullName: 'John Doe' } }));

      component.signup();

      expect(router.navigate).toHaveBeenCalledWith(['/app']);
    });

    it('should display error message on signup failure', () => {
      authService.signup.and.returnValue(throwError(() => ({ error: { error: 'Email already registered' } })));

      component.signup();

      expect(component.error()).toBe('Email already registered');
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('signin', () => {
    beforeEach(() => {
      component.mode.set('signin');
      component.email.set('test@example.com');
      component.password.set('password123');
    });

    it('should trim inputs before calling auth service', () => {
      component.email.set('  test@example.com  ');
      component.password.set('  password123  ');

      authService.signin.and.returnValue(of({ token: 'token', user: { id: '1', email: 'test@example.com', fullName: 'John Doe' } }));

      component.signin();

      expect(authService.signin).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    it('should navigate to /app on successful signin', () => {
      authService.signin.and.returnValue(of({ token: 'token', user: { id: '1', email: 'test@example.com', fullName: 'John Doe' } }));

      component.signin();

      expect(router.navigate).toHaveBeenCalledWith(['/app']);
    });

    it('should display error message on signin failure', () => {
      authService.signin.and.returnValue(throwError(() => ({ error: { error: 'Invalid credentials' } })));

      component.signin();

      expect(component.error()).toBe('Invalid credentials');
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});
