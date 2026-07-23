/** 全车默认面积（m2），Phase 2 可改为车型级配置，同时可通过环境变量 DEFAULT_FULL_CAR_AREA_M2 覆盖 */
export const DEFAULT_FULL_CAR_AREA_M2 = parseInt(process.env.DEFAULT_FULL_CAR_AREA_M2 || '15', 10);
