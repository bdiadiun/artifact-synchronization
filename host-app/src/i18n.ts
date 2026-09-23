// User-visible strings are Ukrainian per decision A-7; code and comments stay in English.
// `t` is the single place these strings live; a real i18n library is out of scope (X-3).
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
  // A-14: shown on a row whose annotation could not be rebuilt after a reload.
  restoreFailed: 'анотацію не відновлено',
  restoreFailureReason: {
    'already-present': 'анотація вже існує',
    'unknown-study': 'інше дослідження',
    'viewer-error': 'помилка переглядача',
  } satisfies Record<RestoreFailureReason, string>,
  // Ukrainian noun agreement for "вимірювання": 1 and 2-4 keep that form, 5+/11-14 take "вимірювань".
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
