import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// PrimeNG Components
import { MenubarModule } from 'primeng/menubar';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet,   
    CommonModule,
    RouterModule,
    MenubarModule,
    ButtonModule,
    BadgeModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  title = 'xTodo';
  
  menuItems = [
    {
      label: 'Tasks',
      icon: 'pi pi-list',
      routerLink: '/'
    },
    {
      label: 'Projects',
      icon: 'pi pi-folder',
      routerLink: '/projects'
    }
  ];
}
