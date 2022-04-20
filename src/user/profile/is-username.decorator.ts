import { registerDecorator, ValidationOptions } from 'class-validator';
import { ProfileService } from './profile.service';

export function IsUsername(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isUsername',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: string) {
          return ProfileService.isValidUsername(value);
        }
      }
    });
  };
}
