// UI strings are Ukrainian per the assignment (A-7); code and comments stay in English.
export const UI = {
  appTitle: 'Скоринг-форма',
  addMeasurement: 'Додати вимірювання',
  // Add a length row (S-5.4).
  addLength: 'Додати довжину',
  activate: 'Активувати',
  cancel: 'Скасувати',
  remove: 'Видалити',
  statusPending: 'Очікує',
  statusDrawing: 'Малювання…',
  statusDone: 'Готово',
  // Row kind label (S-5.4).
  kindArea: 'Площа',
  // Row kind label (S-5.4).
  kindLength: 'Довжина',
  total: 'Разом',
  // Footer label for the length totals section (S-5.4).
  totalLength: 'Разом довжина',
  viewerFrameTitle: 'Переглядач OHIF',
  emptyHint: 'Рядків ще немає. Натисніть «Додати вимірювання».',
  bridgeStatus: 'Міст',
  bridgeReady: 'готовий',
  bridgeNotReady: 'очікує VIEWER_READY',
  bridgeQueued: 'у черзі',
  totalNoSpacingHint: 'без піксельного spacing, не додається до mm²',
  focusRow: 'Показати в переглядачі',
  focusHint: 'клік — показати в переглядачі',
  // Ukrainian noun agreement for "вимірювання": 1 and 2-4 keep that form, 5+/11-14 take "вимірювань".
  measurementsCount(n: number): string {
    const lastTwo = n % 100;
    const lastOne = n % 10;
    const count = String(n);
    if (lastOne >= 1 && lastOne <= 4 && (lastTwo < 11 || lastTwo > 14)) {
      return `${count} вимірювання`;
    }
    return `${count} вимірювань`;
  },
} as const;
