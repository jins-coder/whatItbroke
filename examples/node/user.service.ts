/**
 * Example Node.js Service with Database Query and Null Pointer Failure
 */

export interface User {
  id: string;
  name: string;
  profile?: {
    bio?: string;
    name?: string;
  } | null;
}

export class Database {
  public static async query(sql: string, _params: unknown[] = []): Promise<User | null> {
    // Simulates database query returning null when user not found or profile is unpopulated
    return null;
  }
}

export class UserService {
  public static async getProfile(userId: string) {
    // 1. Query database
    const user = await Database.query('SELECT * FROM users WHERE id = ?', [userId]);

    // 2. Vulnerable code: accessing profile.name when user is null or user.profile is null
    // This line will trigger: TypeError: Cannot read properties of undefined (reading 'name')
    return (user as any).profile.name;
  }
}
