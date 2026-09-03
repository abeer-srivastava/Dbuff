import { ConfigService } from "@nestjs/config";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

export const FIREBASE_AUTH = Symbol("FIREBASE_AUTH");

export const firebaseAuthProvider = {
  provide: FIREBASE_AUTH,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Auth | null => {
    const projectId = config.get<string>("FIREBASE_PROJECT_ID");
    const clientEmail = config.get<string>("FIREBASE_CLIENT_EMAIL");
    const privateKey = config.get<string>("FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
    if (!projectId || !clientEmail || !privateKey) return null;
    const app = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    return getAuth(app);
  },
};
