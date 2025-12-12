import { ResumeResultItem } from '../types';
import {
    getResumeResults,
    deleteResumeResult,
    getCompletedSessionsForResume,
    CompletedSession,
    GeneratedResumeItem,
    getGeneratedResumes,
    deleteGeneratedResume,
    getGeneratedResume
} from '@/lib/api/resume';

// ============================================================================
// 类型定义
// ============================================================================

export interface ResumeState {
    resumeResults: ResumeResultItem[];
    currentResumeResult: ResumeResultItem | null;
    resumeResultLoading: boolean;
    // 已完成会话列表（用于简历工具选择）
    completedSessions: CompletedSession[];
    completedSessionsLoading: boolean;
    completedSessionsLastFetched: number;

    // 生成的简历
    generatedResumes: GeneratedResumeItem[];
    currentGeneratedResume: GeneratedResumeItem | null;
    generatedResumesLoading: boolean;
}

export interface ResumeActions {
    fetchResumeResults: (resultType?: 'analyze' | 'optimize') => Promise<void>;
    selectResumeResult: (resultId: number) => void;
    deleteResumeResult: (resultId: number) => Promise<boolean>;
    clearResumeResult: () => void;
    fetchCompletedSessions: (force?: boolean) => Promise<void>;

    // 生成简历 Actions
    fetchGeneratedResumes: () => Promise<void>;
    selectGeneratedResume: (resumeId: number) => Promise<void>;
    deleteGeneratedResume: (resumeId: number) => Promise<boolean>;
}

export type ResumeSlice = ResumeState & ResumeActions;

// ============================================================================
// Slice 工厂函数
// ============================================================================

type SetState = (partial: Partial<ResumeSlice> | ((state: ResumeSlice) => Partial<ResumeSlice>)) => void;
type GetState = () => ResumeSlice;

export const createResumeSlice = (set: SetState, get: GetState): ResumeSlice => ({
    // ===== 初始状态 =====
    resumeResults: [],
    currentResumeResult: null,
    resumeResultLoading: false,
    completedSessions: [],
    completedSessionsLoading: false,
    completedSessionsLastFetched: 0,

    generatedResumes: [],
    currentGeneratedResume: null,
    generatedResumesLoading: false,

    // ===== Actions =====
    fetchResumeResults: async (resultType) => {
        set({ resumeResultLoading: true });
        try {
            const response = await getResumeResults(resultType);
            if (response.success) {
                // 确保类型转换
                const results = response.results.map(r => ({
                    ...r,
                    result_data: r.result_data as any
                })) as ResumeResultItem[];
                set({ resumeResults: results });
            }
        } catch (error) {
            console.error('获取简历历史记录失败:', error);
        } finally {
            set({ resumeResultLoading: false });
        }
    },

    selectResumeResult: (resultId: number) => {
        const { resumeResults } = get();
        const result = resumeResults.find(r => r.id === resultId);
        if (result) {
            set({ currentResumeResult: result });
        }
    },

    deleteResumeResult: async (resultId: number) => {
        try {
            const success = await deleteResumeResult(resultId);
            if (success) {
                const { resumeResults, currentResumeResult } = get();
                set({
                    resumeResults: resumeResults.filter(r => r.id !== resultId),
                    currentResumeResult: currentResumeResult?.id === resultId ? null : currentResumeResult
                });
                return true;
            }
            return false;
        } catch (error) {
            console.error('删除简历记录失败:', error);
            return false;
        }
    },

    clearResumeResult: () => {
        set({ currentResumeResult: null });
    },

    fetchCompletedSessions: async (force = false) => {
        const { completedSessions, completedSessionsLastFetched, completedSessionsLoading } = get();
        const now = Date.now();
        const CACHE_DURATION = 60 * 1000; // 缓存 1 分钟

        // 如果已经在加载中，直接返回
        if (completedSessionsLoading) return;

        // 如果不是强制刷新，且有数据，且在缓存有效期内，直接返回
        if (!force && completedSessions.length > 0 && (now - completedSessionsLastFetched < CACHE_DURATION)) {
            return;
        }

        set({ completedSessionsLoading: true });
        try {
            const sessions = await getCompletedSessionsForResume();
            set({
                completedSessions: sessions,
                completedSessionsLastFetched: Date.now()
            });
        } catch (error) {
            console.error('获取已完成会话列表失败:', error);
        } finally {
            set({ completedSessionsLoading: false });
        }
    },

    fetchGeneratedResumes: async () => {
        set({ generatedResumesLoading: true });
        try {
            const resumes = await getGeneratedResumes();
            set({ generatedResumes: resumes });
        } catch (error) {
            console.error('获取生成简历列表失败:', error);
        } finally {
            set({ generatedResumesLoading: false });
        }
    },

    selectGeneratedResume: async (resumeId: number) => {
        // 先检查本地列表
        const { generatedResumes } = get();
        let resume = generatedResumes.find(r => r.id === resumeId);

        // 如果没有内容（列表项可能不含 content），则获取详情
        if (resume && !resume.content) {
            const detail = await getGeneratedResume(resumeId);
            if (detail) {
                resume = detail;
                // 更新列表中的项目（可选）
            }
        } else if (!resume) {
            const detail = await getGeneratedResume(resumeId);
            if (detail) resume = detail;
        }

        if (resume) {
            set({ currentGeneratedResume: resume });
        }
    },

    deleteGeneratedResume: async (resumeId: number) => {
        try {
            const success = await deleteGeneratedResume(resumeId);
            if (success) {
                const { generatedResumes, currentGeneratedResume } = get();
                set({
                    generatedResumes: generatedResumes.filter(r => r.id !== resumeId),
                    currentGeneratedResume: currentGeneratedResume?.id === resumeId ? null : currentGeneratedResume
                });
                return true;
            }
            return false;
        } catch (error) {
            console.error('删除生成简历失败:', error);
            return false;
        }
    }
});
