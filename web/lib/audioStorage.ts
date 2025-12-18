/**
 * 语音面试音频本地存储服务
 * 使用 IndexedDB 在浏览器端存储音频文件
 */

const DB_NAME = 'voice_interview_audio';
const DB_VERSION = 1;
const STORE_NAME = 'audio_blobs';

let db: IDBDatabase | null = null;

/**
 * 初始化 IndexedDB
 */
async function initDB(): Promise<IDBDatabase> {
    if (db) return db;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[AudioStorage] IndexedDB 打开失败:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;

            // 创建 object store
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('sessionId', 'sessionId', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                console.log('[AudioStorage] IndexedDB store 已创建');
            }
        };
    });
}

export interface AudioRecord {
    id: string;           // 唯一 ID (sessionId + timestamp)
    sessionId: string;    // 会话 ID
    timestamp: number;    // 时间戳
    blob: Blob;           // 音频 Blob
    mimeType: string;     // MIME 类型
}

/**
 * 保存音频到 IndexedDB
 * @param sessionId 会话 ID
 * @param blob 音频 Blob
 * @returns 音频记录 ID
 */
export async function saveAudioLocally(sessionId: string, blob: Blob): Promise<string> {
    const database = await initDB();
    const timestamp = Date.now();
    const id = `${sessionId}_${timestamp}`;

    const record: AudioRecord = {
        id,
        sessionId,
        timestamp,
        blob,
        mimeType: blob.type || 'audio/wav'
    };

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(record);

        request.onsuccess = () => {
            console.log(`[AudioStorage] 音频已保存: ${id}`);
            resolve(id);
        };

        request.onerror = () => {
            console.error('[AudioStorage] 保存音频失败:', request.error);
            reject(request.error);
        };
    });
}

/**
 * 根据 ID 获取音频
 * @param id 音频记录 ID
 * @returns 音频记录 或 null
 */
export async function getAudioById(id: string): Promise<AudioRecord | null> {
    const database = await initDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
            resolve(request.result || null);
        };

        request.onerror = () => {
            console.error('[AudioStorage] 获取音频失败:', request.error);
            reject(request.error);
        };
    });
}

/**
 * 获取音频的播放 URL
 * 支持本地 IndexedDB ID 和远程服务器路径
 * @param id 音频记录 ID 或远程 URL
 * @returns 播放 URL 或 null
 */
export async function getAudioUrl(id: string): Promise<string | null> {
    if (!id) return null;

    // 如果 id 本身就是一个完整的 URL
    if (id.startsWith('http://') || id.startsWith('https://')) {
        return id;
    }

    // 如果 id 看起来像是一个后端静态资源路径 (例如 static/audio/...)
    if (id.includes('/')) {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        // 确保没有多余的斜杠
        const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const cleanId = id.startsWith('/') ? id : `/${id}`;
        return `${cleanBase}${cleanId}`;
    }

    // 否则尝试从本地 IndexedDB 获取
    const record = await getAudioById(id);
    if (!record) return null;

    return URL.createObjectURL(record.blob);
}

/**
 * 获取会话的所有音频
 * @param sessionId 会话 ID
 * @returns 音频记录列表
 */
export async function getAudiosBySession(sessionId: string): Promise<AudioRecord[]> {
    const database = await initDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('sessionId');
        const request = index.getAll(sessionId);

        request.onsuccess = () => {
            resolve(request.result || []);
        };

        request.onerror = () => {
            console.error('[AudioStorage] 获取会话音频失败:', request.error);
            reject(request.error);
        };
    });
}

/**
 * 删除单个音频
 * @param id 音频记录 ID
 */
export async function deleteAudio(id: string): Promise<void> {
    const database = await initDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
            console.log(`[AudioStorage] 音频已删除: ${id}`);
            resolve();
        };

        request.onerror = () => {
            console.error('[AudioStorage] 删除音频失败:', request.error);
            reject(request.error);
        };
    });
}

/**
 * 删除会话的所有音频
 * @param sessionId 会话 ID
 */
export async function deleteSessionAudios(sessionId: string): Promise<void> {
    const audios = await getAudiosBySession(sessionId);
    for (const audio of audios) {
        await deleteAudio(audio.id);
    }
    console.log(`[AudioStorage] 已删除会话 ${sessionId} 的 ${audios.length} 条音频`);
}

/**
 * 清理过期音频 (超过 7 天)
 */
export async function cleanupOldAudios(): Promise<void> {
    const database = await initDB();
    const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 天前

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('timestamp');
        const range = IDBKeyRange.upperBound(cutoffTime);
        const request = index.openCursor(range);

        let deletedCount = 0;

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                cursor.delete();
                deletedCount++;
                cursor.continue();
            } else {
                console.log(`[AudioStorage] 已清理 ${deletedCount} 条过期音频`);
                resolve();
            }
        };

        request.onerror = () => {
            console.error('[AudioStorage] 清理过期音频失败:', request.error);
            reject(request.error);
        };
    });
}

/**
 * 获取存储统计信息
 */
export async function getStorageStats(): Promise<{ count: number; totalSize: number }> {
    const database = await initDB();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const records = request.result as AudioRecord[];
            const count = records.length;
            const totalSize = records.reduce((sum, r) => sum + r.blob.size, 0);
            resolve({ count, totalSize });
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}
