import type { VoiceProposal } from '../../../components/VoiceCommand/voiceTypes';
import { applyVoiceChange, newApplySession, VoiceApplyError } from './applyVoiceChange';

const API = 'https://worker.example.com/api/v2';
const fetchMock = jest.fn();
global.fetch = fetchMock as any;

const ok = (body: unknown = {}) =>
  Promise.resolve({ ok: true, status: 200, json: async () => body });
const fail = (status: number, body: unknown) =>
  Promise.resolve({ ok: false, status, json: async () => body });

function lastCall() {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return { url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined };
}

const before = {
  id: 'task-1',
  userId: 'tim',
  project: 'Acme Solar onboarding',
  status: 'do' as const,
  priority: 7,
  size: '**' as const,
  projectId: 'proj-solfit',
  projectName: 'Solfit',
  assigneeId: null,
  assigneeName: null,
  epicId: null,
  isDeleted: false,
  createdAt: '',
  updatedAt: '',
};

describe('applyVoiceChange', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    process.env.NEXT_PUBLIC_WORKER_API_BASE_URL = API;
  });

  it('creates a task with the resolved projectId, assigneeId and epicId', async () => {
    fetchMock.mockReturnValue(ok({ id: 'new' }));
    const change: VoiceProposal = {
      type: 'create',
      before: null,
      after: {
        project: 'Check inverter datasheet',
        status: 'do',
        priority: 6,
        size: '*',
        notes: null as any,
      },
      projectId: 'proj-solfit',
      projectName: 'Solfit',
      orgName: 'Migrating Dragons',
      assigneeId: 'robin',
      assigneeName: 'Robin Fairweather',
      epicId: 'epic-br',
    };
    const outcome = await applyVoiceChange(change, 'tok', newApplySession(), 'tim');
    expect(lastCall()).toEqual({
      url: `${API}/projects`,
      method: 'POST',
      body: {
        project: 'Check inverter datasheet',
        status: 'do',
        priority: 6,
        size: '*',
        projectId: 'proj-solfit',
        assigneeId: 'robin',
        epicId: 'epic-br',
      },
    });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
    expect(outcome.message).toBe('Added "Check inverter datasheet" in Solfit for Robin Fairweather');
  });

  it('sends assigneeId null for an unassigned task, and the category for a new project', async () => {
    fetchMock.mockReturnValue(ok());
    await applyVoiceChange(
      {
        type: 'create',
        before: null,
        after: { project: 'Plan the garden', status: 'awaiting' },
        projectId: null,
        projectName: 'Allotment',
        isNewProject: true,
        assigneeId: null,
      },
      'tok',
      newApplySession()
    );
    const { body } = lastCall();
    expect(body.assigneeId).toBeNull();
    expect(body.category).toBe('Allotment');
    expect(body.projectId).toBeUndefined();
    // Awaiting always needs a date: falls back to 30 days out
    expect(body.awaitUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('links tasks to epics and projects created earlier in the same review', async () => {
    const session = newApplySession();
    fetchMock.mockReturnValueOnce(ok({ id: 'proj-new' }));
    await applyVoiceChange(
      {
        type: 'createProject',
        before: null,
        after: { project: 'Hydrogen' },
        orgId: 'org-md',
        orgName: 'Migrating Dragons',
        projectName: 'Hydrogen',
        isNewProject: true,
      },
      'tok',
      session
    );
    expect(lastCall()).toEqual({
      url: `${API}/organisations/org-md/projects`,
      method: 'POST',
      body: { name: 'Hydrogen' },
    });

    fetchMock.mockReturnValueOnce(ok({ id: 'epic-new' }));
    await applyVoiceChange(
      {
        type: 'createEpic',
        before: null,
        after: { project: 'Pilot' },
        projectId: null,
        projectName: 'Hydrogen',
        isNewProject: true,
      },
      'tok',
      session
    );
    expect(lastCall().body).toEqual({ title: 'Pilot', status: 'active', projectId: 'proj-new' });

    fetchMock.mockReturnValueOnce(ok());
    await applyVoiceChange(
      {
        type: 'create',
        before: null,
        after: { project: 'Call supplier' },
        projectId: null,
        projectName: 'Hydrogen',
        isNewProject: true,
        epicTitle: 'pilot',
      },
      'tok',
      session
    );
    expect(lastCall().body).toMatchObject({ projectId: 'proj-new', epicId: 'epic-new' });
  });

  it('updates only what changed, and reassigns with PUT', async () => {
    fetchMock.mockReturnValue(ok());
    await applyVoiceChange(
      {
        type: 'update',
        before: before as any,
        after: { project: 'Acme Solar onboarding', status: 'done', priority: 7, size: '**' },
        taskId: 'task-1',
        projectId: 'proj-solfit',
        assigneeId: 'robin',
        assigneeChanged: true,
      },
      'tok',
      newApplySession()
    );
    const { url, method, body } = lastCall();
    expect(url).toBe(`${API}/projects/task-1`);
    expect(method).toBe('PUT');
    // Only the changed fields go to the API
    expect(body).toEqual({ status: 'done', assigneeId: 'robin' });
  });

  it('moves a task by projectId and leaves the assignee alone when unchanged', async () => {
    fetchMock.mockReturnValue(ok());
    await applyVoiceChange(
      {
        type: 'update',
        before: before as any,
        after: { project: 'Acme Solar onboarding', status: 'do' },
        taskId: 'task-1',
        projectId: 'proj-personal',
      },
      'tok',
      newApplySession()
    );
    expect(lastCall().body).toEqual({ projectId: 'proj-personal' });
  });

  it('makes no call when nothing changed', async () => {
    const outcome = await applyVoiceChange(
      {
        type: 'update',
        before: before as any,
        after: { project: 'Acme Solar onboarding', status: 'do', priority: 7 },
        taskId: 'task-1',
        projectId: 'proj-solfit',
      },
      'tok',
      newApplySession()
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(outcome.message).toBe('"Acme Solar onboarding" was already up to date');
  });

  it('claims with PUT { assigneeId: me }', async () => {
    fetchMock.mockReturnValue(ok());
    const outcome = await applyVoiceChange(
      { type: 'claim', before: before as any, after: null, taskId: 'task-1', assigneeId: 'tim' },
      'tok',
      newApplySession(),
      'tim'
    );
    expect(lastCall()).toEqual({
      url: `${API}/projects/task-1`,
      method: 'PUT',
      body: { assigneeId: 'tim' },
    });
    expect(outcome.message).toBe('"Acme Solar onboarding" is yours now');
  });

  it('deletes with DELETE', async () => {
    fetchMock.mockReturnValue(ok());
    await applyVoiceChange(
      { type: 'delete', before: before as any, after: null, taskId: 'task-1' },
      'tok',
      newApplySession()
    );
    expect(lastCall()).toEqual({
      url: `${API}/projects/task-1`,
      method: 'DELETE',
      body: undefined,
    });
  });

  it("throws the API's own message on 403", async () => {
    fetchMock.mockReturnValue(fail(403, { error: 'You have view-only access to "Solfit"' }));
    const promise = applyVoiceChange(
      { type: 'claim', before: before as any, after: null, taskId: 'task-1', assigneeId: 'tim' },
      'tok',
      newApplySession()
    );
    await expect(promise).rejects.toBeInstanceOf(VoiceApplyError);
    await expect(promise).rejects.toMatchObject({
      status: 403,
      message: 'You have view-only access to "Solfit"',
    });
  });

  it('gives a readable message when the API sends none', async () => {
    fetchMock.mockReturnValue(fail(400, { success: false, error: { issues: [] } }));
    await expect(
      applyVoiceChange(
        { type: 'create', before: null, after: { project: 'X' } },
        'tok',
        newApplySession()
      )
    ).rejects.toMatchObject({ message: `Couldn't add "X": some of the details weren't valid.` });
  });
});
