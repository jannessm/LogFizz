import { AppDataSource } from '../config/database.js';
import { Button } from '../entities/Button.js';
import { MoreThan } from 'typeorm';
import dayjs from '../utils/dayjs.js';

export class ButtonService {
  private buttonRepository = AppDataSource.getRepository(Button);

  /**
   * Get all buttons (including soft-deleted) changed since a given timestamp
   * Used for sync functionality
   */
  async getChangedButtonsSince(userId: string, since: Date): Promise<Button[]> {
    // Include records where either updated_at or created_at is greater than `since`.
    // Some DBs may have limited timestamp resolution; checking created_at ensures newly
    // created rows after the cursor are not missed.
    return this.buttonRepository.find({
      where: [
        { user_id: userId, updated_at: MoreThan(since) },
        { user_id: userId, created_at: MoreThan(since) },
      ],
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
      clientVersion: Partial<Button>;
      serverVersion: Button;
    }>;
  }> {
    const savedButtons: Button[] = [];
    const conflicts: Array<{
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
            const clientTimestamp = dayjs(change.updated_at);
            const serverTimestamp = dayjs(existing.updated_at);
            if (serverTimestamp.isAfter(clientTimestamp)) {
              // Server has newer data - conflict detected
              conflicts.push({
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
