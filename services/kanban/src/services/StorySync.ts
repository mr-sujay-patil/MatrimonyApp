import fs from 'fs';
import path from 'path';
import { Logger } from '@matrimony/shared-logger';

const logger = new Logger('kanban-story-sync');

const backlogPath = path.resolve(process.cwd(), 'backlog.json');
const projectConfigPath = path.resolve(process.cwd(), 'project-config.json');
const boardConfigPath = path.resolve(process.cwd(), 'board-config.json');

export interface Story {
  id: string;
  epicId?: string;
  title: string;
  description?: string;
  businessValue?: string;
  priority?: string;
  status: string;
  storyPoints?: number;
  assigneeId?: string;
  reporterId?: string;
  dueDate?: string;
  labels?: string[];
}

export function readProjectFiles() {
  try {
    const backlog = JSON.parse(fs.readFileSync(backlogPath, 'utf8'));
    const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));
    const boardConfig = JSON.parse(fs.readFileSync(boardConfigPath, 'utf8'));

    return {
      id: projectConfig.projectId || backlog.project.id,
      name: projectConfig.projectName || backlog.project.name,
      description: projectConfig.description || backlog.project.description,
      ownerId: projectConfig.owner || backlog.project.ownerId,
      version: projectConfig.version || backlog.project.version || '1.0.0',
      columns: boardConfig.columns || [],
      stories: backlog.stories || [],
      rawBacklog: backlog
    };
  } catch (err) {
    logger.error('Failed to read configuration files from disk', err as Error);
    throw err;
  }
}

export function writeProjectFiles(newStories: Story[], rawBacklogData?: any) {
  try {
    let backlog = rawBacklogData;
    if (!backlog) {
      backlog = JSON.parse(fs.readFileSync(backlogPath, 'utf8'));
    }
    backlog.stories = newStories;
    fs.writeFileSync(backlogPath, JSON.stringify(backlog, null, 2), 'utf8');
    logger.info('Successfully wrote backlog.json back to disk.');
  } catch (err) {
    logger.error('Failed to write backlog.json to disk', err as Error);
    throw err;
  }
}
