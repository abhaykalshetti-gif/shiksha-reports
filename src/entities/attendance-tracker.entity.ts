import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

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

  // Day columns 01-31
  @Column({ name: '01', type: 'jsonb', nullable: true })
  day01?: object;

  @Column({ name: '02', type: 'jsonb', nullable: true })
  day02?: object;

  @Column({ name: '03', type: 'jsonb', nullable: true })
  day03?: object;

  @Column({ name: '04', type: 'jsonb', nullable: true })
  day04?: object;

  @Column({ name: '05', type: 'jsonb', nullable: true })
  day05?: object;

  @Column({ name: '06', type: 'jsonb', nullable: true })
  day06?: object;

  @Column({ name: '07', type: 'jsonb', nullable: true })
  day07?: object;

  @Column({ name: '08', type: 'jsonb', nullable: true })
  day08?: object;

  @Column({ name: '09', type: 'jsonb', nullable: true })
  day09?: object;

  @Column({ name: '10', type: 'jsonb', nullable: true })
  day10?: object;

  @Column({ name: '11', type: 'jsonb', nullable: true })
  day11?: object;

  @Column({ name: '12', type: 'jsonb', nullable: true })
  day12?: object;

  @Column({ name: '13', type: 'jsonb', nullable: true })
  day13?: object;

  @Column({ name: '14', type: 'jsonb', nullable: true })
  day14?: object;

  @Column({ name: '15', type: 'jsonb', nullable: true })
  day15?: object;

  @Column({ name: '16', type: 'jsonb', nullable: true })
  day16?: object;

  @Column({ name: '17', type: 'jsonb', nullable: true })
  day17?: object;

  @Column({ name: '18', type: 'jsonb', nullable: true })
  day18?: object;

  @Column({ name: '19', type: 'jsonb', nullable: true })
  day19?: object;

  @Column({ name: '20', type: 'jsonb', nullable: true })
  day20?: object;

  @Column({ name: '21', type: 'jsonb', nullable: true })
  day21?: object;

  @Column({ name: '22', type: 'jsonb', nullable: true })
  day22?: object;

  @Column({ name: '23', type: 'jsonb', nullable: true })
  day23?: object;

  @Column({ name: '24', type: 'jsonb', nullable: true })
  day24?: object;

  @Column({ name: '25', type: 'jsonb', nullable: true })
  day25?: object;

  @Column({ name: '26', type: 'jsonb', nullable: true })
  day26?: object;

  @Column({ name: '27', type: 'jsonb', nullable: true })
  day27?: object;

  @Column({ name: '28', type: 'jsonb', nullable: true })
  day28?: object;

  @Column({ name: '29', type: 'jsonb', nullable: true })
  day29?: object;

  @Column({ name: '30', type: 'jsonb', nullable: true })
  day30?: object;

  @Column({ name: '31', type: 'jsonb', nullable: true })
  day31?: object;
}
