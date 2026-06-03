import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BoardFacade } from '../../data-access/board.facade';
import { BoardHeaderComponent } from '../../components/board-header/board-header.component';
import { BoardCanvasComponent } from '../../components/board-canvas/board-canvas.component';
import { BoardFilterComponent } from '../../components/board-filter/board-filter.component';
import { CardDetailModalComponent } from '../../components/card-detail-modal/card-detail-modal.component';

@Component({
  selector: 'app-board-page',
  standalone: true,
  imports: [BoardHeaderComponent, BoardCanvasComponent, BoardFilterComponent, CardDetailModalComponent],
  providers: [BoardFacade],
  templateUrl: './board-page.component.html',
  styleUrl: './board-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardPageComponent implements OnInit {
  readonly facade = inject(BoardFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const boardId = this.route.snapshot.paramMap.get('boardId');
    if (!boardId) {
      void this.router.navigate(['/home']);
      return;
    }
    this.facade.init(boardId);
  }
}
