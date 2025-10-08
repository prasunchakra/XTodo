# xTodo - Modern Task Management Application

A sophisticated, feature-rich todo application built with Angular 20, PrimeNG, and Tailwind CSS. Organize your tasks, manage projects, and achieve your goals with a beautiful and intuitive interface.

## ✨ Features

### 🎯 Core Task Management
- **Create Tasks**: Add new tasks with titles and optional descriptions
- **Mark Complete**: Check off completed tasks with smooth animations
- **Delete Tasks**: Remove tasks with confirmation dialogs
- **View Task List**: See all your tasks in an organized, filterable list

### 🚀 Advanced Features
- **Projects/Pledges**: Group tasks under meaningful projects and goals
- **Due Dates**: Set deadlines and track overdue tasks
- **Priorities**: Assign Low, Medium, or High priority levels
- **Smart Filtering**: Search, filter by priority, project, and completion status
- **Statistics Dashboard**: Track your productivity with real-time metrics

### 🎨 User Experience
- **Modern UI**: Beautiful, responsive design with PrimeNG components
- **Tailwind CSS**: Utility-first CSS framework for consistent styling
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Smooth Animations**: Engaging interactions and transitions
- **Accessibility**: Built with accessibility best practices

## 🛠️ Technology Stack

- **Frontend Framework**: Angular 20 (Standalone Components)
- **UI Components**: PrimeNG 20
- **Styling**: Tailwind CSS 4
- **State Management**: RxJS Observables
- **Storage**: Local Storage (easily swappable for backend APIs)
- **Build Tool**: Angular CLI
- **Package Manager**: npm

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm 9+ or yarn
- Angular CLI 20+

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd xtodo-client
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Open your browser**
   Navigate to `http://localhost:4200`

### Build for Production

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## 📁 Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── todo/                 # Main todo component
│   │   └── project-management/   # Project management component
│   ├── models/                   # Data models and interfaces
│   ├── services/                 # Business logic and data services
│   ├── app.component.ts         # Main app component
│   ├── app.routes.ts            # Application routing
│   └── app.config.ts            # App configuration
├── assets/                       # Static assets
└── styles.css                    # Global styles
```

## 🏗️ Architecture

### Services
- **StorageService**: Handles data persistence with localStorage
- **TaskService**: Manages task business logic and filtering

### Components
- **TodoComponent**: Main task management interface
- **ProjectManagementComponent**: Project creation and management

### Data Models
- **Task**: Task entity with all properties
- **Project**: Project/pledge entity
- **TaskFilters**: Filtering options interface

## 🔧 Configuration

### Angular Build Optimizations

The project has been configured with several optimizations for improved performance and developer experience:

#### Build Cache
- Angular 20+ uses the modern esbuild-based builder (`@angular/build:application`)
- Persistent build cache is automatically enabled for development builds
- Incremental compilation speeds up subsequent builds significantly

#### Production Budgets
The production build configuration enforces strict bundle size budgets to prevent performance degradation:
- **Initial Bundle**: Warning at 850kB, Error at 900kB (stricter than default)
- **Component Styles**: Warning at 4kB, Error at 6kB
- These budgets help catch accidental bundle size increases early

#### TypeScript Strict Mode
Stricter TypeScript rules are enforced for better code quality and error detection:
- `strict: true` - Enables all strict type-checking options
- `noImplicitAny: true` - Explicitly prevents implicit any types
- `strictNullChecks: true` - Explicitly catches null/undefined errors
- Additional rules: `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noImplicitOverride`

These configurations ensure high code quality, optimal performance, and faster development cycles.

### PrimeNG Theme
The application uses PrimeNG's Aura theme with custom Tailwind CSS integration.

### Tailwind CSS
Configured with `tailwindcss-primeui` plugin for seamless integration with PrimeNG components.

## 📱 Responsive Design

The application is fully responsive and optimized for:
- **Desktop**: Full-featured interface with sidebar navigation
- **Tablet**: Adaptive layout with optimized touch interactions
- **Mobile**: Mobile-first design with collapsible sections

## 🎯 Key Features Explained

### Task Management
- Create tasks with titles, descriptions, priorities, and due dates
- Assign tasks to projects for better organization
- Mark tasks as complete with visual feedback
- Delete tasks with confirmation dialogs

### Project Organization
- Create custom projects with names, descriptions, and colors
- Track progress with visual progress bars
- View task counts and completion statistics
- Manage project lifecycle (create, edit, delete)

### Smart Filtering
- Search tasks by title or description
- Filter by priority level (Low, Medium, High)
- Filter by project assignment
- Filter by completion status
- Filter by due date

### Statistics Dashboard
- Total task count
- Active vs. completed tasks
- Tasks due today
- Overdue tasks
- Project progress tracking

## 🔄 Data Persistence

The application currently uses localStorage for data persistence, making it perfect for:
- Personal use
- Offline functionality
- Quick prototyping
- Easy migration to backend APIs

### Future Backend Integration
The service architecture is designed to easily swap localStorage with:
- REST APIs
- GraphQL endpoints
- Real-time databases
- Cloud storage solutions

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run e2e tests
npm run e2e
```

## 📦 Build & Deployment

### Development
```bash
npm start
```

### Production Build
```bash
npm run build
```

### Watch Mode
```bash
npm run watch
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Angular Team** for the amazing framework
- **PrimeNG Team** for the excellent UI components
- **Tailwind CSS Team** for the utility-first CSS framework
- **Open Source Community** for inspiration and support

## 📞 Support

If you have any questions or need help:
- Create an issue in the repository
- Check the documentation
- Review the code examples

---

**Happy Tasking! 🎉**
