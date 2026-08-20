import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity({ name: 'Tenant' })
export class Tenant {
    @PrimaryColumn('uuid', { name: 'TenantID' })
    tenantId: string;

    @Column({ name: 'TenantName', type: 'text' })
    tenantName: string;

    @Column({ name: 'TenantDescription', type: 'text', nullable: true })
    tenantDescription?: string;

    @Column({ name: 'TenantType', type: 'varchar', length: 255, nullable: true })
    tenantType?: string;

    @Column({ name: 'Taxonomy', type: 'varchar', length: 255, nullable: true })
    taxonomy?: string;

    @Column({
        name: 'CreatedAt',
        type: 'timestamptz',
        default: () => 'now()',
    })
    createdAt: Date;

    @Column({
        name: 'UpdatedAt',
        type: 'timestamptz',
        default: () => 'now()',
    })
    updatedAt: Date;

    @Column({ name: 'PassingCriteria', type: 'varchar', length: 255, nullable: true })
    passingCriteria?: string;

    @Column({ name: 'ParentID', type: 'uuid', nullable: true })
    parentId: string | null;
}

