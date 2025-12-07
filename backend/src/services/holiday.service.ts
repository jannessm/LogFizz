import { AppDataSource } from '../config/database.js';
import { Holiday } from '../entities/Holiday.js';

export class HolidayService {
  private holidayRepository = AppDataSource.getRepository(Holiday);

  async getHolidays(state_code: string, year: number): Promise<Holiday[]> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);

    return this.holidayRepository.createQueryBuilder('h')
                    .where('h.global = true')
                    .orWhere(':state = ANY (h.counties)', { state: state_code })
                    .andWhere('h.date BETWEEN :startDate AND :endDate', { startDate, endDate })
                    .orderBy('h.date', 'ASC')
                    .getMany();
  }


  async getWorkingDaysSummary(state_code: string, year: number): Promise<any> {
    const holidays = await this.getHolidays(state_code, year);

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
      state_code,
      totalDays,
      weekdays,
      weekends,
      holidays: holidays.length,
      holidaysOnWeekdays,
      workingDays,
    };
  }

}
