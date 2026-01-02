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
import { AttendanceTracker } from 'src/entities/attendance-tracker.entity';

@Injectable()
export class AttendanceHandler {
  constructor(
    private readonly dbService: DatabaseService,
    private transformService: TransformService,
  ) {}
async handleAttendanceUpsert(data: AttendanceEventData): Promise<any> {
  try {
    validateString(data.userId, 'userId');
    validateString(data.tenantId, 'tenantId');
    validateDate(data.attendanceDate, 'attendanceDate');
    validateString(data.attendance, 'attendance');

    // ✅ CORRECT: destructure
    const { attendanceData, dayColumn } =
      await this.transformService.transformAttendanceData(data);

    // ✅ Pass correct types
    return await this.dbService.upsertAttendanceTracker(
      attendanceData,
      dayColumn,
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new Error(`Validation failed: ${error.message}`);
    }
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
