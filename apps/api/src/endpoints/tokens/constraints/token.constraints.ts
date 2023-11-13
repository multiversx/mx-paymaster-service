import { TokenUtils } from "@multiversx/sdk-nestjs-common";
import { ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface, registerDecorator } from "class-validator";

@ValidatorConstraint({ async: false })
export class IsTokenIdentifierConstraint implements ValidatorConstraintInterface {
  validate(tokenIdentifier: any): boolean {
    return TokenUtils.isToken(tokenIdentifier);
  }
}

export function IsTokenIdentifier(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsTokenIdentifierConstraint,
    });
  };
}
