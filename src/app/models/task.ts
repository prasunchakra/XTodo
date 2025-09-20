export interface User {
  id: string;
  fullName: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
  // Optional: for UI convenience
  user?: User;
  tasks?: Task[];
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'Low' | 'Medium' | 'High';
  dueDate?: Date;
  projectId?: string;
  createdAt: Date;
  updatedAt: Date;
  // Optional: for UI convenience
  user?: User;
  project?: Project;
}

export interface TaskFilters {
  search?: string;
  priority?: Task['priority'];
  projectId?: string;
  dueDate?: Date;
  completed?: boolean;
}
