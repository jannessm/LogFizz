import { AppDataSource } from '../config/database.js';
import { User } from '../entities/User.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { IsNull } from 'typeorm';

export class AuthService {
  private userRepository = AppDataSource.getRepository(User);

  async register(email: string, password: string, name: string, state?: string): Promise<User> {
    const existingUser = await this.userRepository.findOne({ where: { email, deleted_at: IsNull() } });
    if (existingUser) {
      throw new Error('User already exists');
    }

    const password_hash = await hashPassword(password);
    const user = this.userRepository.create({
      email,
      password_hash,
      name,
      state,
    });

    return this.userRepository.save(user);
  }

  async login(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { email, deleted_at: IsNull() } });
    if (!user) {
      return null;
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return null;
    }

    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id, deleted_at: IsNull() } });
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const user = await this.getUserById(id);
    if (!user) {
      return null;
    }

    Object.assign(user, updates);
    return this.userRepository.save(user);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) {
      return false;
    }

    const isValid = await verifyPassword(oldPassword, user.password_hash);
    if (!isValid) {
      return false;
    }

    user.password_hash = await hashPassword(newPassword);
    await this.userRepository.save(user);
    return true;
  }
}
