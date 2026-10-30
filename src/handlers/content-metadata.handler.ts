import { Injectable, Logger } from '@nestjs/common';
import { ExternalApiService } from '../services/external-api.service';
import { TransformService } from '../constants/transformation/transform-service';
import { DatabaseService } from '../services/database.service';


@Injectable()
export class ContentMetadataHandler {
  private readonly logger = new Logger(ContentMetadataHandler.name);

  constructor(
    private readonly externalApiService: ExternalApiService,
    private readonly transformService: TransformService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Handle post-publish events from dev.knowlg.content.postpublish.request
   * Fires when a Course or Content item is published (status = Live)
   */
  async handlePostPublishEvent(edata: any): Promise<void> {
    const identifier = edata?.identifier;
    const contentType = edata?.contentType;

    if (!identifier) {
      this.logger.warn('Post-publish event missing identifier, skipping');
      return;
    }

    this.logger.log(
      `Processing post-publish event: ${identifier} (contentType: ${contentType})`,
    );

    try {
      if (contentType === 'Course') {
        await this.processSingleCourse(identifier);
      } else {
        await this.processSingleContent(identifier);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process post-publish event for ${identifier}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Handle assessment publish events from dev.assessment.publish.request
   * Fires when a QuestionSet is published
   */
  async handleAssessmentPublishEvent(edata: any): Promise<void> {
    const identifier =
      edata?.metadata?.identifier || edata?.identifier;

    if (!identifier) {
      this.logger.warn('Assessment publish event missing identifier, skipping');
      return;
    }

    this.logger.log(
      `Processing assessment publish event: ${identifier}`,
    );

    try {
      await this.processSingleQuestionSet(identifier);
    } catch (error) {
      this.logger.error(
        `Failed to process assessment publish event for ${identifier}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Handle graph events from dev.knowlg.learning.graph.events
   * Publishes: Content/Collection/Course = Processing -> Live; QuestionSet = any non-Live -> Live (e.g. Review -> Live).
   * Retire/unlist: any -> Retired | Unlisted.
   * Skipped transitions are logged for QuestionSet, or for all types when GRAPH_EVENTS_LOG_SKIPPED=true.
   */
  async handleGraphStatusChange(event: any): Promise<void> {
    const statusChange = event?.transactionData?.properties?.status;
    if (!statusChange) return;

    const newStatus = statusChange.nv;
    const oldStatus = statusChange.ov;
    const objectTypeEarly = event?.objectType;

    // Course publish often appears as objectType "Collection" or "Content" in graph events.
    // QuestionSet uses Review -> Live (and similar), not Processing -> Live.
    const isSunbirdContentLike =
      objectTypeEarly === 'Content' || objectTypeEarly === 'Collection';
    const isContentGraphPublish =
      isSunbirdContentLike &&
      oldStatus === 'Processing' &&
      newStatus === 'Live';
    const isQuestionSetPublish =
      objectTypeEarly === 'QuestionSet' &&
      newStatus === 'Live' &&
      oldStatus !== 'Live';
    const isPublish = isContentGraphPublish || isQuestionSetPublish;
    const isRetireOrUnlist = newStatus === 'Retired' || newStatus === 'Unlisted';

    if (!isPublish && !isRetireOrUnlist) {
      const identifier = event?.nodeUniqueId;
      const objectType = event?.objectType;     
      const logAllSkipped = process.env.GRAPH_EVENTS_LOG_SKIPPED === 'true';
      if (objectType === 'QuestionSet' || logAllSkipped) {
        this.logger.log(
          `[graph-events] Skipped (non-actionable) | ${objectType ?? '?'} | ${identifier ?? '?'} | ${oldStatus ?? '?'} -> ${newStatus ?? '?'}`,
        );
      }
      return;
    }

    const identifier = event.nodeUniqueId;
    const objectType = event.objectType;

    if (!identifier || !objectType) {
      this.logger.warn(
        'Graph status change event missing identifier or objectType, skipping',
      );
      return;
    }

    this.logger.log(
      `Processing graph status change: ${identifier} (${objectType}) -> ${newStatus}`,
    );

    try {
      if (objectType === 'QuestionSet') {
        await this.processSingleQuestionSet(identifier, newStatus);
      } else {
        // Course vs Content: graph may send objectType "Content" or "Collection"; API primaryCategory decides.
        await this.processContentOrCourse(identifier, newStatus);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process graph status change for ${identifier}: ${error.message}`,
        error.stack,
      );
    }
  }

  private async processContentOrCourse(identifier: string, newStatus?: string): Promise<void> {
    // For publish (Live): wait for search index to catch up (~20s)
    // For Retired/Unlisted: no wait needed, but must explicitly pass status filter
    // because the search API excludes non-Live items by default
    const isPublish = newStatus === 'Live';
    if (isPublish) {
      await new Promise((resolve) => setTimeout(resolve, 20000));
    }

    const statuses = isPublish
      ? ['Live']
      : ['Retired', 'Unlisted', 'Live']; // include Live as fallback

    // Fetch raw metadata to determine if this is a Course or Content item.
    // In Sunbird graph events both share objectType: "Content".
    // We use primaryCategory to distinguish: "Course" -> Course table, everything else -> Content table.
    const rawData = await this.externalApiService.fetchSingleItemMetadata(identifier, undefined, statuses);
    if (!rawData) {
      this.logger.warn(`No metadata found for identifier: ${identifier}`);
      return;
    }

    const primaryCategory = rawData.primaryCategory || rawData.contentType || '';
    if (primaryCategory === 'Course') {
      this.logger.log(`Routing ${identifier} to Course handler (primaryCategory: ${primaryCategory})`);
      const [converted] = this.externalApiService.convertPrathamToLegacyFormat([rawData]);
      if (!converted) return;
      const transformedCourse = await this.transformService.transformExternalCourseData(converted);
      const hierarchy = await this.externalApiService.getCourseHierarchy(identifier);
      if (hierarchy) {
        const levels = this.externalApiService.mapCourseLevelsByChannel(hierarchy);
        (transformedCourse as any).level1 = levels.level1 || null;
        (transformedCourse as any).level2 = levels.level2 || null;
        (transformedCourse as any).level3 = levels.level3 || null;
        (transformedCourse as any).level4 = levels.level4 || null;
        (transformedCourse as any).childnodes = hierarchy.children
          ? JSON.stringify(hierarchy.children)
          : (transformedCourse as any).childnodes || null;
      }
      if (newStatus) {
        transformedCourse.status = newStatus;
      }
      await this.databaseService.upsertCourse(transformedCourse);
      this.logger.log(`Successfully upserted course: ${identifier}`);
    } else {
      this.logger.log(`Routing ${identifier} to Content handler (primaryCategory: ${primaryCategory})`);
      const [converted] = this.externalApiService.convertPrathamToContentFormat([rawData]);
      if (!converted) return;
      const transformedContent = await this.transformService.transformContentData(converted);
      if (newStatus) {
        transformedContent.status = newStatus;
      }
      await this.databaseService.upsertContent(transformedContent);
      this.logger.log(`Successfully upserted content: ${identifier}`);
    }
  }

  private async processSingleCourse(identifier: string): Promise<void> {
    const rawData = await this.externalApiService.fetchSingleItemMetadata(
      identifier,
      'Course',
    );
    if (!rawData) {
      this.logger.warn(`No metadata found for course: ${identifier}`);
      return;
    }

    const [converted] = this.externalApiService.convertPrathamToLegacyFormat([rawData]);
    if (!converted) return;

    const transformedCourse = await this.transformService.transformExternalCourseData(converted);

    const hierarchy = await this.externalApiService.getCourseHierarchy(identifier);
    if (hierarchy) {
      const levels = this.externalApiService.mapCourseLevelsByChannel(hierarchy);
      (transformedCourse as any).level1 = levels.level1 || null;
      (transformedCourse as any).level2 = levels.level2 || null;
      (transformedCourse as any).level3 = levels.level3 || null;
      (transformedCourse as any).level4 = levels.level4 || null;
      (transformedCourse as any).childnodes = hierarchy.children
        ? JSON.stringify(hierarchy.children)
        : (transformedCourse as any).childnodes || null;
    }

    await this.databaseService.upsertCourse(transformedCourse);
    this.logger.log(`Successfully upserted course: ${identifier}`);
  }

  private async processSingleQuestionSet(identifier: string, newStatus?: string): Promise<void> {
    this.logger.log(
      `[QuestionSet] Processing | identifier: ${identifier} | status: ${newStatus ?? 'unknown'}`,
    );

    const isPublish = newStatus === 'Live';
    if (isPublish) {
      await new Promise((resolve) => setTimeout(resolve, 20000));
    }

    const statuses = isPublish ? ['Live'] : ['Retired', 'Unlisted', 'Live'];

    const rawData = await this.externalApiService.fetchSingleItemMetadata(
      identifier,
      undefined,
      statuses,
    );
    if (!rawData) {
      this.logger.warn(`No metadata found for question set: ${identifier}`);
      return;
    }

    const [converted] = this.externalApiService.convertPrathamToQuestionSetFormat([rawData]);
    if (!converted) return;

    const transformedQS = await this.transformService.transformQuestionSetData(converted);

    const qs = await this.externalApiService.getQuestionSetHierarchy(identifier);
    if (qs) {
      const levels = this.externalApiService.mapQuestionSetLevelsByFramework(qs);
      (transformedQS as any).level1 = levels.level1 || null;
      (transformedQS as any).level2 = levels.level2 || null;
      (transformedQS as any).level3 = levels.level3 || null;
      (transformedQS as any).level4 = levels.level4 || null;
      const compact = this.buildCompactQuestionSetChildren(qs);
      (transformedQS as any).childNodes = compact.length > 0
        ? JSON.stringify(compact)
        : (transformedQS as any).childNodes || null;
    }

    // Graph event is authoritative for publish/retire/unlist; search API may omit or lag on status.
    if (newStatus) {
      transformedQS.status = newStatus;
    }

    await this.databaseService.upsertQuestionSet(transformedQS);
    this.logger.log(`Successfully upserted question set: ${identifier}`);
  }

  private async processSingleContent(identifier: string): Promise<void> {
    const rawData = await this.externalApiService.fetchSingleItemMetadata(
      identifier,
      'Content',
    );
    if (!rawData) {
      this.logger.warn(`No metadata found for content: ${identifier}`);
      return;
    }

    const [converted] = this.externalApiService.convertPrathamToContentFormat([rawData]);
    if (!converted) return;

    const transformedContent = await this.transformService.transformContentData(converted);

    await this.databaseService.upsertContent(transformedContent);
    this.logger.log(`Successfully upserted content: ${identifier}`);
  }

  /**
   * Build flat rows for QuestionSet hierarchy (moved from CronJobService)
   */
  private buildCompactQuestionSetChildren(root: any): any[] {
    const ensureString = (v: any): string =>
      v === undefined || v === null ? '' : String(v);
    const ensureIndex = (v: any): number | string =>
      v === undefined || v === null ? '' : v;
    const stripHtml = (s: any): string => {
      const text = ensureString(s);
      return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    };
    const extractQuestionTitle = (node: any, sectionName: string): string => {
      const candidates = [
        node?.editorState?.question,
        node?.editorState?.body,
        node?.body, 
        node?.title,
        node?.metadata?.name,
        node?.name,
      ];
      for (const c of candidates) {
        const cleaned = stripHtml(c);
        if (cleaned && cleaned.length > 0 && cleaned !== sectionName) {
          return cleaned;
        }
      }
      return '';
    };

    const rows: any[] = [];

    type SectionCtx = {
      sectionIndex: number | string;
      sectionId: string;
      sectionName: string;
    } | null;

    const visit = (node: any, ctx: SectionCtx) => {
      if (!node || typeof node !== 'object') return;

      if (node.objectType === 'QuestionSet') {
        const newCtx: SectionCtx = {
          sectionIndex: ensureIndex((node as any).index),
          sectionId: ensureString(node.identifier),
          sectionName: ensureString(node.name),
        };
        if (Array.isArray(node.children)) {
          for (const child of node.children) {
            visit(child, newCtx);
          }
        }
        return;
      }

      if (node.objectType === 'Question') {
        const sectionName = ctx ? ctx.sectionName : '';
        rows.push({
          'section Index Number': ctx ? ctx.sectionIndex : '',
          'Section do_id': ctx ? ctx.sectionId : '',
          'Section name': ctx ? ctx.sectionName : '',
          'Question Index Number': ensureIndex((node as any).index),
          'Question do_id': ensureString(node.identifier),
          'Question Name': extractQuestionTitle(node, sectionName),
          'Question Type': ensureString((node as any).qType),
        });
        return;
      }

      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          visit(child, ctx);
        }
      }
    };

    visit(root, null);
    return rows;
  }
}
