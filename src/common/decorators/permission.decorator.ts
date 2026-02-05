import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import {
  PermissionGuard,
  PERMISSIONS_KEY,
} from '@/common/guards/permission.guard';

export const ACCOUNT_TYPE_KEY = 'accountType';

export type AccountType = 'ALL' | 'COMPANY' | 'USER';

// export const Permissions = (...permissions: string[]) => {
//     return applyDecorators(
//         SetMetadata(PERMISSIONS_KEY, permissions),
//         UseGuards(PermissionGuard)
//     );
//
// }

export const Permissions = (
  permissions: string[],
  accountType: AccountType = 'ALL',
) => {
  return applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    SetMetadata(ACCOUNT_TYPE_KEY, accountType),
    UseGuards(PermissionGuard),
  );
};
