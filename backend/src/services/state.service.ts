import { AppDataSource } from '../config/database.js';
import { State } from '../entities/State.js';

export class StateService {
  private stateRepository = AppDataSource.getRepository(State);

  /**
   * Get all states
   */
  async getAllStates(): Promise<State[]> {
    return this.stateRepository.find({
      order: { state: 'ASC' },
    });
  }

  /**
   * Get states by country
   */
  async getStatesByCountry(country: string): Promise<State[]> {
    return this.stateRepository.find({
      where: { country },
      order: { state: 'ASC' },
    });
  }

  /**
   * Get a state by ID
   */
  async getStateById(id: string): Promise<State | null> {
    return this.stateRepository.findOne({
      where: { code: id },
    });
  }

  /**
   * Get a state by code (e.g., 'DE-BW')
   */
  async getStateByCode(code: string): Promise<State | null> {
    return this.stateRepository.findOne({
      where: { code },
    });
  }

  /**
   * Create a new state
   */
  async createState(country: string, state: string, code: string): Promise<State> {
    const stateEntity = this.stateRepository.create({
      country,
      state,
      code,
    });
    return this.stateRepository.save(stateEntity);
  }
}
