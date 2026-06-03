import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-stack" aria-live="polite">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast toast--{{ toast.kind }}" role="status">
          <span>{{ toast.message }}</span>
          <button type="button" (click)="toastService.dismiss(toast.id)" aria-label="Dismiss">×</button>
        </div>
      }
    </div>
  `,
  styleUrl: './toast-container.component.scss',
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);
}
