import { describe, it, expect } from 'vitest';
import { IAuthProvider, AuthSignInResult } from './authProvider';

class MockAuthProvider implements IAuthProvider {
    async signIn(): Promise<AuthSignInResult> {
        return {
            user: { email: 'test@example.com' },
            accessToken: 'token'
        };
    }

    async signOut(): Promise<void> {}

    onAuthStateChanged(callback: (user: any, token: any) => void) {
        callback({ email: 'test@example.com' }, 'token');
        return () => {};
    }
}

describe('IAuthProvider', () => {
    it('can be implemented and used', async () => {
        const provider = new MockAuthProvider();

        const result = await provider.signIn();
        expect(result.accessToken).toBe('token');
        expect(result.user.email).toBe('test@example.com');

        let called = false;
        provider.onAuthStateChanged((user) => {
            called = true;
            expect(user.email).toBe('test@example.com');
        });

        expect(called).toBe(true);
    });
});
