import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { BoardCardModel, BoardListModel, BoardMemberModel, CardConflict } from '../../models/board.types';
import { CardComponent } from '../card/card.component';
import { CardComposerComponent } from '../card-composer/card-composer.component';

@Component({
  selector: 'app-board-list',
  standalone: true,
  imports: [CdkDropList, CdkDrag, CdkDragHandle, CardComponent, CardComposerComponent],
  templateUrl: './board-list.component.html',
  styleUrl: './board-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardListComponent {
  readonly list = input.required<BoardListModel>();
  readonly connectedTo = input<string[]>([]);
  readonly conflicts = input<CardConflict[]>([]);
  readonly members = input<BoardMemberModel[]>([]);

  readonly createCard = output<{ list: BoardListModel; title: string }>();
  readonly cardDropped = output<CdkDragDrop<BoardCardModel[]>>();
  readonly openCard = output<BoardCardModel>();
  readonly archiveCard = output<BoardCardModel>();

  readonly conflictIds = computed(() => new Set(this.conflicts().map((conflict) => conflict.taskId)));
  readonly dropActive = signal(false);
}
