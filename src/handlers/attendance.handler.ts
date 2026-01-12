import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../services/database.service';
import { TransformService } from 'src/constants/transformation/transform-service';
import {
  AttendanceEventData,
  validateRequired,
  validateString,
  validateDate,
  ValidationError,
} from '../types';

@Injectable()
export class AttendanceHandler {
  constructor(
    private readonly dbService: DatabaseService,
    private transformService: TransformService,
  ) {}

  async handleAttendanceUpsert(data: AttendanceEventData): Promise<any> {
    try {
      // Validate required fields
      validateString(data.userId, 'userId');
      validateString(data.tenantId, 'tenantId');
      validateString(data.attendanceDate, 'attendanceDate');
      validateString(data.attendance, 'attendance');
    

      // Use new AttendanceTracker transformation
      const { attendanceData, dayColumn, attendanceValue } =
        await this.transformService.transformAttendanceData(data);
      return await this.dbService.upsertAttendanceTracker(
        attendanceData,
        dayColumn,
        attendanceValue,
      );
    } catch (error) {
      if (error instanceof ValidationError) {
        console.error(
          'Validation failed in handleAttendanceUpsert:',
          error.message,
        );
        throw new Error(`Validation failed: ${error.message}`);
      }
      console.error('Error handling attendance upsert:', error);
      throw error;
    }
  }

  async handleAttendanceDelete(data: {
    userId: string;
    tenantId: string;
  }): Promise<any> {
    try {
      validateString(data.userId, 'userId');
      validateString(data.tenantId, 'tenantId');
      return await this.dbService.deleteAttendanceTrackerData(data);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new Error(`Validation failed: ${error.message}`);
      }
      console.error('Error handling attendance delete:', error);
      throw error;
    }
  }
}
