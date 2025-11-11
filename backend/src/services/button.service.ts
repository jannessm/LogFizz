import { AppDataSource } from '../config/database';
import { Button } from '../entities/Button';

export class ButtonService {
  private buttonRepository = AppDataSource.getRepository(Button);

  async createButton(userId: string, data: Partial<Button>): Promise<Button> {
    const button = this.buttonRepository.create({
      ...data,
      user_id: userId,
    });

    return this.buttonRepository.save(button);
  }

  async getUserButtons(userId: string): Promise<Button[]> {
    return this.buttonRepository.find({
      where: { user_id: userId },
      order: { position: 'ASC' },
    });
  }

  async getButtonById(id: string, userId: string): Promise<Button | null> {
    return this.buttonRepository.findOne({
      where: { id, user_id: userId },
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
    const result = await this.buttonRepository.delete({ id, user_id: userId });
    return (result.affected || 0) > 0;
  }
}
