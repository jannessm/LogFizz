import { AppDataSource } from '../config/database.js';
import { Button } from '../entities/Button.js';
import { IsNull, MoreThan } from 'typeorm';

export class ButtonService {
  private buttonRepository = AppDataSource.getRepository(Button);

    async createButton(userId: string, data: Partial<Button>): Promise<Button> {
    // Remove timestamp fields to let TypeORM manage them automatically
    const dataWithoutTimestamps: any = { ...data };
    delete dataWithoutTimestamps.created_at;
    delete dataWithoutTimestamps.updated_at;
    
    const button: Button = this.buttonRepository.create({
      ...dataWithoutTimestamps,
      user_id: userId,
    } as Partial<Button>);

    return this.buttonRepository.save(button);
  }

  async getUserButtons(userId: string): Promise<Button[]> {
    return this.buttonRepository.find({
      where: { user_id: userId, deleted_at: IsNull() },
      order: { position: 'ASC' },
    });
  }

  async getButtonById(id: string, userId: string): Promise<Button | null> {
    return this.buttonRepository.findOne({
      where: { id, user_id: userId, deleted_at: IsNull() },
    });
  }

  async updateButton(id: string, userId: string, updates: Partial<Button>): Promise<Button | null> {
    const button = await this.getButtonById(id, userId);
    if (!button) {
      return null;
    }

    Object.assign(button, updates);
    return this.buttonRepository.save(button);
  }

  async deleteButton(id: string, userId: string): Promise<boolean> {
    const button = await this.getButtonById(id, userId);
    if (!button) {
      return false;
    }

    button.deleted_at = new Date();
    await this.buttonRepository.save(button);
    return true;
  }

  /**
   * Get all buttons (including soft-deleted) changed since a given timestamp
   * Used for sync functionality
   */
  async getChangedButtonsSince(userId: string, since: Date): Promise<Button[]> {
    return this.buttonRepository.find({
      where: {
        user_id: userId,
        updated_at: MoreThan(since),
      },
      order: { updated_at: 'ASC' },
    });
  }

  /**
   * Push bulk changes to buttons (create or update) with conflict detection
   * Returns conflicts if any exist, otherwise returns saved buttons
   */
  async pushButtonChanges(
    userId: string, 
    changes: Array<Partial<Button> & { updated_at?: Date }>
  ): Promise<{
    saved: Button[];
    conflicts: Array<{
      id: string;
      field: 'button';
      clientVersion: Partial<Button>;
      serverVersion: Button;
    }>;
  }> {
    const savedButtons: Button[] = [];
    const conflicts: Array<{
      id: string;
      field: 'button';
      clientVersion: Partial<Button>;
      serverVersion: Button;
    }> = [];

    for (const change of changes) {
      if (change.id) {
        // Check if button exists on server
        const existing = await this.buttonRepository.findOne({
          where: { id: change.id, user_id: userId },
        });

        if (existing) {
          // Conflict detection: Check if server version is newer than client version
          if (change.updated_at) {
            const clientTimestamp = new Date(change.updated_at);
            if (existing.updated_at > clientTimestamp) {
              // Server has newer data - conflict detected
              conflicts.push({
                id: existing.id,
                field: 'button',
                clientVersion: change,
                serverVersion: existing,
              });
              continue; // Skip saving this record
            }
          }

          // No conflict or client is newer - update
          Object.assign(existing, change);
          // Remove updated_at from client to let TypeORM auto-update it
          delete (existing as any).updated_at;
          const button = await this.buttonRepository.save(existing);
          savedButtons.push(button);
        } else {
          // Button doesn't exist, create new one with client-provided UUID
          const button = this.buttonRepository.create({
            ...change,
            user_id: userId,
            id: change.id, // Use client-generated UUID
          });
          // Remove updated_at to let TypeORM set it
          delete (button as any).updated_at;
          const saved = await this.buttonRepository.save(button);
          savedButtons.push(saved);
        }
      } else {
        // Create new button (no ID provided - shouldn't happen in offline-first)
        const button = this.buttonRepository.create({
          ...change,
          user_id: userId,
        });
        delete (button as any).updated_at;
        const saved = await this.buttonRepository.save(button);
        savedButtons.push(saved);
      }
    }

    return { saved: savedButtons, conflicts };
  }
}
