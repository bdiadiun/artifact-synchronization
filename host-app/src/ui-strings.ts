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
} as const;
