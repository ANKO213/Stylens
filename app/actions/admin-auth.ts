"use server";

import { cookies } from "next/headers";

const ADMIN_PASSWORD = "aA90974344"; // Simple shared secret
const COOKIE_NAME = "stylens_admin_access";

export async function verifyAdminPassword(password: string) {
    if (password === ADMIN_PASSWORD) {
        (await cookies()).set(COOKIE_NAME, "true", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 7, // 1 week
            path: "/",
        });
        return { success: true };
    }
    return { success: false, error: "Invalid password" };
}

export async function checkAdminAccess() {
    const cookieStore = await cookies();
    const hasAccess = cookieStore.get(COOKIE_NAME)?.value === "true";
    return hasAccess;
}
