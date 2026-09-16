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
} as const;
