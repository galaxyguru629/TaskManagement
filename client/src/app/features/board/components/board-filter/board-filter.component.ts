import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BoardLabelModel, BoardMemberModel } from '../../models/board.types';

export type DueDateOption = 'none' | 'overdue' | 'today' | 'week' | 'month';

@Component({
  selector: 'app-board-filter',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './board-filter.component.html',
  styleUrl: './board-filter.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardFilterComponent {
  readonly search = input<string>('');
  readonly assigneeIds = input<Set<string>>(new Set());
  readonly labelIds = input<Set<string>>(new Set());
  readonly dueDateOptions = input<Set<DueDateOption>>(new Set());
  readonly priorities = input<Set<number>>(new Set());
  readonly members = input<BoardMemberModel[]>([]);
  readonly labels = input<BoardLabelModel[]>([]);
  readonly resultCount = input(0);

  readonly searchChange = output<string>();
  readonly assigneeToggle = output<string>();
  readonly labelToggle = output<string>();
  readonly dueDateToggle = output<DueDateOption>();
  readonly priorityToggle = output<number>();
  readonly clearFilters = output<void>();
  readonly closePanel = output<void>();

  readonly dueDateOptionsList: { value: DueDateOption; label: string }[] = [
    { value: 'none', label: 'No due date' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'today', label: 'Due today' },
    { value: 'week', label: 'Due this week' },
    { value: 'month', label: 'Due this month' },
  ];
}
