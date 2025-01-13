import { supabase } from '@/utils/supabase/client';
import { lookupUserByUsername, getUserMessages } from '@/utils/supabase/users';

describe('User Operations', () => {
  let testUser: { id: string; name: string };

  beforeAll(async () => {
    const timestamp = Date.now();
    // Create a test user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        id: 'test-' + timestamp,
        name: 'testuser',
        email: `test${timestamp}@example.com`,
        role: 'USER',
        status: 'OFFLINE'
      })
      .select()
      .single();

    if (userError || !user) {
      throw new Error(`Failed to create test user: ${userError?.message}`);
    }
    testUser = user;
  });

  afterAll(async () => {
    if (testUser?.id) {
      await supabase.from('users').delete().eq('id', testUser.id);
    }
  });

  it('should look up user by username', async () => {
    const user = await lookupUserByUsername('testuser');
    expect(user).not.toBeNull();
    expect(user?.name).toBe('testuser');
  });

  it('should return null for non-existent username', async () => {
    const user = await lookupUserByUsername('nonexistentuser');
    expect(user).toBeNull();
  });

  it('should retrieve user messages', async () => {
    const messages = await getUserMessages(testUser.id);
    expect(Array.isArray(messages)).toBe(true);
  });
}); 