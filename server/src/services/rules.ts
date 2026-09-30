/**
 * Deterministic, non-AI logic. Used as the fallback for every AI action and
 * as the reference the AI output is checked against.
 */
import type { ApprovalItem, Priority, SummaryItem } from '@cb/contracts';
import { ageInDays } from '../../prompts/shared';

const HIGH = /safety|ppe|sensor|hazard|emergency|gas/i;
const MEDIUM = /onboarding|checklist|camera|zone|layout/i;

export const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

// Titles only: descriptions mention safety in passing (e.g. "emergency drills")
// and would over-promote items.
export function slaHours(item: ApprovalItem): number {
  return HIGH.test(item.title) ? 24 : 48;
}

export function isOverdue(item: ApprovalItem, today: string): boolean {
  return ageInDays(item.submittedAt, today) * 24 > slaHours(item);
}

export function rulePriority(item: ApprovalItem): Priority {
  if (HIGH.test(item.title)) return 'high';
  if (MEDIUM.test(item.title)) return 'medium';
  return 'low';
}

const ACTIONS: Record<Priority, string> = {
  high: 'Review now and escalate any hazard',
  medium: 'Review today',
  low: 'Review when higher priorities are clear',
};

export function sortByPriority<T extends { priority: Priority }>(items: T[]): T[] {
  return [...items].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
}

export function ruleBasedItems(queue: ApprovalItem[], today: string): SummaryItem[] {
  return sortByPriority(
    queue.map((item) => {
      const priority = rulePriority(item);
      const age = ageInDays(item.submittedAt, today);
      const overdue = isOverdue(item, today) ? `, past its ${slaHours(item)}h SLA` : '';
      return {
        id: item.id,
        title: item.title,
        type: item.type,
        priority,
        reason: `${priority === 'high' ? 'Safety-related' : priority === 'medium' ? 'Blocks other work' : 'Informational'} ${item.type}, waiting ${age} day${age === 1 ? '' : 's'}${overdue}.`,
        recommendedAction: ACTIONS[priority],
      };
    }),
  );
}

export function ruleBasedHeadline(queue: ApprovalItem[], today: string): string {
  if (queue.length === 0) return 'Your approvals queue is clear.';
  const overdue = queue.filter((i) => isOverdue(i, today)).length;
  const first = ruleBasedItems(queue, today)[0]!;
  return `${queue.length} item${queue.length === 1 ? '' : 's'} pending review${overdue ? `, ${overdue} past SLA` : ''}. Start with "${first.title}".`;
}

export function ruleBasedGreeting(queue: ApprovalItem[], today: string): string {
  const overdue = queue.filter((i) => isOverdue(i, today)).length;
  if (queue.length === 0) return 'Hello! Your approvals queue is clear. Nothing needs your review right now.';
  return `Hello! You have ${queue.length} approval${queue.length === 1 ? '' : 's'} pending review${
    overdue ? `, ${overdue} of them overdue` : ''
  }. How can I help?`;
}

export const todayIso = (now = new Date()) => now.toISOString().slice(0, 10);
