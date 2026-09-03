import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Auth } from "firebase-admin/auth";
import { FIREBASE_AUTH } from "./firebase-admin.provider.js";
import { IS_PUBLIC_KEY } from "./public.decorator.js";

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, @Inject(FIREBASE_AUTH) private readonly auth: Auth | null) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: unknown }>();
    const token = request.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
    if (!token || !this.auth) throw new UnauthorizedException("A valid Firebase Bearer token is required");
    try {
      request.user = await this.auth.verifyIdToken(token);
      return true;
    } catch { throw new UnauthorizedException("Invalid or expired Firebase token"); }
  }
}
