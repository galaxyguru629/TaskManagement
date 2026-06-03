import { BoardEventType } from '../../../graphql/generated/graphql';
import {
  BoardCardModel,
  BoardEventModel,
  BoardListModel,
  BoardViewModel,
} from '../models/board.types';

type TaskPayload = NonNullable<BoardEventModel['task']>;
type ListPayload = NonNullable<BoardEventModel['list']>;
type LabelPayload = NonNullable<BoardEventModel['label']>;
type CommentPayload = NonNullable<BoardEventModel['comment']>;
type ChecklistPayload = NonNullable<BoardEventModel['checklistItem']>;

export function shouldApplyTaskUpdate(existing: BoardCardModel | undefined, incoming: TaskPayload): boolean {
  if (!existing) return true;
  return incoming.version >= existing.version;
}

export function mergeBoardView(current: BoardViewModel, incoming: BoardViewModel): BoardViewModel {
  if (current.board.id !== incoming.board.id) return incoming;

  const mergedCards = new Map<string, BoardCardModel>();
  for (const card of collectCards(current)) {
    mergedCards.set(card.id, card);
  }
  for (const card of collectCards(incoming)) {
    const existing = mergedCards.get(card.id);
    mergedCards.set(card.id, existing ? mergeCard(card, existing) : card);
  }

  const currentListsById = new Map(current.lists.map((list) => [list.id, list]));
  const lists = incoming.lists.map((list) => {
    const currentList = currentListsById.get(list.id);
    const incomingIds = new Set(list.cards.map((card) => card.id));
    const tempCards =
      currentList?.cards.filter((card) => card.id.startsWith('temp-') && !incomingIds.has(card.id)) ?? [];
    const cards = [...list.cards.map((card) => mergedCards.get(card.id) ?? card), ...tempCards];
    return { ...list, cards: sortCards(cards) };
  });

  return {
    ...incoming,
    board: incoming.board.version >= current.board.version ? incoming.board : current.board,
    lists: sortLists(lists),
    labels: incoming.labels.length >= current.labels.length ? incoming.labels : current.labels,
    activity: current.activity.length >= incoming.activity.length ? current.activity : incoming.activity,
  };
}

export function applyBoardEvent(view: BoardViewModel | null, event: BoardEventModel): BoardViewModel | null {
  if (!view || event.boardId !== view.board.id) return view;

  switch (event.type) {
    case BoardEventType.BoardUpdated:
      return view;
    case BoardEventType.ListCreated:
      return event.list ? applyListCreated(view, event.list) : view;
    case BoardEventType.ListUpdated:
      return event.list ? applyListUpdated(view, event.list) : view;
    case BoardEventType.ListArchived:
      return event.list ? applyListArchived(view, event.list.id) : view;
    case BoardEventType.CardCreated:
      return event.task ? applyCardCreated(view, event.task) : view;
    case BoardEventType.CardUpdated:
      return event.task ? applyCardUpdated(view, event.task) : view;
    case BoardEventType.CardMoved:
      return event.task ? applyCardMoved(view, event.task) : view;
    case BoardEventType.CardArchived:
    case BoardEventType.CardDeleted:
      return event.task ? applyCardRemoved(view, event.task.id) : view;
    case BoardEventType.CommentCreated:
      return applyCommentCreated(view, event.task, event.comment, event.activity);
    case BoardEventType.ChecklistUpdated:
      return applyChecklistUpdated(view, event.task, event.checklistItem);
    case BoardEventType.ChecklistItemDeleted:
      return event.checklistItem
        ? removeChecklistItem(view, event.checklistItem.taskId, event.checklistItem.id)
        : view;
    case BoardEventType.LabelUpdated:
      return applyLabelUpdated(view, event.label, event.task);
    default:
      return view;
  }
}

export function taskToCard(task: TaskPayload, existing?: BoardCardModel): BoardCardModel {
  return {
    __typename: 'BoardCard',
    id: task.id,
    boardId: task.boardId,
    listId: task.listId,
    title: task.title,
    description: task.description ?? null,
    priority: task.priority,
    assignees: task.assignees ?? [],
    position: task.position,
    dueDate: task.dueDate ?? null,
    coverColor: task.coverColor ?? null,
    archived: task.archived,
    version: task.version,
    updatedAt: task.updatedAt,
    labels: existing?.labels ?? [],
    checklist: existing?.checklist ?? [],
    comments: existing?.comments ?? [],
  };
}

export function applyListCreated(view: BoardViewModel, list: ListPayload): BoardViewModel {
  if (view.lists.some((candidate) => candidate.id === list.id)) return view;
  const entry: BoardListModel = {
    __typename: 'BoardList',
    id: list.id,
    boardId: list.boardId,
    title: list.title,
    position: list.position,
    archived: list.archived,
    version: list.version,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    cards: [],
  };
  return { ...view, lists: sortLists([...view.lists, entry]) };
}

export function applyListUpdated(view: BoardViewModel, list: ListPayload): BoardViewModel {
  return {
    ...view,
    lists: sortLists(
      view.lists.map((candidate) =>
        candidate.id === list.id
          ? {
              ...candidate,
              title: list.title,
              position: list.position,
              archived: list.archived,
              version: list.version,
              updatedAt: list.updatedAt,
            }
          : candidate,
      ),
    ),
  };
}

export function applyListArchived(view: BoardViewModel, listId: string): BoardViewModel {
  return { ...view, lists: view.lists.filter((list) => list.id !== listId) };
}

export function applyCardCreated(view: BoardViewModel, task: TaskPayload): BoardViewModel {
  if (findCard(view, task.id)) return applyCardUpdated(view, task);
  return patchListsForCard(view, task, (cards) =>
    insertCardByPosition(
      cards.filter((card) => !card.id.startsWith('temp-')),
      taskToCard(task),
    ),
  );
}

export function applyCardUpdated(view: BoardViewModel, task: TaskPayload): BoardViewModel {
  const existing = findCard(view, task.id);
  if (!existing) return applyCardCreated(view, task);
  if (!shouldApplyTaskUpdate(existing, task)) return view;
  const updated = taskToCard(task, existing);
  if (existing.listId !== task.listId) {
    return applyCardMoved(view, task);
  }
  return patchCard(view, task.id, () => updated);
}

export function applyCardMoved(view: BoardViewModel, task: TaskPayload): BoardViewModel {
  const existing = findCard(view, task.id);
  if (existing && !shouldApplyTaskUpdate(existing, task)) return view;
  const card = taskToCard(task, existing ?? undefined);
  return {
    ...view,
    lists: sortLists(
      view.lists.map((list) => {
        const without = list.cards.filter((candidate) => candidate.id !== task.id);
        if (list.id === task.listId) {
          return { ...list, cards: insertCardByPosition(without, card) };
        }
        return { ...list, cards: without };
      }),
    ),
  };
}

export function applyCardRemoved(view: BoardViewModel, taskId: string): BoardViewModel {
  return {
    ...view,
    lists: view.lists.map((list) => ({ ...list, cards: list.cards.filter((card) => card.id !== taskId) })),
  };
}

export function applyCommentCreated(
  view: BoardViewModel,
  task: BoardEventModel['task'],
  comment: BoardEventModel['comment'],
  activity: BoardEventModel['activity'],
): BoardViewModel {
  let next = view;
  const taskId = task?.id ?? comment?.taskId;
  if (comment && taskId) {
    next = patchCard(next, taskId, (card) => ({
      ...card,
      comments: card.comments.some((item) => item.id === comment.id) ? card.comments : [comment, ...card.comments],
    }));
  }
  if (activity) {
    next = {
      ...next,
      activity: next.activity.some((item) => item.id === activity.id) ? next.activity : [activity, ...next.activity].slice(0, 100),
    };
  }
  if (task) {
    next = applyCardUpdated(next, task);
  }
  return next;
}

export function applyChecklistUpdated(
  view: BoardViewModel,
  task: BoardEventModel['task'],
  checklistItem: BoardEventModel['checklistItem'],
): BoardViewModel {
  if (!checklistItem) {
    return task ? applyCardUpdated(view, task) : view;
  }
  let next = patchCard(view, checklistItem.taskId, (card) => ({
    ...card,
    checklist: upsertChecklistItem(card.checklist, checklistItem),
  }));
  if (task) {
    next = applyCardUpdated(next, task);
  }
  return next;
}

export function applyLabelUpdated(
  view: BoardViewModel,
  label: BoardEventModel['label'],
  task: BoardEventModel['task'],
): BoardViewModel {
  let next = view;
  if (label) {
    const labels = view.labels.some((item) => item.id === label.id)
      ? view.labels.map((item) => (item.id === label.id ? label : item))
      : [...view.labels, label];
    next = { ...next, labels };
  }
  if (task) {
    next = applyCardUpdated(next, task);
  }
  return next;
}

export function reconcileCreatedCard(view: BoardViewModel, task: TaskPayload): BoardViewModel {
  const existing = findCard(view, task.id);
  return patchListsForCard(view, task, (cards) => {
    const withoutOptimistic = cards.filter((card) => !card.id.startsWith('temp-') && card.id !== task.id);
    return insertCardByPosition(withoutOptimistic, taskToCard(task, existing));
  });
}

export function reconcileTask(view: BoardViewModel, task: TaskPayload): BoardViewModel {
  const existing = findCard(view, task.id);
  if (existing && !shouldApplyTaskUpdate(existing, task)) return view;
  if (!existing) return applyCardCreated(view, task);
  if (existing.listId !== task.listId) return applyCardMoved(view, task);
  return applyCardUpdated(view, task);
}

export function applyChecklistItem(view: BoardViewModel, item: ChecklistPayload): BoardViewModel {
  return patchCard(view, item.taskId, (card) => ({
    ...card,
    checklist: upsertChecklistItem(card.checklist, item),
  }));
}

export function replaceChecklistTempId(
  view: BoardViewModel,
  taskId: string,
  tempId: string,
  item: ChecklistPayload,
): BoardViewModel {
  return patchCard(view, taskId, (card) => ({
    ...card,
    checklist: upsertChecklistItem(
      card.checklist.filter((entry) => entry.id !== tempId),
      item,
    ),
  }));
}

export function removeChecklistItem(view: BoardViewModel, taskId: string, itemId: string): BoardViewModel {
  return patchCard(view, taskId, (card) => ({
    ...card,
    checklist: card.checklist.filter((entry) => entry.id !== itemId),
  }));
}

export function applyComment(view: BoardViewModel, comment: CommentPayload): BoardViewModel {
  return patchCard(view, comment.taskId, (card) => ({
    ...card,
    comments: card.comments.some((item) => item.id === comment.id) ? card.comments : [comment, ...card.comments],
  }));
}

export function replaceCommentTempId(
  view: BoardViewModel,
  taskId: string,
  tempId: string,
  comment: CommentPayload,
): BoardViewModel {
  return patchCard(view, taskId, (card) => ({
    ...card,
    comments: [comment, ...card.comments.filter((entry) => entry.id !== tempId && entry.id !== comment.id)],
  }));
}

function cardMap(view: BoardViewModel): Map<string, { listId: string; card: BoardCardModel }> {
  const map = new Map<string, { listId: string; card: BoardCardModel }>();
  for (const list of view.lists) {
    for (const card of list.cards) {
      map.set(card.id, { listId: list.id, card });
    }
  }
  return map;
}

function findCard(view: BoardViewModel, taskId: string): BoardCardModel | undefined {
  for (const list of view.lists) {
    const card = list.cards.find((candidate) => candidate.id === taskId);
    if (card) return card;
  }
  return undefined;
}

function patchListsForCard(
  view: BoardViewModel,
  task: TaskPayload,
  transform: (cards: BoardCardModel[]) => BoardCardModel[],
): BoardViewModel {
  return {
    ...view,
    lists: sortLists(
      view.lists.map((list) => {
        if (list.id !== task.listId && !list.cards.some((c) => c.id === task.id)) {
          return list;
        }
        const without = list.cards.filter((card) => card.id !== task.id);
        if (list.id === task.listId) {
          return { ...list, cards: transform(without) };
        }
        return { ...list, cards: without };
      }),
    ),
  };
}

function patchCard(view: BoardViewModel, taskId: string, transform: (card: BoardCardModel) => BoardCardModel): BoardViewModel {
  return {
    ...view,
    lists: view.lists.map((list) => {
      const idx = list.cards.findIndex((card) => card.id === taskId);
      if (idx === -1) return list;
      const cards = [...list.cards];
      cards[idx] = transform(cards[idx]);
      return { ...list, cards };
    }),
  };
}

function upsertChecklistItem(
  checklist: BoardCardModel['checklist'],
  item: ChecklistPayload,
): BoardCardModel['checklist'] {
  const next = checklist.some((entry) => entry.id === item.id)
    ? checklist.map((entry) => (entry.id === item.id ? item : entry))
    : [...checklist, item];
  return [...next].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

function insertCardByPosition(cards: BoardCardModel[], card: BoardCardModel): BoardCardModel[] {
  return sortCards([...cards.filter((candidate) => candidate.id !== card.id), card]);
}

function sortLists(lists: BoardListModel[]): BoardListModel[] {
  return [...lists].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

function sortCards(cards: BoardCardModel[]): BoardCardModel[] {
  return [...cards].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

function collectCards(view: BoardViewModel): BoardCardModel[] {
  return view.lists.flatMap((list) => list.cards);
}

function mergeCard(incoming: BoardCardModel, existing: BoardCardModel): BoardCardModel {
  if (existing.version > incoming.version) return existing;
  if (incoming.version > existing.version) {
    return {
      ...incoming,
      labels: incoming.labels.length ? incoming.labels : existing.labels,
      checklist: existing.checklist.length > incoming.checklist.length ? existing.checklist : incoming.checklist,
      comments: existing.comments.length > incoming.comments.length ? existing.comments : incoming.comments,
    };
  }
  return {
    ...incoming,
    labels: incoming.labels.length ? incoming.labels : existing.labels,
    checklist: existing.checklist.length >= incoming.checklist.length ? existing.checklist : incoming.checklist,
    comments: existing.comments.length >= incoming.comments.length ? existing.comments : incoming.comments,
  };
}

