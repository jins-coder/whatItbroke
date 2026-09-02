/**
 * Example Node.js Service with Database Query and Null Pointer Failure
 */
export class Database {
    static async query(sql, _params = []) {
        // Simulates database query returning null when user not found or profile is unpopulated
        return null;
    }
}
export class UserService {
    static async getProfile(userId) {
        // 1. Query database
        const user = await Database.query('SELECT * FROM users WHERE id = ?', [userId]);
        // 2. Vulnerable code: accessing profile.name when user is null or user.profile is null
        // This line will trigger: TypeError: Cannot read properties of undefined (reading 'name')
        return user.profile.name;
    }
}
