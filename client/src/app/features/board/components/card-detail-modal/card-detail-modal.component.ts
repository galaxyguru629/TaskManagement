import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BoardActivityModel, BoardCardModel, BoardLabelModel, BoardMemberModel, CardConflict } from '../../models/board.types';
import { BoardMembersMultiPickerComponent } from '../board-members-multi-picker/board-members-multi-picker.component';
import { DueDatePickerComponent } from '../due-date-picker/due-date-picker.component';

interface ActivityGroup {
  entry: BoardActivityModel;
  count: number;
}

const PRIORITIES = [1, 2, 3, 4, 5] as const;

@Component({
  selector: 'app-card-detail-modal',
  standalone: true,
  imports: [FormsModule, BoardMembersMultiPickerComponent, DueDatePickerComponent],
  templateUrl: './card-detail-modal.component.html',
  styleUrl: './card-detail-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardDetailModalComponent {
  readonly card = input<BoardCardModel | null>(null);
  readonly boardMembers = input<BoardMemberModel[]>([]);
  readonly labels = input<BoardLabelModel[]>([]);
  readonly activity = input<BoardActivityModel[]>([]);
  readonly conflicts = input<CardConflict[]>([]);
  readonly checklistPending = input(false);
  readonly commentPending = input(false);

  readonly close = output<void>();
  readonly saveCard = output<{
    card: BoardCardModel;
    input: Partial<Pick<BoardCardModel, 'title' | 'description' | 'priority' | 'assignees' | 'dueDate' | 'coverColor'>>;
  }>();
  readonly archiveCard = output<BoardCardModel>();
  readonly addChecklistItem = output<{ card: BoardCardModel; text: string }>();
  readonly toggleChecklistItem = output<{ id: string; checked: boolean }>();
  readonly addComment = output<{ card: BoardCardModel; body: string }>();
  readonly dismissConflict = output<string>();

  readonly priorities = PRIORITIES;

  readonly title = signal('');
  readonly description = signal('');
  readonly assignees = signal<string[]>([]);
  readonly dueDate = signal('');
  readonly coverColor = signal('');
  readonly priority = signal(2);
  readonly checklistText = signal('');
  readonly commentBody = signal('');

  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  readonly activeConflict = computed(() => {
    const id = this.card()?.id;
    return id ? this.conflicts().find((conflict) => conflict.taskId === id) ?? null : null;
  });

  readonly checklistStats = computed(() => {
    const items = this.card()?.checklist ?? [];
    if (!items.length) return null;
    const done = items.filter((item) => item.checked).length;
    const total = items.length;
    const percent = Math.round((done / total) * 100);
    return { done, total, percent };
  });

  readonly cardActivity = computed(() => {
    const id = this.card()?.id;
    const groups: ActivityGroup[] = [];
    for (const entry of this.activity().filter((item) => item.taskId === id)) {
      const previous = groups[groups.length - 1];
      if (previous && previous.entry.actor === entry.actor && previous.entry.type === entry.type && previous.entry.message === entry.message) {
        previous.count += 1;
      } else {
        groups.push({ entry, count: 1 });
      }
      if (groups.length >= 20) break;
    }
    return groups;
  });

  constructor() {
    effect(() => {
      const card = this.card();
      this.title.set(card?.title ?? '');
      this.description.set(card?.description ?? '');
      this.assignees.set([...(card?.assignees ?? [])]);
      this.dueDate.set(card?.dueDate ?? '');
      this.coverColor.set(card?.coverColor ?? '');
      this.priority.set(card?.priority ?? 2);
      this.checklistText.set('');
      this.commentBody.set('');
    });
  }

  scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 300);
  }

  save(): void {
    const card = this.card();
    if (!card || !this.title().trim()) return;
    this.saveCard.emit({
      card,
      input: {
        title: this.title().trim(),
        description: this.description().trim() || null,
        assignees: this.assignees(),
        dueDate: this.dueDate() || null,
        coverColor: this.coverColor() || null,
        priority: Number(this.priority()) || 2,
      },
    });
  }

  onAssigneesChange(auth0Subs: string[]): void {
    this.assignees.set(auth0Subs);
    this.save();
  }

  onDueDateChange(value: string): void {
    this.dueDate.set(value);
    this.save();
  }

  onPriorityChange(value: number): void {
    this.priority.set(value);
    this.save();
  }

  commitCoverColor(value: string): void {
    this.coverColor.set(value);
    this.save();
  }

  displayActor(actor: string): string {
    if (!actor) return 'User';
    const member = this.boardMembers().find((entry) => entry.auth0Sub === actor);
    if (member) return member.displayName || member.email || actor;
    return actor;
  }

  displayActivity(message: string): string {
    const card = this.card();
    if (!card) return message;
    return message.replaceAll(`"${card.title}"`, 'this card');
  }

  formatTimestamp(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  submitChecklist(): void {
    const card = this.card();
    if (!card || !this.checklistText().trim() || this.checklistPending()) return;
    this.addChecklistItem.emit({ card, text: this.checklistText() });
    this.checklistText.set('');
  }

  submitComment(): void {
    const card = this.card();
    if (!card || !this.commentBody().trim() || this.commentPending()) return;
    this.addComment.emit({ card, body: this.commentBody() });
    this.commentBody.set('');
  }

  isTempChecklistItem(id: string): boolean {
    return id.startsWith('temp-checklist-');
  }
}
