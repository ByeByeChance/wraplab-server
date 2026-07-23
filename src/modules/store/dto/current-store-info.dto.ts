export class CurrentStoreInfoDto {
  id: number;
  name: string;
  address: string;
  business_hours: object | null;
  phone: string;
  is_current: boolean;
}
