// src/lib/memory/conversations.ts
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import type { LLMToolCall, LLMToolResult, ConversationMessage } from '../llm/types';

const MAX_ROWS = 80; // 최대 80행 보존 (20턴 × tool call 포함 버퍼)

interface ConversationRow {
  id: string;
  user_id: string;
  role: string;
  content: string;
  tool_use_id: string | null;
  created_at: string;
}

export function saveUserMessage(userId: string, content: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO conversations (id, user_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)`
  ).run(uuidv4(), userId, content, new Date().toISOString());
  trimHistory(userId);
}

export function saveAssistantMessage(userId: string, content: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO conversations (id, user_id, role, content, created_at) VALUES (?, ?, 'assistant', ?, ?)`
  ).run(uuidv4(), userId, content, new Date().toISOString());
}

export function saveAssistantToolCalls(userId: string, toolCalls: LLMToolCall[]): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO conversations (id, user_id, role, content, created_at) VALUES (?, ?, 'assistant_tool_calls', ?, ?)`
  ).run(uuidv4(), userId, JSON.stringify(toolCalls), new Date().toISOString());
}

export function saveToolResults(userId: string, results: LLMToolResult[]): void {
  if (results.length === 0) return;
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO conversations (id, user_id, role, content, tool_use_id, created_at) VALUES (?, ?, 'tool_results', ?, ?, ?)`
  );
  const insertAll = db.transaction((items: LLMToolResult[]) => {
    const now = new Date().toISOString();
    for (const r of items) {
      stmt.run(uuidv4(), userId, r.content, r.toolUseId, now);
    }
  });
  insertAll(results);
}

export function getDisplayHistory(userId: string): Array<{ role: 'user' | 'assistant'; content: string; created_at: string }> {
  const db = getDb();
  return db.prepare(
    `SELECT role, content, created_at FROM conversations WHERE user_id = ? AND role IN ('user', 'assistant') ORDER BY created_at ASC`
  ).all(userId) as Array<{ role: 'user' | 'assistant'; content: string; created_at: string }>;
}

export function getConversationHistory(userId: string): ConversationMessage[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, user_id, role, content, tool_use_id, created_at FROM conversations WHERE user_id = ? ORDER BY created_at ASC`
  ).all(userId) as ConversationRow[];

  return rowsToMessages(rows);
}

function rowsToMessages(rows: ConversationRow[]): ConversationMessage[] {
  const messages: ConversationMessage[] = [];
  let i = 0;

  while (i < rows.length) {
    const row = rows[i];

    if (row.role === 'user') {
      messages.push({ role: 'user', content: row.content });
      i++;
    } else if (row.role === 'assistant') {
      messages.push({ role: 'assistant', content: row.content });
      i++;
    } else if (row.role === 'assistant_tool_calls') {
      let toolCalls: LLMToolCall[];
      try {
        toolCalls = JSON.parse(row.content) as LLMToolCall[];
      } catch {
        console.error('Failed to parse tool calls from conversation history:', row.content);
        i++;
        continue;
      }
      messages.push({ role: 'assistant_tool_calls', toolCalls });

      // 연속된 tool_results 행 수집
      const results: LLMToolResult[] = [];
      while (i + 1 < rows.length && rows[i + 1].role === 'tool_results') {
        i++;
        const toolUseId = rows[i].tool_use_id;
        if (!toolUseId) {
          console.warn('tool_results row missing tool_use_id, skipping:', rows[i].id);
          continue;
        }
        results.push({ toolUseId, content: rows[i].content });
      }
      if (results.length > 0) {
        messages.push({ role: 'tool_results', results });
      }
      i++;
    } else {
      i++;
    }
  }

  return messages;
}

function trimHistory(userId: string): void {
  const db = getDb();

  // Step 1: Naive row-count trim — keep the latest MAX_ROWS rows
  db.prepare(`
    DELETE FROM conversations
    WHERE user_id = ? AND id NOT IN (
      SELECT id FROM conversations WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
    )
  `).run(userId, userId, MAX_ROWS);

  // Step 2: Remove orphaned message pairs that could cause API errors.
  // Anthropic requires every tool_use block to be followed by a tool_result block.
  // The naive trim above may cut at a boundary, leaving orphaned pairs.
  const rows = db.prepare(
    `SELECT id, role FROM conversations WHERE user_id = ? ORDER BY created_at ASC`
  ).all(userId) as Array<{ id: string; role: string }>;

  const toDelete: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].role === 'assistant_tool_calls') {
      const hasResult = i + 1 < rows.length && rows[i + 1].role === 'tool_results';
      if (!hasResult) toDelete.push(rows[i].id);
    } else if (rows[i].role === 'tool_results') {
      // A tool_results row is valid if preceded by assistant_tool_calls OR another tool_results
      // (multiple tool results can follow a single assistant_tool_calls row)
      const prevRole = i > 0 ? rows[i - 1].role : null;
      const hasPreceding = prevRole === 'assistant_tool_calls' || prevRole === 'tool_results';
      if (!hasPreceding) toDelete.push(rows[i].id);
    }
  }

  if (toDelete.length > 0) {
    const placeholders = toDelete.map(() => '?').join(',');
    db.prepare(`DELETE FROM conversations WHERE id IN (${placeholders})`).run(...toDelete);
  }
}
