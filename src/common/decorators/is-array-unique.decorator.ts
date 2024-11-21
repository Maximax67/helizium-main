import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsArrayUnique implements ValidatorConstraintInterface {
  validate(array: any[] | undefined, _args: ValidationArguments) {
    if (!array) return true;

    const seenValues = new Set();
    for (const item of array) {
      if (seenValues.has(item)) {
        return false;
      }

      seenValues.add(item);
    }

    return true;
  }

  defaultMessage(_args: ValidationArguments) {
    return '$property should not contain duplicate values';
  }
}
