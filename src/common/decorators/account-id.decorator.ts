import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

export const AccountId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const accountId = request.headers['x-account-id'] as string;

    if (!accountId) {
      throw new BadRequestException('Account id is required');
    }

    return accountId;
  },
);
