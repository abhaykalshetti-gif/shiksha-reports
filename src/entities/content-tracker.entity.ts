import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity({ name: 'ContentTracker' })
export class ContentTracker {
  @PrimaryColumn({ name: 'ContentTrackerID', type: 'uuid' })
  contentTrackerId: string;

  @Column({ name: 'UserID', type: 'uuid', nullable: false })
  userId: string;

  @Column({ name: 'TenantID', type: 'uuid', nullable: false })
  tenantId: string;

  @Column({ name: 'ContentID', type: 'varchar', length: 255, nullable: false })
  contentId: string;

  @Column({ name: 'CourseID', type: 'varchar', length: 255, nullable: true })
  courseId?: string;

  @Column({ name: 'UnitID', type: 'varchar', length: 255, nullable: true })
  unitId?: string;

  @Column({
    name: 'ContentName',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  contentName: string;

  @Column({
    name: 'ContentType',
    type: 'varchar',
    length: 100,
    nullable: false,
  })
  contentType: string;

  @Column({
    name: 'ContentTrackingStatus',
    type: 'varchar',
    length: 50,
    nullable: false,
  })
  contentTrackingStatus: string;

  @Column({ name: 'TimeSpent', type: 'integer', default: 0 })
  timeSpent: number;

  @Column({
    name: 'CreatedAt',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Column({
    name: 'UpdatedAt',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
