import { Injectable, inject, signal } from '@angular/core';
import { TrpcService } from './trpc.service';

export interface Project {
  id: string;
  title: string;
  code: string;
  chat: string; // JSON-serialized ChatMessage[]
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private trpc = inject(TrpcService);

  readonly projects  = signal<Project[]>([]);
  readonly currentProject = signal<Project | null>(null);
  readonly loading   = signal(false);

  async loadProjects(): Promise<void> {
    this.loading.set(true);
    try {
      const list = await this.trpc.projectList();
      this.projects.set(list as Project[]);
    } catch {
      // Unauthenticated or network error — leave empty
    } finally {
      this.loading.set(false);
    }
  }

  async createProject(title: string, initialCode: string): Promise<Project> {
    const p = await this.trpc.projectCreate(title, initialCode) as Project;
    this.projects.update(ps => [p, ...ps]);
    return p;
  }

  async updateProject(id: string, data: { title?: string; code?: string; chat?: string }): Promise<void> {
    await this.trpc.projectUpdate(id, data);
    this.projects.update(ps => ps.map(p => p.id === id ? { ...p, ...data } : p));
    if (this.currentProject()?.id === id) {
      this.currentProject.update(p => p ? { ...p, ...data } : p);
    }
  }

  async deleteProject(id: string): Promise<void> {
    await this.trpc.projectDelete(id);
    this.projects.update(ps => ps.filter(p => p.id !== id));
    if (this.currentProject()?.id === id) {
      this.setCurrentProject(null);
    }
  }

  setCurrentProject(project: Project | null): void {
    this.currentProject.set(project);
    if (project) {
      localStorage.setItem('lastProjectId', project.id);
    } else {
      localStorage.removeItem('lastProjectId');
    }
  }

  clear(): void {
    this.projects.set([]);
    this.setCurrentProject(null);
  }
}
