export const startCase = (value: string): string =>
  value
    .replaceAll(/[_-]+/g, ' ')
    .replaceAll(/([a-z\d])([A-Z])/g, '$1 $2')
    .trim()
    .replaceAll(/\s+/g, ' ')
    .replaceAll(/\b\w/g, (char) => char.toUpperCase());
