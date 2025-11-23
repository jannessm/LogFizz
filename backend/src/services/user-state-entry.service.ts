import { AppDataSource } from '../config/database.js';
import { UserStateEntry } from '../entities/UserStateEntry.js';
import { MoreThan, IsNull } from 'typeorm';

export class UserStateEntryService {
  private stateEntryRepository = AppDataSource.getRepository(UserStateEntry);

  /**
   * Create a new state entry for a target
   */
  async createStateEntry(
    targetId: string, 
    stateId: string, 
    registeredAt: Date
  ): Promise<UserStateEntry> {
    const entry = this.stateEntryRepository.create({
      target_id: targetId,
      state_id: stateId,
      registered_at: registeredAt,
    });
    return this.stateEntryRepository.save(entry);
  }

  /**
   * Get all state entries for a target (excluding soft-deleted)
   */
  async getStateEntriesByTarget(targetId: string): Promise<UserStateEntry[]> {
    return this.stateEntryRepository.find({
      where: {
        target_id: targetId,
        deleted_at: IsNull(),
      },
      relations: ['state'],
      order: { registered_at: 'DESC' },
    });
  }

  /**
   * Get all state entries (including soft-deleted) changed since a given timestamp
   * Used for sync functionality
   */
  async getChangedStateEntriesSince(targetId: string, since: Date): Promise<UserStateEntry[]> {
    return this.stateEntryRepository.find({
      where: {
        target_id: targetId,
        updated_at: MoreThan(since),
      },
      order: { updated_at: 'ASC' },
    });
  }

  /**
   * Get a single state entry by ID
   */
  async getStateEntryById(targetId: string, entryId: string): Promise<UserStateEntry | null> {
    return this.stateEntryRepository.findOne({
      where: {
        id: entryId,
        target_id: targetId,
      },
      relations: ['state'],
    });
  }

  /**
   * Update an existing state entry
   */
  async updateStateEntry(
    targetId: string,
    entryId: string,
    updates: Partial<Pick<UserStateEntry, 'state_id' | 'registered_at'>>
  ): Promise<UserStateEntry | null> {
    const entry = await this.stateEntryRepository.findOne({
      where: {
        id: entryId,
        target_id: targetId,
      },
    });
    if (!entry) {
      return null;
    }

    Object.assign(entry, updates);
    return this.stateEntryRepository.save(entry);
  }

  /**
   * Soft delete a state entry
   */
  async deleteStateEntry(targetId: string, entryId: string): Promise<boolean> {
    const entry = await this.getStateEntryById(targetId, entryId);
    if (!entry) {
      return false;
    }

    entry.deleted_at = new Date();
    await this.stateEntryRepository.save(entry);
    return true;
  }

  /**
   * Push bulk changes to state entries (create or update) with conflict detection
   * Returns conflicts if any exist, otherwise returns saved entries
   */
  async pushStateEntryChanges(
    targetId: string,
    changes: Array<Partial<UserStateEntry> & { updated_at?: Date }>
  ): Promise<{
    saved: UserStateEntry[];
    conflicts: Array<{
      clientVersion: Partial<UserStateEntry>;
      serverVersion: UserStateEntry;
    }>;
  }> {
    const savedEntries: UserStateEntry[] = [];
    const conflicts: Array<{
      clientVersion: Partial<UserStateEntry>;
      serverVersion: UserStateEntry;
    }> = [];

    for (const change of changes) {
      if (change.id) {
        // Check if entry exists on server
        const existing = await this.stateEntryRepository.findOne({
          where: { id: change.id, target_id: targetId },
        });

        if (existing) {
          // Conflict detection: Check if server version is newer than client version
          if (change.updated_at) {
            const clientTimestamp = new Date(change.updated_at);
            if (existing.updated_at > clientTimestamp) {
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
          const entry = await this.stateEntryRepository.save(existing);
          savedEntries.push(entry);
        } else {
          // Entry doesn't exist, create new one with client-provided UUID
          const entry = this.stateEntryRepository.create({
            ...change,
            target_id: targetId,
            id: change.id, // Use client-generated UUID
          });
          // Remove updated_at to let TypeORM set it
          delete (entry as any).updated_at;
          const saved = await this.stateEntryRepository.save(entry);
          savedEntries.push(saved);
        }
      } else {
        // Create new entry (no ID provided - shouldn't happen in offline-first)
        const entry = this.stateEntryRepository.create({
          ...change,
          target_id: targetId,
        });
        delete (entry as any).updated_at;
        const saved = await this.stateEntryRepository.save(entry);
        savedEntries.push(saved);
      }
    }

    return { saved: savedEntries, conflicts };
  }

  /**
   * Get state entries within a date range
   */
  async getStateEntriesInRange(
    targetId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UserStateEntry[]> {
    return this.stateEntryRepository
      .createQueryBuilder('entry')
      .where('entry.target_id = :targetId', { targetId })
      .andWhere('entry.registered_at >= :startDate', { startDate })
      .andWhere('entry.registered_at <= :endDate', { endDate })
      .andWhere('entry.deleted_at IS NULL')
      .orderBy('entry.registered_at', 'DESC')
      .getMany();
  }

  /**
   * Get the most recent state entry for a target
   */
  async getMostRecentStateEntry(targetId: string): Promise<UserStateEntry | null> {
    return this.stateEntryRepository.findOne({
      where: {
        target_id: targetId,
        deleted_at: IsNull(),
      },
      relations: ['state'],
      order: { registered_at: 'DESC' },
    });
  }
}
