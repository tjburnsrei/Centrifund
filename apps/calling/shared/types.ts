export const outcomes = {
    interested: 'Interested', callback: 'Call back', voicemail: 'Left voicemail',
    no_answer: 'No answer', not_interested: 'Not interested', bad_number: 'Bad number', do_not_call: 'Do not call'
} as const;
export type Outcome = keyof typeof outcomes;
export type Fields = {
    summary: string;
    outcome: Outcome | '';
    nextAction: string;
    followUpDate: string;
};
export type Phone = {
    id: string;
    value: string;
    is_bad: boolean;
};
export type Contact = {
    id: string;
    name: string;
    company: string;
    city: string;
    county: string;
    email: string;
    background: {
        loans12?: number | string;
        size?: number | string;
        lender?: string;
        since?: string;
        projects?: unknown[];
    };
    phones: Phone[];
    do_not_call: boolean;
    last_called_at: string | null;
    outcome: string | null;
    next_action: string | null;
    follow_up_date: string | null;
    revision: number;
    history?: {
        id: string;
        created_at: string;
        author: string;
        summary: string;
        outcome: Outcome;
        next_action: string;
        follow_up_date: string | null;
    }[];
    shared?: boolean;
    private_notes?: {
        workspace_id: string;
        body: string;
    }[];
};
export type Draft = {
    id: string;
    contact_id: string;
    revision: number;
    raw_text: string;
    transcript: string;
    fields: Fields;
    status: 'editing' | 'processing' | 'ready' | 'failed' | 'saved' | 'discarded';
    audio_path: string | null;
    phone_id: string | null;
    saved_activity_id: string | null;
    error_code: string | null;
};
export type LocalDraft = {
    id: string;
    contactId: string;
    revision: number;
    rawText: string;
    fields: Fields;
    phoneId: string | null;
    dirty: boolean;
    mutationId: string;
    completeFollowUp: boolean;
    updatedAt: number;
    transcript?: string;
    audio?: Blob;
    audioUploaded?: boolean;
    serverSaved?: boolean;
};
export const emptyFields = (): Fields => ({ summary: '', outcome: '', nextAction: '', followUpDate: '' });
