import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export interface AttendanceDay {
  scope?: string;
  remark?: string;
  lateMark?: string;
  latitude?: string;
  longitude?: string;
  attendance?: string;
  absentReason?: string;
  validLocation?: boolean;
}


@Entity({ name: 'AttendanceTracker' })
export class AttendanceTracker {
  @PrimaryGeneratedColumn({ name: 'ATNDID' })
  atndId: number;

  @Column({ name: 'TenantID', type: 'uuid', nullable: false })
  tenantId: string;

  @Column({ name: 'Context', type: 'text', nullable: true })
  context?: string;

  @Column({ name: 'ContextID', type: 'uuid', nullable: true })
  contextId?: string;

  @Column({ name: 'UserID', type: 'uuid', nullable: false })
  userId: string;

  @Column({ name: 'Year', type: 'int4', nullable: false })
  year: number;

  @Column({ name: 'Month', type: 'int4', nullable: false })
  month: number;


  // Day columns 01–31 as JSONB
  @Column({ name: '01', type: 'jsonb', nullable: true })
  day01?: AttendanceDay;

  @Column({ name: '02', type: 'jsonb', nullable: true })
  day02?: AttendanceDay;

  @Column({ name: '03', type: 'jsonb', nullable: true })
  day03?: AttendanceDay;

  @Column({ name: '04', type: 'jsonb', nullable: true })
  day04?: AttendanceDay;

  @Column({ name: '05', type: 'jsonb', nullable: true })
  day05?: AttendanceDay;

  @Column({ name: '06', type: 'jsonb', nullable: true })
  day06?: AttendanceDay;

  @Column({ name: '07', type: 'jsonb', nullable: true })
  day07?: AttendanceDay;

  @Column({ name: '08', type: 'jsonb', nullable: true })
  day08?: AttendanceDay;

  @Column({ name: '09', type: 'jsonb', nullable: true })
  day09?: AttendanceDay;

  @Column({ name: '10', type: 'jsonb', nullable: true })
  day10?: AttendanceDay;

  @Column({ name: '11', type: 'jsonb', nullable: true })
  day11?: AttendanceDay;

  @Column({ name: '12', type: 'jsonb', nullable: true })
  day12?: AttendanceDay;

  @Column({ name: '13', type: 'jsonb', nullable: true })
  day13?: AttendanceDay;

  @Column({ name: '14', type: 'jsonb', nullable: true })
  day14?: AttendanceDay;

  @Column({ name: '15', type: 'jsonb', nullable: true })
  day15?: AttendanceDay;

  @Column({ name: '16', type: 'jsonb', nullable: true })
  day16?: AttendanceDay;

  @Column({ name: '17', type: 'jsonb', nullable: true })
  day17?: AttendanceDay;

  @Column({ name: '18', type: 'jsonb', nullable: true })
  day18?: AttendanceDay;

  @Column({ name: '19', type: 'jsonb', nullable: true })
  day19?: AttendanceDay;

  @Column({ name: '20', type: 'jsonb', nullable: true })
  day20?: AttendanceDay;

  @Column({ name: '21', type: 'jsonb', nullable: true })
  day21?: AttendanceDay;

  @Column({ name: '22', type: 'jsonb', nullable: true })
  day22?: AttendanceDay;

  @Column({ name: '23', type: 'jsonb', nullable: true })
  day23?: AttendanceDay;

  @Column({ name: '24', type: 'jsonb', nullable: true })
  day24?: AttendanceDay;

  @Column({ name: '25', type: 'jsonb', nullable: true })
  day25?: AttendanceDay;

  @Column({ name: '26', type: 'jsonb', nullable: true })
  day26?: AttendanceDay;

  @Column({ name: '27', type: 'jsonb', nullable: true })
  day27?: AttendanceDay;

  @Column({ name: '28', type: 'jsonb', nullable: true })
  day28?: AttendanceDay;

  @Column({ name: '29', type: 'jsonb', nullable: true })
  day29?: AttendanceDay;

  @Column({ name: '30', type: 'jsonb', nullable: true })
  day30?: AttendanceDay;

  @Column({ name: '31', type: 'jsonb', nullable: true })
  day31?: AttendanceDay;
}
