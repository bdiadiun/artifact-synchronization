// OHIF's webpack replaces this exact expression with the contents of platform/app/version.txt at
// build time (.webpack/webpack.base.js:32,46); `process` itself never exists in the browser, so the
// expression is written the way DefinePlugin matches it and nowhere else.
declare const process: { env: { VERSION_NUMBER?: string } };

export const readViewerVersion = (): string | undefined => process.env.VERSION_NUMBER;
