export class StaffStoreInfoDto {
  store_id: number;
  store_name: string;
  role: 'staff' | 'manager';
  is_current: boolean;
  assigned_at: string;
}
