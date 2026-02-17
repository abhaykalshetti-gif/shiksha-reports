import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../services/database.service';
import { TransformService } from '../constants/transformation/transform-service';
import { UserEventData } from '../types';

@Injectable()
export class CohortMemberHandler {
  private readonly logger = new Logger(CohortMemberHandler.name);

  constructor(
    private readonly dbService: DatabaseService,
    private readonly transformService: TransformService,
  ) { }

  async handleCohortMemberUpsert(data: any) {
    try {
      this.logger.debug(
        `Incoming cohort member event: ${JSON.stringify(data)}`,
      );
      let cohortMembershipId: string | undefined = data?.cohortMembershipId;
      const userId: string | undefined = data?.userId || data?.UserID;
      const cohortId: string | undefined = data?.cohortId || data?.CohortID;
      const status: string | undefined = data?.status || data?.MemberStatus;
      const academicYearId: string | undefined =
        data?.academicYearId || data?.AcademicYearID;

      // If cohortMembershipId not provided, try to resolve or create using (userId, cohortId)
      if (!cohortMembershipId && userId && cohortId) {
        const existing = await this.dbService.findCohortMember(
          userId,
          cohortId,
        );
        if (existing) {
          cohortMembershipId = existing.CohortMemberID as any;
        }
      }

      if (!cohortMembershipId) {
        this.logger.warn(
          'Missing cohortMembershipId and unable to resolve from userId/cohortId',
        );
        return;
      }

      // Only update if record exists for this cohortMembershipId
      const existingById = await this.dbService.findCohortMemberById(
        cohortMembershipId,
      );
      if (!existingById) {
        await this.dbService.createCohortMemberWithId({
          cohortMembershipId: cohortMembershipId,
          userId: userId,
          cohortId: cohortId,
          academicYearId: academicYearId,
          status: status ?? 'active',
        });
        this.logger.log(
          `Created cohort member with ID ${cohortMembershipId}`,
        );
        // Continue to update custom fields
      }

      const updates: Record<string, any> = {};

      // Include status if provided
      if (status) {
        updates['MemberStatus'] = status;
      }

      if (cohortId) {
        updates['CohortID'] = cohortId;
      }

      if (userId) {
        updates['UserID'] = userId;
      }

      if (academicYearId) {
        updates['AcademicYearID'] = academicYearId;
      }

      // Use TransformService for custom fields extraction (Support FieldID and Labels)
      if (data?.customFields) {
        try {
          const userEventPayload: UserEventData = {
            userId: userId || '',
            cohorts: [
              {
                batchId: cohortId,
                cohortMemberId: cohortMembershipId,
                academicYearId: academicYearId,
                cohortMemberStatus: status,
                customFields: data.customFields,
              } as any,
            ],
          } as any;

          const transformedList = await this.transformService.transformCohortMemberData(userEventPayload);
          if (transformedList && transformedList.length > 0) {
            const result = transformedList[0];
            const fieldsToSync = [
              'Subject',
              'Fees',
              'Registration',
              'Board',
              'Slot',
            ];
            for (const field of fieldsToSync) {
              if (result[field] !== undefined) {
                updates[field] = result[field];
              }
            }
          }
        } catch (err) {
          this.logger.error(
            `Error transforming custom fields: ${err.message}`,
          );
        }
      }

      // Path A: Support a direct fields map: { fields: { Subject: 'x', Fees: 'y', ... } }
      if (
        data?.fields &&
        typeof data.fields === 'object' &&
        !Array.isArray(data.fields)
      ) {
        const wanted = new Map<string, string>([
          ['subject', 'Subject'],
          ['fees', 'Fees'],
          ['registration', 'Registration'],
          ['board', 'Board'],
          ['slots', 'Slot'],
        ]);

        for (const [name, val] of Object.entries<any>(data.fields)) {
          const key = (name || '').toString().trim().toLowerCase();
          if (!wanted.has(key)) continue;
          const columnName = wanted.get(key) as string;
          updates[columnName] = val == null ? null : String(val);
        }
        this.logger.debug(
          `Parsed fields map for ${cohortMembershipId} | keys=${Object.keys(
            updates,
          ).join(',')}`,
        );
      }

      if (Object.keys(updates).length === 0) {
        this.logger.debug(
          `No updates to perform | cohortMembershipId=${cohortMembershipId} | status=${status || 'none'
          } `,
        );
        return;
      }

      this.logger.debug(
        `Updating fields for ${cohortMembershipId} | updates=${JSON.stringify(
          updates,
        )}`,
      );
      await this.dbService.updateCohortMemberCustomFieldsById(
        cohortMembershipId,
        updates,
      );
      this.logger.log(
        `Updated cohort member fields for ${cohortMembershipId}: ${Object.keys(
          updates,
        ).join(', ')}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to upsert cohort member fields: ${error.message} | stack=${error?.stack}`,
      );
      throw error;
    }
  }
}
