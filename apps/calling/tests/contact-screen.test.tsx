// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContactScreen } from '../src/ContactScreen';
import type { Contact } from '../shared/types';
import { action } from '../src/api';
import { localDelete, localPut, localGet } from '../src/local';
vi.mock('../src/api', () => ({ action: vi.fn(), api: vi.fn() }));
vi.mock('../src/local', () => ({ localGet: vi.fn(async () => undefined), localPut: vi.fn(async () => { }), localDelete: vi.fn(async () => { }) }));
const contact: Contact = { id: '11111111-1111-4111-8111-111111111111', name: 'Casey Example', company: 'Example Homes', city: 'Richmond', county: '', email: 'casey@example.invalid', background: { loans12: 3 }, phones: [{ id: '22222222-2222-4222-8222-222222222222', value: '202-555-0141', is_bad: false }], do_not_call: false, last_called_at: null, outcome: null, next_action: null, follow_up_date: null, revision: 1, history: [] };
beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(localGet).mockResolvedValue(undefined);
    const drafts = new Map<string, any>();
    vi.mocked(action).mockImplementation(async (name, args: any = {}) => {
        if (name === 'draft.ensure') {
            if (!drafts.has(args.id))
                drafts.set(args.id, { id: args.id, contact_id: args.contactId, revision: 1, status: 'editing', raw_text: '', transcript: '', phone_id: null, fields: { summary: '', outcome: '', nextAction: '', followUpDate: '' } });
            return drafts.get(args.id);
        }
        if (name === 'draft.update') {
            const d = { ...drafts.get(args.id), revision: args.revision + 1, raw_text: args.rawText, fields: args.fields, phone_id: args.phoneId };
            drafts.set(args.id, d);
            return d;
        }
        if (name === 'draft.save') {
            drafts.set(args.id, { ...drafts.get(args.id), status: 'saved' });
            return { activityId: 'saved' };
        }
        return {};
    });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('caller workflow', () => {
    it('persists a selected follow-up date immediately', async () => {
        render(<ContactScreen contact={contact} role="caller" onSaved={vi.fn()} onRecording={vi.fn()}/>);
        const date = await screen.findByLabelText('Follow-up date');
        fireEvent.input(date, { target: { value: '2026-10-01' } });
        await waitFor(() => expect(localPut).toHaveBeenLastCalledWith('caller:' + contact.id, expect.objectContaining({ fields: expect.objectContaining({ followUpDate: '2026-10-01' }) })));
    });
    it('offers typing when the microphone is denied', async () => {
        vi.stubGlobal('MediaRecorder', class {
        });
        const getUserMedia = vi.fn(async () => { throw new Error('NotAllowedError'); });
        vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia } });
        render(<ContactScreen contact={contact} role="caller" onSaved={vi.fn()} onRecording={vi.fn()}/>);
        await screen.findByLabelText('What happened?');
        fireEvent.click(screen.getByRole('button', { name: '● Record notes' }));
        expect(await screen.findByText(/Microphone access was not available/)).toBeTruthy();
        expect((screen.getByLabelText('What happened?') as HTMLTextAreaElement).disabled).toBe(false);
    });
    it('keeps manual editing available if local draft storage fails', async () => {
        vi.mocked(localGet).mockRejectedValueOnce(new Error('Storage unavailable'));
        render(<ContactScreen contact={contact} role="caller" onSaved={vi.fn()} onRecording={vi.fn()}/>);
        expect(await screen.findByLabelText('What happened?')).toBeTruthy();
        expect(screen.getByText(/This phone cannot recover drafts/)).toBeTruthy();
    });
    it('does not move unfinished text to a newly selected contact', async () => {
        const saved = vi.fn(async () => { }), recording = vi.fn();
        const { rerender } = render(<ContactScreen key={contact.id} contact={contact} role="caller" onSaved={saved} onRecording={recording}/>);
        fireEvent.change(await screen.findByLabelText('What happened?'), { target: { value: 'Only for Casey' } });
        const second = { ...contact, id: '33333333-3333-4333-8333-333333333333', name: 'Another Example' };
        rerender(<ContactScreen key={second.id} contact={second} role="caller" onSaved={saved} onRecording={recording}/>);
        await waitFor(() => expect((screen.getByLabelText('What happened?') as HTMLTextAreaElement).value).toBe(''));
        expect(localPut).toHaveBeenCalledWith('caller:' + contact.id, expect.objectContaining({ contactId: contact.id, rawText: 'Only for Casey' }));
    });
    it('offers a direct authenticated vCard and native phone link', async () => {
        render(<ContactScreen contact={contact} role="caller" onSaved={vi.fn()} onRecording={vi.fn()}/>);
        expect(screen.getByRole('link', { name: '＋ Save to iPhone' }).getAttribute('href')).toBe('/api/contacts/' + contact.id + '/contact.vcf');
        await waitFor(() => expect(screen.getByRole('link', { name: 'Call Casey Example' }).getAttribute('href')).toBe('tel:2025550141'));
    });
    it('saves a typed note against the displayed contact and advances only after confirmation', async () => {
        const user = userEvent.setup(), saved = vi.fn(async () => { });
        render(<ContactScreen contact={contact} role="caller" onSaved={saved} onRecording={vi.fn()}/>);
        const notes = await screen.findByLabelText('What happened?');
        await user.type(notes, 'Wants to discuss financing next week.');
        await user.click(screen.getByRole('button', { name: 'Interested' }));
        await user.dblClick(screen.getByRole('button', { name: 'Save & next →' }));
        await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
        const ensure = vi.mocked(action).mock.calls.find(c => c[0] === 'draft.ensure');
        expect(ensure?.[1]).toMatchObject({ contactId: contact.id });
        expect(vi.mocked(action).mock.calls.filter(c => c[0] === 'draft.save')).toHaveLength(1);
        expect(localDelete).toHaveBeenCalledWith('caller:' + contact.id);
    });
    it('recovers a lost save acknowledgement without adding a second call', async () => {
        const implementation = vi.mocked(action).getMockImplementation()!;
        vi.mocked(action).mockImplementation(async (name, args) => { const result = await implementation(name, args); if (name === 'draft.save')
            throw new Error('Acknowledgement lost'); return result; });
        const user = userEvent.setup(), saved = vi.fn(async () => { });
        render(<ContactScreen contact={contact} role="caller" onSaved={saved} onRecording={vi.fn()}/>);
        await screen.findByLabelText('What happened?');
        await user.click(screen.getByRole('button', { name: 'No answer' }));
        await user.click(screen.getByRole('button', { name: 'Save & next →' }));
        await screen.findByText('Acknowledgement lost');
        await user.click(screen.getByRole('button', { name: 'Save & next →' }));
        await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
        expect(vi.mocked(action).mock.calls.filter(c => c[0] === 'draft.save')).toHaveLength(1);
    });
    it('keeps the local draft when the server cannot confirm saving', async () => {
        const implementation = vi.mocked(action).getMockImplementation()!;
        vi.mocked(action).mockImplementation(async (name, args) => { if (name === 'draft.save')
            throw new Error('Connection lost'); return implementation(name, args); });
        const user = userEvent.setup(), saved = vi.fn(async () => { });
        render(<ContactScreen contact={contact} role="caller" onSaved={saved} onRecording={vi.fn()}/>);
        await screen.findByLabelText('What happened?');
        await user.click(screen.getByRole('button', { name: 'No answer' }));
        await user.click(screen.getByRole('button', { name: 'Save & next →' }));
        await screen.findByText('Connection lost');
        expect(saved).not.toHaveBeenCalled();
        expect(localDelete).not.toHaveBeenCalled();
        expect(localPut).toHaveBeenCalled();
    });
});
