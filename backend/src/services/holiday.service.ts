import { AppDataSource } from '../config/database';
import { Holiday } from '../entities/Holiday';
import { Between } from 'typeorm';

export class HolidayService {
  private holidayRepository = AppDataSource.getRepository(Holiday);

  async getHolidays(country: string, year: number): Promise<Holiday[]> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    return this.holidayRepository.find({
      where: {
        country,
        date: Between(startDate, endDate),
      },
      order: {
        date: 'ASC',
      },
    });
  }

  async addHoliday(country: string, date: Date, name: string, year: number): Promise<Holiday> {
    const holiday = this.holidayRepository.create({
      country,
      date,
      name,
      year,
    });

    return this.holidayRepository.save(holiday);
  }

  async getWorkingDaysSummary(country: string, year: number): Promise<any> {
    const holidays = await this.getHolidays(country, year);
    
    // Calculate total days in the year
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Count weekdays (Monday-Friday)
    let weekdays = 0;
    let weekends = 0;
    const current = new Date(startDate);

    while (current < endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekends++;
      } else {
        weekdays++;
      }
      current.setDate(current.getDate() + 1);
    }

    // Subtract holidays that fall on weekdays
    let holidaysOnWeekdays = 0;
    holidays.forEach((holiday) => {
      const dayOfWeek = holiday.date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        holidaysOnWeekdays++;
      }
    });

    const workingDays = weekdays - holidaysOnWeekdays;

    return {
      year,
      country,
      totalDays,
      weekdays,
      weekends,
      holidays: holidays.length,
      holidaysOnWeekdays,
      workingDays,
    };
  }

  async deleteHoliday(id: string): Promise<boolean> {
    const result = await this.holidayRepository.delete(id);
    return (result.affected || 0) > 0;
  }
}
