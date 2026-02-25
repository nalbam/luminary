import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface AppEvent {
  id: string;
  type: string;
  userId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export function appendEvent(event: Omit<AppEvent, 'id' | 'timestamp'>): AppEvent {
  const full: AppEvent = {
    ...event,
    id: uuidv4(),
    timestamp: new Date().toISOString(),
  };

  const date = full.timestamp.split('T')[0];
  const dir = path.join(process.cwd(), 'data', 'events', date);
  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `${full.userId}.jsonl`);
  fs.appendFileSync(filePath, JSON.stringify(full) + '\n');

  return full;
}

export function readEvents(userId: string, date: string): AppEvent[] {
  const filePath = path.join(process.cwd(), 'data', 'events', date, `${userId}.jsonl`);
  if (!fs.existsSync(filePath)) return [];

  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
  return lines.map(line => JSON.parse(line) as AppEvent);
}
