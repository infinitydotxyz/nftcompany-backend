import { registerDecorator, ValidationOptions } from 'class-validator';
import { usernameRegex } from './profile.constants';

export function IsUsername(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isUsername',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: string) {
          if (typeof value !== 'string') {
            return false;
          }
          const isValid = usernameRegex.test(value);
          return isValid;
        }
      }
    });
  };
}
