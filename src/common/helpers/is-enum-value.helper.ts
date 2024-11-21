export function isEnumValue<T extends { [key: string]: any }>(
  enumObject: T,
  value: any,
): value is T[keyof T] {
  return Object.values(enumObject).includes(value);
}
