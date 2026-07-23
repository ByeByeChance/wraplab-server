import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Configuration } from '../../configuration/entities/configuration.entity';

@Entity('favorite')
export class Favorite {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'store_id', type: 'bigint', unsigned: true })
  store_id: number;

  @Column({ name: 'staff_id', type: 'bigint', unsigned: true })
  staff_id: number;

  @Column({ name: 'configuration_id', type: 'bigint', unsigned: true })
  configuration_id: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @ManyToOne(() => Configuration)
  @JoinColumn({ name: 'configuration_id' })
  configuration: Configuration;
}
