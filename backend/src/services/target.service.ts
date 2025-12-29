import { AppDataSource } from '../config/database.js';
import { Target } from '../entities/Target.js';
import { TargetSpec } from '../entities/TargetSpec.js';
import { Timer } from '../entities/Timer.js';
import { MoreThan } from 'typeorm';
import dayjs from '../../../lib/utils/dayjs.js';

interface TargetWithSpecs {
  id: string;
  name: string;
  user_id: string;
  target_specs: Array<{
    id: string;
    target_id: string;
    user_id: string;
    duration_minutes: number[];
    weekdays: number[];
    exclude_holidays: boolean;
    state_code?: string;
    starting_from: Date;
    ending_at?: Date;
    updated_at?: Date;
  }>;
  updated_at?: Date;
  deleted_at?: Date;
}

export class TargetService {
  private targetRepository = AppDataSource.getRepository(Target);
  private targetSpecRepository = AppDataSource.getRepository(TargetSpec);
  private timerRepository = AppDataSource.getRepository(Timer);

  /**
   * Get all targets with nested specs (including soft-deleted) changed since a given timestamp
   * The target's updated_at is the max of the target's and all its specs' updated_at timestamps
   * Specs are sorted by starting_from date
   */
  async getChangedTargetsSince(userId: string, since: Date): Promise<TargetWithSpecs[]> {
    // Get all targets that were updated/created since the timestamp
    const targets = await this.targetRepository.find({
      where: [
        { user_id: userId, updated_at: MoreThan(since) },
      ],
      withDeleted: true,
    });

    // Get all target specs that were updated/created since the timestamp
    // No need for withDeleted since specs are hard deleted
    const specs = await this.targetSpecRepository.find({
      where: [
        { user_id: userId, updated_at: MoreThan(since) },
      ],
    });

    // Group specs by target_id
    const specsByTargetId = new Map<string, typeof specs>();
    for (const spec of specs) {
      if (!specsByTargetId.has(spec.target_id)) {
        specsByTargetId.set(spec.target_id, []);
      }
      specsByTargetId.get(spec.target_id)!.push(spec);
    }

    // Find targets that have changed specs but target itself hasn't changed
    const targetIdsWithChangedSpecs = new Set(specsByTargetId.keys());
    const targetIds = new Set(targets.map(t => t.id));
    const additionalTargetIds = [...targetIdsWithChangedSpecs].filter(id => !targetIds.has(id));

    // Fetch those additional targets
    const additionalTargets = additionalTargetIds.length > 0
      ? await this.targetRepository.find({
          where: additionalTargetIds.map(id => ({ id })),
          withDeleted: true,
        })
      : [];

    const allTargets = [...targets, ...additionalTargets];

    // Build the nested structure
    const result: TargetWithSpecs[] = [];
    for (const target of allTargets) {
      // Get all specs for this target (no withDeleted - hard delete only)
      const targetSpecs = await this.targetSpecRepository.find({
        where: { target_id: target.id },
        order: { starting_from: 'ASC' },
      });

      // Convert weekdays and duration_minutes from string[] to number[]
      const convertedSpecs = targetSpecs.map(spec => ({
        ...spec,
        weekdays: spec.weekdays.map((day: any) => typeof day === 'string' ? parseInt(day, 10) : day),
        duration_minutes: spec.duration_minutes.map((min: any) => typeof min === 'string' ? parseInt(min, 10) : min),
      }));

      // Calculate max updated_at from target and all its specs
      const allUpdatedAts = [
        target.updated_at,
        ...convertedSpecs.map(s => s.updated_at),
      ];
      const maxUpdatedAt = allUpdatedAts.reduce((max, current) => 
        current > max ? current : max
      , target.updated_at);

      result.push({
        id: target.id,
        name: target.name,
        user_id: target.user_id,
        target_specs: convertedSpecs,
        updated_at: maxUpdatedAt,
        deleted_at: target.deleted_at,
      });
    }

    return result;
  }

  /**
   * Push bulk changes to targets and specs with conflict detection
   * Only updates entities that have actually changed
   * Returns conflicts if any exist, otherwise returns saved targets
   */
  async pushTargetChanges(
    userId: string,
    changes: Array<Partial<TargetWithSpecs> & { updated_at?: Date }>
  ): Promise<{
    saved: TargetWithSpecs[];
    conflicts: Array<{
      clientVersion: Partial<TargetWithSpecs>;
      serverVersion: TargetWithSpecs;
    }>;
  }> {
    const savedTargets: TargetWithSpecs[] = [];
    const conflicts: Array<{
      clientVersion: Partial<TargetWithSpecs>;
      serverVersion: TargetWithSpecs;
    }> = [];

    for (const change of changes) {
      if (!change.id) {
        // Create new target without ID (let database auto-generate)
        const target = this.targetRepository.create({
          user_id: userId,
          name: change.name!,
          target_spec_ids: (change.target_specs || []).map(s => s.id),
        });
        const savedTarget = await this.targetRepository.save(target);

        // Create all specs
        const savedSpecs = [];
        for (const specData of change.target_specs || []) {
          const spec = this.targetSpecRepository.create({
            ...specData,
            id: specData.id,
            user_id: userId,
            target_id: savedTarget.id,
            exclude_holidays: specData.exclude_holidays ?? false,
          });
          savedSpecs.push(await this.targetSpecRepository.save(spec));
        }

        const convertedSpecs = savedSpecs.map(s => ({
          ...s,
          weekdays: s.weekdays.map((day: any) => typeof day === 'string' ? parseInt(day, 10) : day),
          duration_minutes: s.duration_minutes.map((min: any) => typeof min === 'string' ? parseInt(min, 10) : min),
        }));

        const allUpdatedAts = [
          savedTarget.updated_at,
          ...convertedSpecs.map(s => s.updated_at),
        ];
        const maxUpdatedAt = allUpdatedAts.reduce((max, current) => 
          current > max ? current : max
        , savedTarget.updated_at);

        savedTargets.push({
          ...savedTarget,
          target_specs: convertedSpecs,
          updated_at: maxUpdatedAt,
        });
        continue;
      }

      // Check if target exists on server
      const existingTarget = await this.targetRepository.findOne({
        where: { id: change.id, user_id: userId },
        withDeleted: true,
      });

      if (!existingTarget) {
        // Target doesn't exist, create it
        const target = this.targetRepository.create({
          id: change.id,
          user_id: userId,
          name: change.name!,
          target_spec_ids: (change.target_specs || []).map(s => s.id),
        });
        const savedTarget = await this.targetRepository.save(target);

        // Create all specs
        const savedSpecs = [];
        for (const specData of change.target_specs || []) {
          const spec = this.targetSpecRepository.create({
            ...specData,
            id: specData.id,
            user_id: userId,
            target_id: savedTarget.id,
            exclude_holidays: specData.exclude_holidays ?? false,
          });
          savedSpecs.push(await this.targetSpecRepository.save(spec));
        }

        const convertedSpecs = savedSpecs.map(s => ({
          ...s,
          weekdays: s.weekdays.map((day: any) => typeof day === 'string' ? parseInt(day, 10) : day),
          duration_minutes: s.duration_minutes.map((min: any) => typeof min === 'string' ? parseInt(min, 10) : min),
        }));

        const allUpdatedAts = [
          savedTarget.updated_at,
          ...convertedSpecs.map(s => s.updated_at),
        ];
        const maxUpdatedAt = allUpdatedAts.reduce((max, current) => 
          current > max ? current : max
        , savedTarget.updated_at);

        savedTargets.push({
          ...savedTarget,
          target_specs: convertedSpecs,
          updated_at: maxUpdatedAt,
        });
        continue;
      }

      // Get all existing specs for this target (no withDeleted - hard delete only)
      const existingSpecs = await this.targetSpecRepository.find({
        where: { target_id: existingTarget.id },
      });

      // Calculate server's max updated_at
      const serverUpdatedAts = [
        existingTarget.updated_at,
        ...existingSpecs.map(s => s.updated_at),
      ];
      const serverMaxUpdatedAt = serverUpdatedAts.reduce((max, current) =>
        current > max ? current : max
      , existingTarget.updated_at);

      // Conflict detection: Check if server version is newer than client version
      if (change.updated_at) {
        const clientTimestamp = dayjs(change.updated_at);
        const serverTimestamp = dayjs(serverMaxUpdatedAt);
        
        if (serverTimestamp.isAfter(clientTimestamp)) {
          // Server has newer data - conflict detected
          const convertedSpecs = existingSpecs
            .map(spec => ({
              ...spec,
              weekdays: spec.weekdays.map((day: any) => typeof day === 'string' ? parseInt(day, 10) : day),
              duration_minutes: spec.duration_minutes.map((min: any) => typeof min === 'string' ? parseInt(min, 10) : min),
            }))
            .sort((a, b) => a.starting_from.getTime() - b.starting_from.getTime());

          conflicts.push({
            clientVersion: change,
            serverVersion: {
              ...existingTarget,
              target_specs: convertedSpecs,
              updated_at: serverMaxUpdatedAt,
            },
          });
          continue;
        }
      }

      // No conflict - update target and specs
      let targetNeedsUpdate = false;
      
      // Check if target name changed
      if (change.name && change.name !== existingTarget.name) {
        existingTarget.name = change.name;
        targetNeedsUpdate = true;
      }

      // Check if target deleted_at changed
      if (change.deleted_at !== undefined) {
        const newDeletedAt = change.deleted_at ? dayjs(change.deleted_at).toDate() : undefined;
        if ((newDeletedAt?.getTime() || 0) !== (existingTarget.deleted_at?.getTime() || 0)) {
          existingTarget.deleted_at = newDeletedAt;
          targetNeedsUpdate = true;
        }
      }

      // Update target_spec_ids
      const newSpecIds = (change.target_specs || []).map(s => s.id);
      const existingSpecIds = existingTarget.target_spec_ids || [];
      if (JSON.stringify(newSpecIds.sort()) !== JSON.stringify([...existingSpecIds].sort())) {
        existingTarget.target_spec_ids = newSpecIds;
        targetNeedsUpdate = true;
      }

      if (targetNeedsUpdate) {
        await this.targetRepository.save(existingTarget);
      }

      // Update specs
      const savedSpecs = [];
      const clientSpecsById = new Map(
        (change.target_specs || []).map(s => [s.id, s])
      );
      const existingSpecsById = new Map(
        existingSpecs.map(s => [s.id, s])
      );

      // Delete specs that are no longer in the client's list (hard delete)
      for (const existingSpec of existingSpecs) {
        if (!clientSpecsById.has(existingSpec.id)) {
          await this.targetSpecRepository.remove(existingSpec);
        }
      }

      // Update or create specs from client
      for (const specData of change.target_specs || []) {
        const existingSpec = existingSpecsById.get(specData.id);
        
        if (existingSpec) {
          // Check if spec has changed
          let specNeedsUpdate = false;
          
          if (JSON.stringify(specData.duration_minutes) !== JSON.stringify(existingSpec.duration_minutes.map((m: any) => typeof m === 'string' ? parseInt(m, 10) : m))) {
            existingSpec.duration_minutes = specData.duration_minutes;
            specNeedsUpdate = true;
          }
          
          if (JSON.stringify(specData.weekdays) !== JSON.stringify(existingSpec.weekdays.map((d: any) => typeof d === 'string' ? parseInt(d, 10) : d))) {
            existingSpec.weekdays = specData.weekdays;
            specNeedsUpdate = true;
          }
          
          if (specData.exclude_holidays !== undefined && specData.exclude_holidays !== existingSpec.exclude_holidays) {
            existingSpec.exclude_holidays = specData.exclude_holidays;
            specNeedsUpdate = true;
          }
          
          if (specData.state_code !== undefined && specData.state_code !== existingSpec.state_code) {
            existingSpec.state_code = specData.state_code;
            specNeedsUpdate = true;
          }
          
          if (specData.starting_from && dayjs(specData.starting_from).toDate().getTime() !== existingSpec.starting_from.getTime()) {
            existingSpec.starting_from = dayjs(specData.starting_from).toDate();
            specNeedsUpdate = true;
          }
          
          const newEndingAt = specData.ending_at ? dayjs(specData.ending_at).toDate() : undefined;
          if ((newEndingAt?.getTime() || 0) !== (existingSpec.ending_at?.getTime() || 0)) {
            existingSpec.ending_at = newEndingAt;
            specNeedsUpdate = true;
          }
          
          if (specNeedsUpdate) {
            await this.targetSpecRepository.save(existingSpec);
          }
          
          savedSpecs.push(existingSpec);
        } else {
          // Create new spec
          const spec = this.targetSpecRepository.create({
            ...specData,
            id: specData.id,
            user_id: userId,
            target_id: existingTarget.id,
            exclude_holidays: specData.exclude_holidays ?? false,
          });
          savedSpecs.push(await this.targetSpecRepository.save(spec));
        }
      }

      // Sort specs by starting_from
      savedSpecs.sort((a, b) => a.starting_from.getTime() - b.starting_from.getTime());

      // Calculate max updated_at from target and all its specs
      const convertedSpecs = savedSpecs.map(s => ({
        ...s,
        weekdays: s.weekdays.map((day: any) => typeof day === 'string' ? parseInt(day, 10) : day),
        duration_minutes: s.duration_minutes.map((min: any) => typeof min === 'string' ? parseInt(min, 10) : min),
      }));

      const allUpdatedAts = [
        existingTarget.updated_at,
        ...convertedSpecs.map(s => s.updated_at),
      ];
      const maxUpdatedAt = allUpdatedAts.reduce((max, current) => 
        current > max ? current : max
      , existingTarget.updated_at);

      // Convert and add to saved targets
      savedTargets.push({
        ...existingTarget,
        target_specs: convertedSpecs,
        updated_at: maxUpdatedAt,
      });
    }

    return { saved: savedTargets, conflicts };
  }
}
