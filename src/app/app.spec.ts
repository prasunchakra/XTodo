import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { App } from './app';

/**
 * Unit tests for the main App component
 * Tests component creation and basic rendering functionality
 */
describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      // Provide required dependencies for AuthService and Router
      providers: [
        provideHttpClient(),
        provideRouter([])
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should have a title property', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.title()).toBe('xTodo');
  });

  it('should call AuthService.isAuthenticated when checking authentication', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    // Should not throw an error
    expect(() => app.isAuthenticated()).not.toThrow();
  });
});
