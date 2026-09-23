import type { RestoreFailureReason } from '@bdiadiun/scoring-contract';

export const t = {
  appTitle: 'Скоринг-форма',
  addMeasurement: 'Додати вимірювання',
  addLength: 'Додати довжину',
  activate: 'Активувати',
  cancel: 'Скасувати',
  remove: 'Видалити',
  statusPending: 'Очікує',
  statusDrawing: 'Малювання…',
  statusDone: 'Готово',
  kindArea: 'Площа',
  kindLength: 'Довжина',
  total: 'Разом',
  totalLength: 'Разом довжина',
  viewerFrameTitle: 'Переглядач OHIF',
  emptyHint: 'Рядків ще немає. Натисніть «Додати вимірювання».',
  bridgeStatus: 'Міст',
  bridgeReady: 'готовий',
  bridgeNotReady: 'очікує VIEWER_READY',
  bridgeQueued: 'у черзі',
  totalNoSpacingHint: 'без піксельного spacing, не додається до mm²',
  focusRow: 'Показати в переглядачі',
  emptyValue: '—',
  rowNumberPrefix: '#',
  focusHint: 'клік — показати в переглядачі',
  restoreFailed: 'анотацію не відновлено',
  restoreFailureReason: {
    'already-present': 'анотація вже існує',
    'unknown-study': 'інше дослідження',
    'viewer-error': 'помилка переглядача',
  } satisfies Record<RestoreFailureReason, string>,
  measurementsCount: (n: number): string => {
    const lastTwo = n % 100;
    const lastOne = n % 10;
    const count = String(n);
    if (lastOne >= 1 && lastOne <= 4 && (lastTwo < 11 || lastTwo > 14)) {
      return `${count} вимірювання`;
    }
    return `${count} вимірювань`;
  },
} as const;
