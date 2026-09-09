import { UserProfile } from "../user/user.types";

export interface SignupPayload {
    name: string;
    email: string;
    password: string;
    plan_id?: number | undefined;
    user_meta?: Record<string, unknown> | undefined;
}

export interface LoginPayload {
    email: string;
    password: string;
}

export interface ChangePasswordPayload {
    old_password: string;
    new_password: string;
}

export interface AuthResponse {
    token: string;
    user: UserProfile;
}
