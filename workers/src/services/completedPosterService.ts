import { and, eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import { getEpicsForUser } from './epicService';
import { getProjectsForUser } from './projectService';

type DB = DrizzleD1Database<typeof schema>;

export const WORK_CATEGORIES = [
  'Solfit',
  'Migrating Dragons',
  'Xebit',
  'Mavala',
  'Caving Crew',
] as const;

export const PREFIX_CATEGORY_MAP: Record<string, string> = {
  solfit: 'Solfit',
  crew: 'Caving Crew',
  cavingcrew: 'Caving Crew',
  'caving crew': 'Caving Crew',
  personal: 'Personal',
  mavala: 'Mavala',
  md: 'Migrating Dragons',
  'migrating dragons': 'Migrating Dragons',
  xebit: 'Xebit',
};

const PREFIX_REGEX =
  /^(Solfit|Crew|Caving Crew|Personal|Mavala|MD|Migrating Dragons|Xebit)\s*:\s*(.*)$/i;

export interface OrdinalDateInfo {
  day: string;
  suffix: string;
  monthYear: string;
  html: string;
  fullText: string;
}

export function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) {
    return 'th';
  }
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatOrdinalSuperscript(date: Date): OrdinalDateInfo {
  const dayNum = date.getUTCDate();
  const dayStr = dayNum.toString();
  const suffix = getOrdinalSuffix(dayNum);
  const monthStr = MONTH_NAMES[date.getUTCMonth()];
  const yearTwoDigits = date.getUTCFullYear().toString().slice(-2);
  const monthYear = `${monthStr} '${yearTwoDigits}`;
  const fullText = `${dayStr}${suffix} ${monthYear}`;
  const html = `${dayStr}<sup>${suffix}</sup> ${monthStr}`;

  return {
    day: dayStr,
    suffix,
    monthYear,
    html,
    fullText,
  };
}

export function formatOrdinalDate(date: Date): string {
  return formatOrdinalSuperscript(date).fullText;
}

// Helper to normalize any category string (e.g. 'Crew' -> 'Caving Crew', 'md' -> 'Migrating Dragons')
export function normalizeCategory(cat: string): string {
  const trimmed = cat.trim();
  const lower = trimmed.toLowerCase();
  return PREFIX_CATEGORY_MAP[lower] || trimmed;
}

export function mapAndCleanTaskCategoryAndTitle(task: {
  project: string;
  category?: string | null;
}): {
  title: string;
  category: string;
} {
  let rawCategory = task.category?.trim() || null;
  let title = task.project.trim();

  // If category is not set, attempt to extract from prefix
  if (!rawCategory) {
    const match = title.match(PREFIX_REGEX);
    if (match) {
      const matchedPrefix = match[1].toLowerCase();
      rawCategory = PREFIX_CATEGORY_MAP[matchedPrefix] || match[1];
      title = match[2].trim();
    }
  } else {
    // If title has redundant prefix matching category, strip it
    const match = title.match(PREFIX_REGEX);
    if (match) {
      title = match[2].trim();
    }
  }

  // Normalize category names
  if (rawCategory) {
    rawCategory = normalizeCategory(rawCategory);
  }

  // Default to Personal if still unassigned
  const finalCategory = rawCategory || 'Personal';

  return {
    title,
    category: finalCategory,
  };
}

export function sizeToNumeric(size: string | null | undefined): number {
  switch (size) {
    case '*':
      return 1;
    case '**':
      return 2;
    case '***':
      return 3;
    case '****':
      return 4;
    case '*****':
      return 5;
    default:
      return 3;
  }
}

export interface CompletedPosterItem {
  id: string;
  title: string;
  reason?: string | null;
  category: string;
  size: number;
  completedAt: string;
  dateFormatted: string;
  dateDay: string;
  dateSuffix: string;
  dateMonthYear: string;
  dateHtml: string;
  epicTitle?: string | null;
  goalTitle?: string | null;
  goalIcon?: string | null;
}

export interface CompletedPosterTier {
  tierIndex: number;
  columns: CompletedPosterItem[][];
}

export interface CompletedPosterData {
  totalCount: number;
  tiers: CompletedPosterTier[];
  generatedAt: string;
}

export interface CompletedTaskInput {
  id: string;
  project: string;
  reason?: string | null;
  size: string;
  category?: string | null;
  epicId?: string | null;
  goalId?: string | null;
  statusLastChangedOn?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}

export function partitionCompletedTasks(
  tasks: CompletedTaskInput[],
  epicsMap: Record<string, { id: string; title: string; goalId?: string | null }> = {},
  goalsMap: Record<string, { id: string; title: string; icon?: string | null }> = {},
  categories?: string[],
  timeframe?: '6m' | '12m' | 'all'
): CompletedPosterData {
  const normalizedCategories =
    categories && categories.length > 0
      ? categories.map((c) => normalizeCategory(c).toLowerCase())
      : null;

  // Sort all completed tasks ascending by completion date
  const sortedTasks = [...tasks].sort((a, b) => {
    const dateA = new Date(a.statusLastChangedOn || a.updatedAt || a.createdAt || 0).getTime();
    const dateB = new Date(b.statusLastChangedOn || b.updatedAt || b.createdAt || 0).getTime();
    return dateA - dateB;
  });

  // Calculate items by cutoff time:
  // If timeframe is 6m or 12m, aim to gracefully fill available vertical capacity (~80-90 items)
  // rather than leaving huge blank gaps. If filtered count within cutoff is small, expand back in time.
  const now = new Date().getTime();
  const MIN_TARGET_ITEMS = 60;

  let candidateTasks = sortedTasks;
  if (timeframe === '6m' || timeframe === '12m') {
    const primaryCutoff =
      timeframe === '6m' ? now - 183 * 24 * 60 * 60 * 1000 : now - 365 * 24 * 60 * 60 * 1000;

    const recent = sortedTasks.filter((t) => {
      const d = new Date(t.statusLastChangedOn || t.updatedAt || t.createdAt || 0).getTime();
      return isNaN(d) || d >= primaryCutoff;
    });

    if (recent.length >= MIN_TARGET_ITEMS) {
      candidateTasks = recent;
    } else {
      // Gracefully take the most recent items up to MIN_TARGET_ITEMS so space is balanced
      candidateTasks = sortedTasks.slice(
        -Math.max(recent.length, Math.min(MIN_TARGET_ITEMS, sortedTasks.length))
      );
    }
  }

  const preparedItems: CompletedPosterItem[] = candidateTasks
    .map((task) => {
      const { title, category } = mapAndCleanTaskCategoryAndTitle(task);
      const dateStr =
        task.statusLastChangedOn || task.updatedAt || task.createdAt || new Date().toISOString();
      const dateObj = new Date(dateStr);
      const dateInfo = formatOrdinalSuperscript(isNaN(dateObj.getTime()) ? new Date() : dateObj);

      let epicTitle: string | null = null;
      let goalTitle: string | null = null;
      let goalIcon: string | null = null;

      if (task.epicId && epicsMap[task.epicId]) {
        const epic = epicsMap[task.epicId];
        epicTitle = epic.title;
        if (!task.goalId && epic.goalId && goalsMap[epic.goalId]) {
          goalTitle = goalsMap[epic.goalId].title;
          goalIcon = goalsMap[epic.goalId].icon ?? null;
        }
      }

      if (task.goalId && goalsMap[task.goalId]) {
        goalTitle = goalsMap[task.goalId].title;
        goalIcon = goalsMap[task.goalId].icon ?? null;
      }

      return {
        id: task.id,
        title,
        reason: task.reason?.trim() || null,
        category,
        size: sizeToNumeric(task.size),
        completedAt: dateStr,
        dateFormatted: dateInfo.fullText,
        dateDay: dateInfo.day,
        dateSuffix: dateInfo.suffix,
        dateMonthYear: dateInfo.monthYear,
        dateHtml: dateInfo.html,
        epicTitle,
        goalTitle,
        goalIcon,
      };
    })
    .filter((item) => {
      if (!normalizedCategories) {
        return true;
      }
      return normalizedCategories.includes(item.category.toLowerCase());
    });

  // Split into Personal (cols 1-3) and Work/Ventures (col 4)
  const isWorkCategory = (cat: string) => (WORK_CATEGORIES as readonly string[]).includes(cat);

  const personalItems = preparedItems
    .filter((item) => !isWorkCategory(item.category))
    .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());

  const workItems = preparedItems
    .filter((item) => isWorkCategory(item.category))
    .sort((a, b) => {
      const catOrderA = WORK_CATEGORIES.indexOf(a.category as any);
      const catOrderB = WORK_CATEGORIES.indexOf(b.category as any);
      if (catOrderA !== catOrderB) {
        return (catOrderA === -1 ? 99 : catOrderA) - (catOrderB === -1 ? 99 : catOrderB);
      }
      return new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
    });

  // Distribute Personal tasks down full vertical columns:
  // Column 0 runs all the way down (Tier 1 -> Tier 2 -> Tier 3),
  // then Column 1 runs down (Tier 1 -> Tier 2 -> Tier 3),
  // then Column 2 runs down (Tier 1 -> Tier 2 -> Tier 3).
  // Column 3 is Work/Ventures running down (Tier 1 -> Tier 2 -> Tier 3).
  const personalColSize = Math.ceil(personalItems.length / 3);
  const fullCol0 = personalItems.slice(0, personalColSize);
  const fullCol1 = personalItems.slice(personalColSize, personalColSize * 2);
  const fullCol2 = personalItems.slice(personalColSize * 2);
  const fullCol3 = workItems;

  const col0PerTier = Math.ceil(fullCol0.length / 3);
  const col1PerTier = Math.ceil(fullCol1.length / 3);
  const col2PerTier = Math.ceil(fullCol2.length / 3);
  const col3PerTier = Math.ceil(fullCol3.length / 3);

  const tiers: CompletedPosterTier[] = [];

  for (let tierIdx = 0; tierIdx < 3; tierIdx++) {
    const col0 = fullCol0.slice(tierIdx * col0PerTier, (tierIdx + 1) * col0PerTier);
    const col1 = fullCol1.slice(tierIdx * col1PerTier, (tierIdx + 1) * col1PerTier);
    const col2 = fullCol2.slice(tierIdx * col2PerTier, (tierIdx + 1) * col2PerTier);
    const col3 = fullCol3.slice(tierIdx * col3PerTier, (tierIdx + 1) * col3PerTier);

    tiers.push({
      tierIndex: tierIdx,
      columns: [col0, col1, col2, col3],
    });
  }

  return {
    totalCount: preparedItems.length,
    tiers,
    generatedAt: new Date().toISOString(),
  };
}

export async function getCompletedPosterData(
  db: DB,
  userId: string,
  categories?: string[],
  timeframe?: '6m' | '12m' | 'all'
): Promise<CompletedPosterData> {
  // The Wall of Done is personal: the tasks you did (assigned to you, or yours and unassigned),
  // across every workspace you belong to.
  const [allMine, visibleEpics, userGoals] = await Promise.all([
    getProjectsForUser(db, userId, { assignee: 'me' }),
    getEpicsForUser(db, userId),
    db.select().from(schema.goals).where(eq(schema.goals.userId, userId)),
  ]);
  const completedTasks = allMine.filter((t) => t.status === 'done');
  const userEpics = visibleEpics;

  const epicsMap: Record<string, { id: string; title: string; goalId?: string | null }> = {};
  for (const epic of userEpics) {
    epicsMap[epic.id] = { id: epic.id, title: epic.title, goalId: epic.goalId };
  }

  const goalsMap: Record<string, { id: string; title: string; icon?: string | null }> = {};
  for (const goal of userGoals) {
    goalsMap[goal.id] = { id: goal.id, title: goal.title, icon: goal.icon };
  }

  return partitionCompletedTasks(completedTasks, epicsMap, goalsMap, categories, timeframe);
}
