import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BoardFacade } from '../../data-access/board.facade';

@Component({
  selector: 'app-create-board-page',
  standalone: true,
  imports: [FormsModule],
  providers: [BoardFacade],
  templateUrl: './create-board-page.component.html',
  styleUrl: './create-board-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateBoardPageComponent {
  private readonly facade = inject(BoardFacade);
  private readonly router = inject(Router);

  readonly creating = signal(false);
  readonly imagePreview = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  private logoData: string | null = null;
  fileName = '';

  title = '';
  description = '';

  async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.error.set('Please select an image file.');
      return;
    }
    if (file.size > 2_500_000) {
      this.error.set('Image must be 2.5 MB or smaller.');
      return;
    }
    const data = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
    this.logoData = `data:${file.type};base64,${base64}`;
    this.imagePreview.set(this.logoData);
    this.fileName = file.name;
    this.error.set(null);
  }

  removeImage(): void {
    this.logoData = null;
    this.imagePreview.set(null);
    this.fileName = '';
  }

  async submit(): Promise<void> {
    const title = this.title.trim();
    if (!title || this.creating()) return;
    this.creating.set(true);
    this.error.set(null);
    try {
      const boardId = await this.facade.createBoard(title, this.description.trim() || null, this.logoData);
      if (!boardId) {
        this.error.set('Could not create board.');
        return;
      }
      await this.router.navigate(['/board', boardId]);
    } finally {
      this.creating.set(false);
    }
  }
}
