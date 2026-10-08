import { describe, expect, it } from 'vitest';
import {
  projectCreateSchema,
  projectMergeSchema,
  projectUpdateCreateSchema,
  projectUpdateSchema,
} from './projectValidators';

describe('projectValidators', () => {
  describe('projectCreateSchema', () => {
    it('accepts gmailThreadId on create', () => {
      const result = projectCreateSchema.safeParse({
        project: 'Email follow-up',
        gmailThreadId: 'thread-12345',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gmailThreadId).toBe('thread-12345');
      }
    });

    it('rejects awaiting projects without a return date', () => {
      const result = projectCreateSchema.safeParse({
        project: 'Renew passport',
        reason: 'Expires soon',
        status: 'awaiting',
        priority: 5,
        size: '***',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('projectUpdateSchema', () => {
    it('accepts gmailThreadId on update', () => {
      const result = projectUpdateSchema.safeParse({
        gmailThreadId: 'thread-67890',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gmailThreadId).toBe('thread-67890');
      }
    });
  });

  describe('projectUpdateCreateSchema', () => {
    it('validates note and optional gmailThreadId', () => {
      const valid = projectUpdateCreateSchema.safeParse({
        note: 'Customer replied with details',
        gmailThreadId: 'thread_xyz',
      });
      expect(valid.success).toBe(true);

      const validWithoutThread = projectUpdateCreateSchema.safeParse({
        note: 'Customer replied with details',
      });
      expect(validWithoutThread.success).toBe(true);

      const invalidEmpty = projectUpdateCreateSchema.safeParse({
        note: '',
      });
      expect(invalidEmpty.success).toBe(false);
    });
  });

  describe('projectMergeSchema', () => {
    it('validates a correct payload with sourceId UUID', () => {
      const valid = { sourceId: '123e4567-e89b-12d3-a456-426614174000' };
      const result = projectMergeSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects missing or invalid sourceId', () => {
      expect(projectMergeSchema.safeParse({}).success).toBe(false);
      expect(projectMergeSchema.safeParse({ sourceId: 'not-a-uuid' }).success).toBe(false);
    });
  });
});
