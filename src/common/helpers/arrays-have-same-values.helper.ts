export function arraysHaveSameValues<T>(
  array1: Array<T>,
  array2: Array<T>,
): boolean {
  if (array1 === array2) return true;
  if (array1.length !== array2.length) return false;

  return array1.every((el) => array2.includes(el));
}
