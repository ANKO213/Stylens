"use server";

import { createClient } from "@/utils/supabase/server";
import { PutObjectCommand, GetObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { r2, R2_BUCKET_NAME } from "@/lib/r2";

export type BodyType = 'rectangle' | 'inverted_triangle' | 'hourglass' | 'pear' | 'apple';

export interface AvatarMetadata {
    id: string;
    name: string;
    gender: 'male' | 'female';
    age: number;
    heightCm: number; // e.g. 170
    weightKg: number; // e.g. 60
    bodyType: BodyType;
    skinColor: string;
    imageKeys: {
        main: string;
        side1?: string;
        side2?: string;
    };
    createdAt: number;
    isMain?: boolean;
}

const INDEX_FILE = "index.json";

// Helper to get R2 object as string
async function getR2Object(key: string): Promise<string | null> {
    try {
        const command = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
        });
        const response = await r2.send(command);
        if (!response.Body) return null;
        return await response.Body.transformToString();
    } catch (e: any) {
        if (e.name === 'NoSuchKey') return null;
        console.error(`Error reading ${key}:`, e);
        return null;
    }
}

// Helper to save string to R2
async function saveR2Object(key: string, data: string) {
    const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: data,
        ContentType: "application/json",
    });
    await r2.send(command);
}

export async function getAvatars() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return { error: "Unauthorized" };

    const indexKey = `avatars/${user.email}/${INDEX_FILE}`;
    const data = await getR2Object(indexKey);

    if (!data) return { avatars: [] };

    try {
        const avatars = JSON.parse(data) as AvatarMetadata[];
        // Sort by createdAt desc
        return { avatars: avatars.sort((a, b) => b.createdAt - a.createdAt) };
    } catch (e) {
        console.error("Failed to parse avatar index", e);
        return { avatars: [] };
    }
}

export async function saveAvatar(avatar: AvatarMetadata) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return { error: "Unauthorized" };

    const indexKey = `avatars/${user.email}/${INDEX_FILE}`;

    // 1. Get existing
    let avatars: AvatarMetadata[] = [];
    const existingData = await getR2Object(indexKey);
    if (existingData) {
        try {
            avatars = JSON.parse(existingData);
        } catch (e) { /* ignore corrupt index */ }
    }

    // 2. Add or Update
    const existingIndex = avatars.findIndex(a => a.id === avatar.id);
    if (existingIndex >= 0) {
        avatars[existingIndex] = avatar;
    } else {
        avatars.push(avatar);
    }

    // Handle isMain logic - if new avatar is main, unset others
    if (avatar.isMain) {
        avatars.forEach(a => {
            if (a.id !== avatar.id) a.isMain = false;
        });
    }

    // 3. Save Index
    await saveR2Object(indexKey, JSON.stringify(avatars));

    // 4. Save individual metadata file for backup/redundancy
    const metaKey = `avatars/${user.email}/${avatar.id}/meta.json`;
    await saveR2Object(metaKey, JSON.stringify(avatar));

    return { success: true, avatar };
}

export async function deleteAvatar(avatarId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return { error: "Unauthorized" };

    const indexKey = `avatars/${user.email}/${INDEX_FILE}`;

    // 1. Update Index
    const existingData = await getR2Object(indexKey);
    if (!existingData) return { success: true }; // Already empty

    let avatars: AvatarMetadata[] = [];
    try {
        avatars = JSON.parse(existingData);
    } catch (e) { }

    const targetAvatar = avatars.find(a => a.id === avatarId);
    avatars = avatars.filter(a => a.id !== avatarId);

    await saveR2Object(indexKey, JSON.stringify(avatars));

    // 2. Delete actual files in R2 (Optional but good for cleanup)
    // We need to list objects in the folder and delete them
    try {
        const prefix = `avatars/${user.email}/${avatarId}/`;
        const listCmd = new ListObjectsV2Command({
            Bucket: R2_BUCKET_NAME,
            Prefix: prefix
        });
        const listRes = await r2.send(listCmd);

        if (listRes.Contents && listRes.Contents.length > 0) {
            const objectsToDelete = listRes.Contents.map(obj => ({ Key: obj.Key }));
            const deleteCmd = new DeleteObjectsCommand({
                Bucket: R2_BUCKET_NAME,
                Delete: { Objects: objectsToDelete }
            });
            await r2.send(deleteCmd);
        }
    } catch (e) {
        console.error("Failed to cleanup files for avatar", avatarId, e);
    }

    return { success: true };
}

export async function setMainAvatar(avatarId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return { error: "Unauthorized" };

    const indexKey = `avatars/${user.email}/${INDEX_FILE}`;
    const data = await getR2Object(indexKey);
    if (!data) return { error: "No avatars found" };

    let avatars: AvatarMetadata[] = JSON.parse(data);

    avatars = avatars.map(a => ({
        ...a,
        isMain: a.id === avatarId
    }));

    await saveR2Object(indexKey, JSON.stringify(avatars));
    return { success: true };
}
