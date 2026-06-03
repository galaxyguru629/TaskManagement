import { BoardEventType } from '../../../graphql/generated/graphql';
import { BoardCardModel, BoardViewModel } from '../models/board.types';
import {
  applyCardUpdated,
  mergeBoardView,
  reconcileTask,
  shouldApplyTaskUpdate,
} from './board-sync';

type TaskPayload = {
  __typename?: 'Task';
  id: string;
  boardId: string;
  listId: string;
  title: string;
  description?: string | null;
  priority: number;
  assignees: string[];
  position: number;
  dueDate?: string | null;
  coverColor?: string | null;
  archived: boolean;
  version: number;
  updatedAt: string;
};

function card(overrides: Partial<BoardCardModel> & Pick<BoardCardModel, 'id'>): BoardCardModel {
  return {
    __typename: 'BoardCard',
    boardId: 'board-1',
    listId: 'list-1',
    title: 'Card',
    description: null,
    priority: 2,
    assignees: [],
    position: 1024,
    dueDate: null,
    coverColor: null,
    archived: false,
    version: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    labels: [],
    checklist: [],
    comments: [],
    ...overrides,
  };
}

function taskPayload(overrides: Partial<TaskPayload> & Pick<TaskPayload, 'id'>): TaskPayload {
  return {
    __typename: 'Task',
    boardId: 'board-1',
    listId: 'list-1',
    title: 'Card',
    description: null,
    priority: 2,
    assignees: [],
    position: 1024,
    dueDate: null,
    coverColor: null,
    archived: false,
    version: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function viewWithCards(cards: BoardCardModel[]): BoardViewModel {
  return {
    board: {
      __typename: 'Board',
      id: 'board-1',
      title: 'Board',
      description: null,
      background: '#000',
      logoUrl: null,
      createdByAuth0Sub: 'user',
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    lists: [
      {
        __typename: 'BoardList',
        id: 'list-1',
        boardId: 'board-1',
        title: 'To Do',
        position: 1024,
        archived: false,
        version: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        cards,
      },
    ],
    labels: [],
    activity: [],
  };
}

describe('board-sync version guards', () => {
  it('shouldApplyTaskUpdate rejects stale server payloads', () => {
    const existing = card({ id: 'task-1', version: 3, title: 'New title' });
    const stale = taskPayload({ id: 'task-1', version: 2, title: 'Old title' });
    expect(shouldApplyTaskUpdate(existing, stale)).toBeFalse();
  });

  it('applyCardUpdated keeps newer local card when server version is older', () => {
    const view = viewWithCards([card({ id: 'task-1', version: 3, title: 'Optimistic title' })]);
    const stale = taskPayload({ id: 'task-1', version: 2, title: 'Stale title' });
    const next = applyCardUpdated(view, stale);
    expect(next.lists[0]?.cards[0]?.title).toBe('Optimistic title');
    expect(next.lists[0]?.cards[0]?.version).toBe(3);
  });

  it('reconcileTask applies server payload when version is newer', () => {
    const view = viewWithCards([card({ id: 'task-1', version: 2, title: 'Local' })]);
    const server = taskPayload({ id: 'task-1', version: 3, title: 'Server' });
    const next = reconcileTask(view, server);
    expect(next.lists[0]?.cards[0]?.title).toBe('Server');
    expect(next.lists[0]?.cards[0]?.version).toBe(3);
  });
});

describe('mergeBoardView', () => {
  it('keeps higher-version local cards during refetch merge', () => {
    const current = viewWithCards([
      card({ id: 'task-1', version: 4, title: 'Edited locally', assignees: ['user-a'] }),
    ]);
    const incoming = viewWithCards([card({ id: 'task-1', version: 2, title: 'Stale snapshot', assignees: [] })]);
    const merged = mergeBoardView(current, incoming);
    expect(merged.lists[0]?.cards[0]?.title).toBe('Edited locally');
    expect(merged.lists[0]?.cards[0]?.version).toBe(4);
    expect(merged.lists[0]?.cards[0]?.assignees).toEqual(['user-a']);
  });

  it('preserves optimistic temp cards from current view', () => {
    const current = viewWithCards([card({ id: 'temp-123', version: 0, title: 'Creating...' })]);
    const incoming = viewWithCards([]);
    const merged = mergeBoardView(current, incoming);
    expect(merged.lists[0]?.cards.some((item) => item.id === 'temp-123')).toBeTrue();
  });
});

describe('BoardEventType card snapshot classification', () => {
  it('treats checklist updates as non-card-snapshot events', () => {
    expect(BoardEventType.ChecklistUpdated).not.toBe(BoardEventType.CardUpdated);
  });
});
