import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { StoreLocation } from './entities/store-location.entity';
import { Store } from '../store/entities/store.entity';

export interface NearbyResult {
  store_id: number;
  store_name: string;
  address: string | null;
  lat: number;
  lng: number;
  distance: number;
}

@Injectable()
export class StoreLocationService {
  constructor(
    @InjectRepository(StoreLocation)
    private readonly locationRepo: Repository<StoreLocation>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
  ) {}

  /**
   * Haversine formula to calculate distance between two coordinates.
   * Returns distance in meters.
   */
  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Calculate bounding box for initial coarse filtering.
   * Uses idx_lat_lng index for performance.
   */
  private bboxBounds(
    lat: number,
    lng: number,
    radiusMeters: number,
  ): { latMin: number; latMax: number; lngMin: number; lngMax: number } {
    const latDelta = (radiusMeters / 111320) * 1.2; // Conservative 20% buffer
    const lngDelta = (radiusMeters / (111320 * Math.cos(this.toRadians(lat)))) * 1.2;

    return {
      latMin: lat - latDelta,
      latMax: lat + latDelta,
      lngMin: lng - lngDelta,
      lngMax: lng + lngDelta,
    };
  }

  async findNearby(lat: number, lng: number, radius: number): Promise<NearbyResult[]> {
    const { latMin, latMax, lngMin, lngMax } = this.bboxBounds(lat, lng, radius);

    // BBOX coarse filter using idx_lat_lng composite index
    const locations = await this.locationRepo.find({
      where: {
        lat: Between(latMin, latMax),
        lng: Between(lngMin, lngMax),
      },
    });

    if (locations.length === 0) {
      return [];
    }

    // Load stores in batch
    const storeIds = locations.map((l) => l.store_id);
    const stores = await this.storeRepo.findBy({ id: In(storeIds) });
    const storeMap = new Map(stores.map((s) => [s.id, s]));

    const results: NearbyResult[] = [];

    for (const loc of locations) {
      const dist = this.haversineDistance(lat, lng, Number(loc.lat), Number(loc.lng));
      if (dist <= radius) {
        const store = storeMap.get(loc.store_id);
        if (store && store.status === 'active') {
          results.push({
            store_id: loc.store_id,
            store_name: store.name,
            address: loc.address,
            lat: Number(loc.lat),
            lng: Number(loc.lng),
            distance: Math.round(dist),
          });
        }
      }
    }

    // Sort by distance ascending
    results.sort((a, b) => a.distance - b.distance);

    return results;
  }

  async findByStoreId(storeId: number): Promise<StoreLocation | null> {
    return this.locationRepo.findOne({ where: { store_id: storeId } });
  }
}
