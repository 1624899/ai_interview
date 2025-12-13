/**
 * 简历工具 API 接口
 */

import { apiRequest, API_BASE_URL, getUserId } from './config';

// ============================================================================
// 类型定义
// ============================================================================

export interface DimensionScore {
    score: number;
    comment: string;
}

export interface ResumeAnalyzeResult {
    overall_score: number;
    dimension_scores: Record<string, DimensionScore>;
    strengths: string[];
    weaknesses: string[];
    priority_improvements: string[];
    interview_insights?: string;
}

export interface OptimizedSection {
    section_name: string;
    original_issues?: string[];
    optimized_content?: string;
}

export interface KeyImprovement {
    priority: number;
    area: string;
    issue: string;
    action: string;
    example?: string;
}

export interface ResumeOptimizeResult {
    match_score: number;
    hr_pass_rate: number;
    optimized_sections: OptimizedSection[];
    key_improvements: KeyImprovement[];
    keyword_analysis?: {
        jd_keywords: string[];
        matched: string[];
        missing: string[];
        bonus: string[];
    };
    hr_feedback?: {
        first_impression: { score: number; comment: string };
        highlights: string[];
        concerns: string[];
    };
    interview_insights?: string;
    reflection_notes?: {
        additional_suggestions: string[];
        risk_warnings: string[];
        quality_score: number;
    };
}

export interface CompletedSession {
    session_id: string;
    title: string;
    updated_at: string;
    round_index: number;
    round_type: string;
    message_count: number;
}

export interface ApiConfig {
    smart: {
        api_key: string;
        base_url: string;
        model: string;
    };
    fast: {
        api_key: string;
        base_url: string;
        model: string;
    };
}

export interface GeneratedResumeItem {
    id: number;
    title: string;
    job_description?: string;
    created_at: string;
    content?: string; // 详情时返回
}

export interface ResumeGenerateInitResponse {
    success: boolean;
    session_id: string;
    needs_input: boolean;
    questions?: string[];
    result?: {
        resume_id: number;
        title: string;
        content: string;
    };
    message?: string;
}

export interface ResumeGenerateSubmitResponse {
    success: boolean;
    resume_id?: number;
    title?: string;
    content?: string;
    message?: string;
}

export interface GenerationSessionStatus {
    session_id: string;
    status: string;
    questions: string[];
    user_answers: Record<string, string>;
    final_markdown?: string;
}

// ============================================================================
// API 函数
// ============================================================================

/**
 * 获取可用于简历工具的已完成会话列表
 */
export async function getCompletedSessionsForResume(limit: number = 10): Promise<CompletedSession[]> {
    try {
        const response = await apiRequest<{
            success: boolean;
            sessions: CompletedSession[];
            message?: string;
        }>(`/api/resume/sessions?limit=${limit}`);

        if (response.success) {
            return response.sessions;
        }
        return [];
    } catch (error) {
        console.error('获取已完成会话列表失败:', error);
        return [];
    }
}

/**
 * 简历竞争力分析
 */
export async function analyzeResume(params: {
    resume_content: string;
    job_description?: string;
    session_ids?: string[];
    api_config: ApiConfig;
}): Promise<{
    success: boolean;
    result?: ResumeAnalyzeResult;
    result_id?: number;
    message?: string;
}> {
    try {
        return await apiRequest('/api/resume/analyze', {
            method: 'POST',
            body: JSON.stringify({
                resume_content: params.resume_content,
                job_description: params.job_description || null,
                session_ids: params.session_ids || [],
                api_config: params.api_config,
            }),
        });
    } catch (error) {
        console.error('简历分析失败:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : '分析失败',
        };
    }
}

/**
 * 简历内容优化
 */
export async function optimizeResume(params: {
    resume_content: string;
    job_description: string;
    session_ids?: string[];
    include_overall_profile?: boolean;
    api_config: ApiConfig;
}): Promise<{
    success: boolean;
    result?: ResumeOptimizeResult;
    result_id?: number;
    message?: string;
}> {
    try {
        return await apiRequest('/api/resume/optimize', {
            method: 'POST',
            body: JSON.stringify({
                resume_content: params.resume_content,
                job_description: params.job_description,
                session_ids: params.session_ids || [],
                include_overall_profile: params.include_overall_profile || false,
                api_config: params.api_config,
            }),
        });
    } catch (error) {
        console.error('简历优化失败:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : '优化失败',
        };
    }
}

/**
 * 获取历史结果列表
 */
export async function getResumeResults(resultType?: 'analyze' | 'optimize', limit: number = 20): Promise<{
    success: boolean;
    results: Array<{
        id: number;
        result_type: string;
        created_at: string;
        result_data: ResumeAnalyzeResult | ResumeOptimizeResult;
    }>;
}> {
    try {
        const params = new URLSearchParams({ limit: String(limit) });
        if (resultType) params.append('result_type', resultType);

        return await apiRequest(`/api/resume/results?${params}`);
    } catch (error) {
        console.error('获取历史结果失败:', error);
        return { success: false, results: [] };
    }
}

/**
 * 删除结果
 */
export async function deleteResumeResult(resultId: number): Promise<boolean> {
    try {
        const response = await apiRequest<{ success: boolean }>(`/api/resume/results/${resultId}`, {
            method: 'DELETE',
        });
        return response.success;
    } catch (error) {
        console.error('删除结果失败:', error);
        return false;
    }
}

// ============================================================================
// SSE 流式接口类型
// ============================================================================

export interface OptimizeProgressEvent {
    type: 'progress';
    stage: string;
    message: string;
    complete?: boolean;
}

export interface OptimizeResultEvent {
    type: 'result';
    data: ResumeOptimizeResult;
}

export interface OptimizeDoneEvent {
    type: 'done';
    content: string;
    result_id?: number;
}

export interface OptimizeErrorEvent {
    type: 'error';
    content: string;
}

export type OptimizeStreamEvent = OptimizeProgressEvent | OptimizeResultEvent | OptimizeDoneEvent | OptimizeErrorEvent;

/**
 * 简历内容优化 (SSE 流式)
 * 
 * @param params 优化参数
 * @param onProgress 进度回调
 * @returns 最终结果
 */
export async function optimizeResumeStreaming(
    params: {
        resume_content: string;
        job_description: string;
        session_ids?: string[];
        include_overall_profile?: boolean;
        api_config: ApiConfig;
    },
    onProgress?: (event: OptimizeProgressEvent) => void
): Promise<{
    success: boolean;
    result?: ResumeOptimizeResult;
    result_id?: number;
    message?: string;
}> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/resume/optimize/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': getUserId(),
            },
            body: JSON.stringify({
                resume_content: params.resume_content,
                job_description: params.job_description,
                session_ids: params.session_ids || [],
                include_overall_profile: params.include_overall_profile || false,
                api_config: params.api_config,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('无法读取响应流');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let finalResult: ResumeOptimizeResult | undefined;
        let resultId: number | undefined;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const event = JSON.parse(line.slice(6)) as OptimizeStreamEvent;

                        if (event.type === 'progress' && onProgress) {
                            onProgress(event);
                        } else if (event.type === 'result') {
                            finalResult = event.data;
                        } else if (event.type === 'done') {
                            resultId = event.result_id;
                        } else if (event.type === 'error') {
                            throw new Error(event.content);
                        }
                    } catch (e) {
                        // 解析错误，跳过
                    }
                }
            }
        }

        if (finalResult) {
            return { success: true, result: finalResult, result_id: resultId };
        } else {
            return { success: false, message: '未收到优化结果' };
        }

    } catch (error) {
        console.error('流式简历优化失败:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : '优化失败',
        };
    }
}

// ============================================================================
// 简历生成 API
// ============================================================================

/**
 * 初始化简历生成
 */
export async function initResumeGeneration(params: {
    resume_content: string;
    job_description: string;
    optimization_result: ResumeOptimizeResult;
    optimization_result_id?: number;
    template_style?: string;
    api_config: ApiConfig;
}): Promise<ResumeGenerateInitResponse> {
    try {
        return await apiRequest('/api/resume/generation/init', {
            method: 'POST',
            body: JSON.stringify({
                ...params,
                template_style: params.template_style || 'professional'
            }),
        });
    } catch (error) {
        console.error('初始化简历生成失败:', error);
        return {
            success: false,
            session_id: '',
            needs_input: false,
            message: error instanceof Error ? error.message : '初始化失败',
        };
    }
}

/**
 * 提交生成问答
 */
export async function submitGenerationAnswers(params: {
    session_id: string;
    answers: Record<string, string>;
    api_config: ApiConfig;
}): Promise<ResumeGenerateSubmitResponse> {
    try {
        return await apiRequest('/api/resume/generation/submit', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    } catch (error) {
        console.error('提交回答失败:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : '提交失败',
        };
    }
}

/**
 * 获取生成的简历列表
 */
export async function getGeneratedResumes(limit: number = 20): Promise<GeneratedResumeItem[]> {
    try {
        const response = await apiRequest<{
            success: boolean;
            resumes: GeneratedResumeItem[];
        }>(`/api/resume/generated?limit=${limit}`);

        if (response.success) {
            return response.resumes;
        }
        return [];
    } catch (error) {
        console.error('获取已生成简历列表失败:', error);
        return [];
    }
}

/**
 * 获取单个简历详情
 */
export async function getGeneratedResume(resumeId: number): Promise<GeneratedResumeItem | null> {
    try {
        const response = await apiRequest<{
            success: boolean;
            resume: GeneratedResumeItem;
        }>(`/api/resume/generated/${resumeId}`);

        if (response.success) {
            return response.resume;
        }
        return null;
    } catch (error) {
        console.error('获取简历详情失败:', error);
        return null;
    }
}


/**
 * 删除已生成的简历
 */
export async function deleteGeneratedResume(resumeId: number): Promise<boolean> {
    try {
        const response = await apiRequest<{ success: boolean }>(`/api/resume/generated/${resumeId}`, {
            method: 'DELETE',
        });
        return response.success;
    } catch (error) {
        console.error('删除简历失败:', error);
        return false;
    }
}

/**
 * 更新已生成的简历内容
 */
export async function updateGeneratedResume(resumeId: number, content: string, title?: string): Promise<boolean> {
    try {
        const response = await apiRequest<{ success: boolean }>(`/api/resume/generated/${resumeId}`, {
            method: 'PUT',
            body: JSON.stringify({ content, title }),
        });
        return response.success;
    } catch (error) {
        console.error('更新简历失败:', error);
        return false;
    }
}

