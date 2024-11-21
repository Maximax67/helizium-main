import { buildMessage, ValidateBy, ValidationOptions } from 'class-validator';

export const IS_BIGINT = 'isBigInt';

export function isBigInt(value: number | string): boolean {
  return (
    typeof value === 'bigint' ||
    ((typeof value === 'string' || typeof value === 'number') &&
      /^-?[0-9]+n?$/.test(`${value}`))
  );
}

export function IsBigInt(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: IS_BIGINT,
      validator: {
        validate: (value, _args): boolean => isBigInt(value),
        defaultMessage: buildMessage(
          (eachPrefix) =>
            eachPrefix + '$property must be an BigInt number or BigInt string',
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
