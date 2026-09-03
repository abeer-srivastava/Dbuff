import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { FirebaseAuthGuard } from "./firebase-auth.guard.js";
import { firebaseAuthProvider } from "./firebase-admin.provider.js";

@Global()
@Module({ providers: [firebaseAuthProvider, { provide: APP_GUARD, useClass: FirebaseAuthGuard }] })
export class AuthModule {}
