import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'CohortMember', schema: 'public' })
export class CohortMember {
  @PrimaryGeneratedColumn('uuid')
  CohortMemberID: string;

  @Column({ type: 'uuid', nullable: false })
  CohortID: string;

  @Column({ type: 'uuid', nullable: false })
  UserID: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  MemberStatus: string;

  @Column({ type: 'uuid', nullable: false })
  AcademicYearID: string;

  @Column({ type: 'varchar', nullable: true })
  Subject: string;

  @Column({ type: 'varchar', nullable: true })
  Fees: string;

  @Column({ type: 'varchar', nullable: true })
  Registration: string;

  @Column({ type: 'varchar', nullable: true })
  Board: string;

  @Column({ type: 'varchar', name: 'Slot', nullable: true })
  Slot: string;
}
