import { registerDecorator, ValidationOptions } from 'class-validator';

export function IsEnumArray<T extends object>(enumValue: T, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isEnumArray',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          const enumArray = Object.values(enumValue);

          if (!Array.isArray(value)) {
            return enumArray.includes(value);
          }

          for (const v of value) {
            if (!enumArray.includes(v)) {
              return false;
            }
          }

          return true;
        }
      }
    });
  };
}
