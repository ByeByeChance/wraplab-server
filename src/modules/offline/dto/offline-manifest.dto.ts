import { IsOptional, IsDateString } from 'class-validator';

export class OfflineManifestQueryDto {
  @IsOptional()
  @IsDateString()
  since?: string;
}

export class CachedResourceDto {
  key: string;
  type: 'vehicle' | 'color' | 'case' | 'config';
  url: string;
  version: string;
  ttl_seconds: number;
}

export class OfflineManifestResponseDto {
  resources: CachedResourceDto[];
  generated_at: string;
  is_full: boolean;
}
