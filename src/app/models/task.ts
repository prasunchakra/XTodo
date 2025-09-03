export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'Low' | 'Medium' | 'High';
  dueDate?: Date;
  projectId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskFilters {
  search?: string;
  priority?: Task['priority'];
  projectId?: string;
  dueDate?: Date;
  completed?: boolean;
}
