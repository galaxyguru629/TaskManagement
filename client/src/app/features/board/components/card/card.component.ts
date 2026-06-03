import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { BoardCardModel, BoardMemberModel } from '../../models/board.types';
import { memberSingleInitial } from '../../utils/board.utils';

@Component({
  selector: 'app-board-card',
  standalone: true,
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComponent {
  readonly card = input.required<BoardCardModel>();
  readonly members = input<BoardMemberModel[]>([]);
  readonly conflicted = input(false);
  readonly open = output<BoardCardModel>();
  readonly archive = output<BoardCardModel>();

  readonly checklistProgress = computed(() => {
    const items = this.card().checklist;
    if (!items.length) return null;
    return `${items.filter((item) => item.checked).length}/${items.length}`;
  });

  readonly assignees = computed(() => {
    const ids = this.card().assignees ?? [];
    if (!ids.length) return [];
    const lookup = new Map(this.members().map((member) => [member.auth0Sub, member]));
    return ids.map((id) => lookup.get(id)).filter((member): member is BoardMemberModel => Boolean(member));
  });

  memberInitials = memberSingleInitial;
}
