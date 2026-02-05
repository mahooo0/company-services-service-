import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ACCOUNT_TYPE_KEY,
  AccountType,
} from '@/common/decorators/permission.decorator';

export const PERMISSIONS_KEY = 'permissions';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredAccountType =
      this.reflector.getAllAndOverride<AccountType>(ACCOUNT_TYPE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || 'ALL';

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const isAdmin = request.headers['x-is-admin'] === 'true';
    const permissionsString = request.headers['x-permissions'] as string;
    const accountType = request.headers['x-account-type'] as AccountType;

    if (requiredAccountType !== 'ALL' && accountType !== requiredAccountType) {
      throw new ForbiddenException(`No permissions`);
    }

    if (isAdmin) {
      return true;
    }

    if (requiredPermissions.includes('ADMIN')) {
      throw new ForbiddenException('No permissions');
    }

    if (!permissionsString) {
      throw new ForbiddenException('No permissions');
    }

    try {
      const permissions = JSON.parse(permissionsString);

      if (typeof permissions !== 'object' || permissions === null) {
        throw new ForbiddenException('Invalid permissions format');
      }

      const hasRequiredPermission = requiredPermissions.some(
        requiredPermission => {
          const [category, permission] = requiredPermission.split('.');

          if (!permissions[category] || !Array.isArray(permissions[category])) {
            return false;
          }

          return permissions[category].includes(permission);
        },
      );

      if (hasRequiredPermission) {
        return true;
      }
    } catch (error) {
      console.error(error);
      throw new ForbiddenException('Invalid permissions format');
    }

    throw new ForbiddenException('Insufficient permissions');
  }
}
