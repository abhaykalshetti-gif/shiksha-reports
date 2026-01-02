// Input validation interfaces for handlers
export interface UserEventData {
  userId: string;
  username?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  mobile?: string;
  dob?: string;
  gender?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  enrollmentId?: string;
  customFields?: CustomField[];
  cohorts?: CohortData[];
  tenantData?: TenantData[];
}

export interface CohortData {
  cohortId: string;
  cohortMemberStatus?: string;
  academicYearId?: string;
  batchId?: string;
  cohortMemberId?: string; // Added to resolve TypeScript error
}

export interface TenantRole {
  roleId: string;
  roleName?: string;
}

export interface TenantData {
  tenantId: string;
  tenantName?: string;
  name?: string;
  roleId?: string;
  roleName?: string;
  roles?: TenantRole[]; // Added for new structure
  templateId?: string;
  contentFramework?: string;
  collectionFramework?: string;
  channelId?: string;
  userTenantMappingId?: string;
  tenantType?: string;
  params?: {
    uiConfig?: {
      showSignIn?: boolean;
      showSignup?: boolean;
      showContent?: string[];
      showProgram?: boolean;
      isDoTracking?: boolean;
      isEditProfile?: boolean;
      isTrackingShow?: boolean;
      isCompleteProfile?: boolean;
    };
  };
}

export interface CustomField {
  label: string;
  selectedValues: (string | { id: string; value?: string })[];
}

export interface EventData {
  eventDetailsData: {
    eventDetailId: string;
    title?: string;
    shortDescription?: string;
    eventType?: string;
    isRestricted?: boolean;
    location?: string;
    longitude?: number;
    latitude?: number;
    onlineProvider?: string;
    maxAttendees?: number;
    recordings?: any;
    status?: string;
    description?: string;
    meetingDetails?: any;
    createdBy?: string;
    updatedBy?: string;
    idealTime?: string;
    metadata?: any;
    attendees?: any;
  };
  eventData: {
    eventId: string;
    isRecurring?: boolean;
    recurrenceEndDate?: string;
    recurrencePattern?: string;
    autoEnroll?: boolean;
    registrationStartDate?: string;
    registrationEndDate?: string;
    createdBy?: string;
    updatedBy?: string;
  };
  eventRepetitionData: EventRepetitionData[];
}

export interface EventRepetitionData {
  eventRepetitionId: string;
  onlineDetails?: any;
  startDateTime?: string;
  endDateTime?: string;
  createdBy?: string;
  updatedBy?: string;
  erMetaData?: any;
}

export interface AttendanceEventData {
  userId: string;
  tenantId: string;
  attendanceDate: string;
  attendance: string;
  context?: string;
  contextId?: string;
  // Additional fields for backward compatibility
  scope: string;
  remark: string;
  lateMark: string;
  latitude: string;
  longitude: string;
  absentReason: string;
  validLocation: boolean;
  attendanceId: string;
  cohortId: string;
  status: string;
  metaData: any;
  metadata: any;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface ContentTrackingData {
  contentTrackingId?: string;
  userId: string;
  tenantId: string;
  contentId: string;
  courseId?: string;
  contentType?: string;
  createdOn?: string;
  updatedOn?: string;
  details?: ContentDetail[];
}

export interface ContentDetail {
  eid: string;
  duration?: number;
}

export interface CourseEnrollmentData {
  userId: string;
  tenantId: string;
  courseId: string;
  status: string;
  usercertificateId?: string;
  createdOn?: string;
  completedOn?: string;
}

export interface CourseStatusUpdateData {
  usercertificateId?: string;
  certificateId?: string;
  userId: string;
  courseId: string;
  tenantId: string;
  status: string;
  issuedOn?: string | null;
  createdOn?: string;
  createdAt?: string;
  updatedOn?: string;
  updatedAt?: string;
  completedOn?: string | null;
  completionPercentage?: number | null;
  lastReadContentId?: string | null;
  lastReadContentStatus?: string | null;
  progress?: number | null;
}
export interface AssessmentTrackingData {
  assessmentTrackingId: string;
  contentId?: string;
  courseId?: string;
  assessmentName?: string;
  userId: string;
  tenantId: string;
  totalMaxScore?: number;
  totalScore?: number;
  timeSpent?: string | number;
  assessmentSummary?: any;
  assessmentType?: string;
  scores?: AssessmentScoreData[];
  attemptId?: string;
}

export interface AssessmentScoreData {
  id: string;
  userId: string;
  assessmentTrackingId: string;
  questionId: string;
  pass?: string; // Changed from boolean to string to match actual usage
  sectionId?: string;
  resValue?: any;
  duration?: string | number;
  score?: string | number;
  maxScore?: string | number;
  queTitle?: string;
}

export interface LastLoginEventData {
  userId: string;
  lastLogin?: string | Date;
}

// Validation error class
export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Validation helper functions
export function validateRequired(value: any, fieldName: string): void {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }
}

export function validateString(
  value: any,
  fieldName: string,
  required = true,
): void {
  if (required) {
    validateRequired(value, fieldName);
  }
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName);
  }
}

export function validateEmail(email: string, fieldName = 'email'): void {
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError(
      `${fieldName} must be a valid email address`,
      fieldName,
    );
  }
}

export function validateDate(date: string, fieldName: string): void {
  if (date && isNaN(Date.parse(date))) {
    throw new ValidationError(`${fieldName} must be a valid date`, fieldName);
  }
}
