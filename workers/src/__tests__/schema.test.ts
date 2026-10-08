import { describe, expect, it } from 'vitest';
import * as schema from '../db/schema';

describe('D1 Database Schema', () => {
  it('exports all expected multi-user tables', () => {
    expect(schema.organisations).toBeDefined();
    expect(schema.organisationMembers).toBeDefined();
    expect(schema.organisationInvites).toBeDefined();
    expect(schema.projects).toBeDefined();
    expect(schema.tasks).toBeDefined();
    expect(schema.taskUserGoals).toBeDefined();
    expect(schema.taskUpdates).toBeDefined();
  });

  it('retains legacy compatibility exports', () => {
    expect(schema.users).toBeDefined();
    expect(schema.goals).toBeDefined();
    expect(schema.epics).toBeDefined();
    expect(schema.projectUpdates).toBeDefined();
  });

  it('defines organisations columns correctly', () => {
    expect(schema.organisations.id).toBeDefined();
    expect(schema.organisations.name).toBeDefined();
    expect(schema.organisations.slug).toBeDefined();
    expect(schema.organisations.createdBy).toBeDefined();
    expect(schema.organisations.createdAt).toBeDefined();
    expect(schema.organisations.updatedAt).toBeDefined();
  });

  it('defines organisationMembers columns correctly', () => {
    expect(schema.organisationMembers.id).toBeDefined();
    expect(schema.organisationMembers.orgId).toBeDefined();
    expect(schema.organisationMembers.userId).toBeDefined();
    expect(schema.organisationMembers.role).toBeDefined();
  });

  it('defines organisationInvites columns correctly', () => {
    expect(schema.organisationInvites.id).toBeDefined();
    expect(schema.organisationInvites.orgId).toBeDefined();
    expect(schema.organisationInvites.email).toBeDefined();
    expect(schema.organisationInvites.role).toBeDefined();
    expect(schema.organisationInvites.token).toBeDefined();
    expect(schema.organisationInvites.invitedBy).toBeDefined();
    expect(schema.organisationInvites.expiresAt).toBeDefined();
  });

  it('defines projects columns correctly', () => {
    expect(schema.projects.id).toBeDefined();
    expect(schema.projects.orgId).toBeDefined();
    expect(schema.projects.key).toBeDefined();
    expect(schema.projects.name).toBeDefined();
    expect(schema.projects.description).toBeDefined();
    expect(schema.projects.leadUserId).toBeDefined();
    expect(schema.projects.isArchived).toBeDefined();
  });

  it('defines tasks columns correctly', () => {
    expect(schema.tasks.id).toBeDefined();
    expect(schema.tasks.projectId).toBeDefined();
    expect(schema.tasks.epicId).toBeDefined();
    expect(schema.tasks.reporterId).toBeDefined();
    expect(schema.tasks.assigneeId).toBeDefined();
    expect(schema.tasks.title).toBeDefined();
    expect(schema.tasks.reason).toBeDefined();
    expect(schema.tasks.status).toBeDefined();
    expect(schema.tasks.priority).toBeDefined();
    expect(schema.tasks.size).toBeDefined();
    expect(schema.tasks.notes).toBeDefined();
    expect(schema.tasks.statusLastChangedOn).toBeDefined();
    expect(schema.tasks.awaitUntil).toBeDefined();
    expect(schema.tasks.gmailThreadId).toBeDefined();
    expect(schema.tasks.isDeleted).toBeDefined();
  });

  it('defines taskUserGoals columns correctly', () => {
    expect(schema.taskUserGoals.taskId).toBeDefined();
    expect(schema.taskUserGoals.userId).toBeDefined();
    expect(schema.taskUserGoals.goalId).toBeDefined();
  });

  it('defines taskUpdates columns correctly', () => {
    expect(schema.taskUpdates.id).toBeDefined();
    expect(schema.taskUpdates.taskId).toBeDefined();
    expect(schema.taskUpdates.authorId).toBeDefined();
    expect(schema.taskUpdates.note).toBeDefined();
    expect(schema.taskUpdates.gmailThreadId).toBeDefined();
  });
});
