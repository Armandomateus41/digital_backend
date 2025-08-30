import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Array<'admin' | 'user'>) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Array<'admin' | 'user'>>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;
    const req = context.switchToHttp().getRequest() as any;
    const user = req.user as { role?: string } | undefined;
    if (!user || !user.role) return false;
    const userRole = String(user.role).toLowerCase() as 'admin' | 'user';
    const normalizedRequired = requiredRoles.map((r) => r.toLowerCase()) as Array<'admin' | 'user'>;
    return normalizedRequired.includes(userRole);
  }
}
