/**
 * @fileoverview Canonical Goal data contracts shared across the Next.js frontend.
 * @module app/types/goal.types
 */

export type GoalType = 'aim' | 'focus' | 'value' | 'housekeeping';

export interface Goal {
  id: string;
  userId: string;
  type: GoalType;
  title: string;
  description?: string | null;
  icon?: string | null;
  orderIndex: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GoalCreateInput {
  type: GoalType;
  title: string;
  description?: string | null;
  icon?: string | null;
  orderIndex?: number;
  isActive?: boolean;
}

export interface GoalUpdateInput {
  type?: GoalType;
  title?: string;
  description?: string | null;
  icon?: string | null;
  orderIndex?: number;
  isActive?: boolean;
}
