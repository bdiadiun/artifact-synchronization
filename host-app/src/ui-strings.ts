// The UI language follows the assignment (decision A-7); code and comments stay in English.
export const UI = {
  // Panel heading.
  appTitle: 'Скоринг-форма',
  // Button that creates a new pending row.
  addMeasurement: 'Додати вимірювання',
  // Button that arms the ellipse tool for a specific row.
  activate: 'Активувати',
  // Button that cancels an armed row.
  cancel: 'Скасувати',
  // Row status: created, not yet activated.
  statusPending: 'Очікує',
  // Row status: tool armed, waiting for the user to draw.
  statusDrawing: 'Малювання…',
  // Row status: measurement received.
  statusDone: 'Готово',
  // Label for the sum of all row values.
  total: 'Разом',
  // Iframe accessible title.
  viewerFrameTitle: 'Переглядач OHIF',
  // Shown when the form has no rows yet.
  emptyHint: 'Рядків ще немає. Натисніть «Додати вимірювання».',
  // Label for the bridge dev status line (P-9 diagnostic surface, decision A-9).
  bridgeStatus: 'Міст',
  // Bridge status value: VIEWER_READY has been seen.
  bridgeReady: 'готовий',
  // Bridge status value: still waiting for the viewer's first VIEWER_READY.
  bridgeNotReady: 'очікує VIEWER_READY',
  // Label preceding the queued-command count in the bridge status line.
  bridgeQueued: 'у черзі',
  // Shown next to a px² total (C-4.3.8, Q-6): explains why it has its own line instead of being
  // folded into the mm² sum.
  totalNoSpacingHint: 'без піксельного spacing, не додається до mm²',
  // Ukrainian noun agreement with a count for "вимірювання" (neuter): 1 and 2-4 share the form
  // "вимірювання", 5+ and 11-14 take "вимірювань". A display footnote, not a reason for an i18n
  // library (X-3).
  measurementsCount(n: number): string {
    const lastTwo = n % 100;
    const lastOne = n % 10;
    if (lastOne >= 1 && lastOne <= 4 && (lastTwo < 11 || lastTwo > 14)) {
      return `${n} вимірювання`;
    }
    return `${n} вимірювань`;
  },
} as const;
