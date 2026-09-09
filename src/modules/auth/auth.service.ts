import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../../common/errors/app-error";
import {
    createUser,
    findUserByEmail,
    findUserById,
    getUserMetaByUserId,
    insertUserMeta,
    updateUserPassword,
} from "../user/user.repository";
import { getPlanById } from "../plans/plans.repository";
import { AuthResponse, ChangePasswordPayload, LoginPayload, SignupPayload } from "./auth.types";

const jwtExpiresIn = env.JWT_EXPIRES_IN as NonNullable<jwt.SignOptions["expiresIn"]>;

export async function signup(payload: SignupPayload): Promise<AuthResponse> {
    console.log("[auth.signup] Signup service started", {
        email: payload.email,
        plan_id: payload.plan_id ?? null,
    });

    const existingUser = await findUserByEmail(payload.email);

    if (existingUser) {
        throw new AppError("User with this email already exists", 409);
    }

    const hashedPassword = await bcrypt.hash(payload.password, 10);

    if (payload.plan_id !== undefined) {
        const plan = await getPlanById(payload.plan_id);

        console.log("[auth.signup] Plan lookup result", {
            requested_plan_id: payload.plan_id,
            found: Boolean(plan),
        });

        if (!plan) {
            throw new AppError("Plan not found", 404);
        }
    }

    const user = await createUser({
        name: payload.name,
        email: payload.email,
        password: hashedPassword,
        plan_id: payload.plan_id ?? null,
    });

    console.log("[auth.signup] User created", {
        user_id: user.id,
        email: user.email,
        saved_plan_id: user.plan_id,
    });

    const userMeta = payload.user_meta ?? {};
    await insertUserMeta(user.id, userMeta);

    const token = jwt.sign({ sub: user.id, email: user.email, is_admin: user.is_admin }, env.JWT_SECRET, {
        expiresIn: jwtExpiresIn,
    });

    return {
        token,
        user: {
            ...user,
            user_meta: userMeta,
        },
    };
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
    const user = await findUserByEmail(payload.email);

    if (!user) {
        throw new AppError("Invalid email or password", 401);
    }

    const isMatch = await bcrypt.compare(payload.password, user.password);

    if (!isMatch) {
        throw new AppError("Invalid email or password", 401);
    }

    const token = jwt.sign({ sub: user.id, email: user.email, is_admin: user.is_admin }, env.JWT_SECRET, {
        expiresIn: jwtExpiresIn,
    });

    const userMeta = await getUserMetaByUserId(user.id);

    return {
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            plan_id: user.plan_id,
            is_admin: user.is_admin,
            user_meta: userMeta,
            created_at: user.created_at,
            updated_at: user.updated_at,
        },
    };
}

export async function changePassword(userId: number, payload: ChangePasswordPayload): Promise<void> {
    const user = await findUserById(userId);

    if (!user) {
        throw new AppError("User not found", 404);
    }

    const isOldPasswordValid = await bcrypt.compare(payload.old_password, user.password);

    if (!isOldPasswordValid) {
        throw new AppError("Old password is incorrect", 401);
    }

    const isSamePassword = await bcrypt.compare(payload.new_password, user.password);

    if (isSamePassword) {
        throw new AppError("New password must be different from old password", 422);
    }

    const hashedNewPassword = await bcrypt.hash(payload.new_password, 10);
    await updateUserPassword(userId, hashedNewPassword);
}
