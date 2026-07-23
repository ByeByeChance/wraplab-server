import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes';

const ERROR_CODE_TO_HTTP_STATUS: Record<number, HttpStatus> = {
  [ErrorCode.SUCCESS]: HttpStatus.OK,
  [ErrorCode.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.TOKEN_EXPIRED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.TOKEN_INVALID]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.LOGIN_FAILED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.ACCOUNT_DISABLED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [ErrorCode.WECHAT_NOT_BOUND]: HttpStatus.BAD_REQUEST,
  [ErrorCode.WECHAT_LOGIN_FAILED]: HttpStatus.BAD_REQUEST,
  [ErrorCode.WECHAT_ALREADY_BOUND]: HttpStatus.BAD_REQUEST,
  [ErrorCode.VALIDATION_FAILED]: HttpStatus.BAD_REQUEST,
  [ErrorCode.INVALID_PAGINATION]: HttpStatus.BAD_REQUEST,
  [ErrorCode.RESOURCE_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.CONFIGURATION_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.QUOTE_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.STAFF_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.PART_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.CASE_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.GENERATION_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.PHONE_ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [ErrorCode.CONFIGURATION_ALREADY_QUOTED]: HttpStatus.BAD_REQUEST,
  [ErrorCode.STORE_NOT_ACTIVE]: HttpStatus.FORBIDDEN,
  [ErrorCode.SMS_RATE_LIMITED]: HttpStatus.TOO_MANY_REQUESTS,
  [ErrorCode.SMS_CODE_INVALID]: HttpStatus.BAD_REQUEST,
  [ErrorCode.CONFIGURATION_NOT_CONFIRMED]: HttpStatus.BAD_REQUEST,
  [ErrorCode.AI_GENERATION_QUOTA_EXCEEDED]: HttpStatus.TOO_MANY_REQUESTS,
  [ErrorCode.INTERNAL_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCode.DATABASE_ERROR]: HttpStatus.SERVICE_UNAVAILABLE,
  [ErrorCode.OSS_UPLOAD_FAILED]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCode.OSS_UPLOAD_TIMEOUT]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCode.AI_SERVICE_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCode.STORE_LOCATION_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.APPOINTMENT_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.APPOINTMENT_SLOT_UNAVAILABLE]: HttpStatus.CONFLICT,
  [ErrorCode.APPOINTMENT_INVALID_TRANSITION]: HttpStatus.BAD_REQUEST,
  [ErrorCode.APPOINTMENT_STORE_INACTIVE]: HttpStatus.FORBIDDEN,
  [ErrorCode.CAMPAIGN_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.CAMPAIGN_EXPIRED]: HttpStatus.BAD_REQUEST,
  [ErrorCode.CAMPAIGN_MIN_AMOUNT_NOT_MET]: HttpStatus.BAD_REQUEST,
  [ErrorCode.CAMPAIGN_STORE_NOT_INCLUDED]: HttpStatus.FORBIDDEN,
  [ErrorCode.CAMPAIGN_ALREADY_CLAIMED]: HttpStatus.CONFLICT,
  [ErrorCode.CUSTOMER_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.CAMPAIGN_NEW_CUSTOMER_ONLY]: HttpStatus.BAD_REQUEST,
  [ErrorCode.STORE_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.CUSTOMER_IMPORT_INVALID_FORMAT]: HttpStatus.BAD_REQUEST,
  [ErrorCode.CUSTOMER_IMPORT_TOO_LARGE]: HttpStatus.BAD_REQUEST,
  [ErrorCode.CAMPAIGN_ALREADY_ACTIVE]: HttpStatus.BAD_REQUEST,
  [ErrorCode.APPOINTMENT_RATE_LIMITED]: HttpStatus.TOO_MANY_REQUESTS,
  [ErrorCode.DASHBOARD_QUERY_TOO_LONG]: HttpStatus.BAD_REQUEST,
  [ErrorCode.APPOINTMENT_CAPACITY_EXCEEDED]: HttpStatus.SERVICE_UNAVAILABLE,

  // Phase 5 error codes
  [ErrorCode.DUPLICATE_STORE_NAME]: HttpStatus.CONFLICT,
  [ErrorCode.TAG_ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [ErrorCode.STORE_NOT_EXISTS]: HttpStatus.NOT_FOUND,
  [ErrorCode.HEATMAP_DATE_RANGE_TOO_LARGE]: HttpStatus.BAD_REQUEST,
  [ErrorCode.STORE_HAS_ACTIVE_STAFF]: HttpStatus.CONFLICT,
  [ErrorCode.EXPORT_ROW_LIMIT_EXCEEDED]: HttpStatus.BAD_REQUEST,
};

export class BusinessException extends HttpException {
  public readonly code: ErrorCode;
  public readonly details: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    const httpStatus = ERROR_CODE_TO_HTTP_STATUS[code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
    super(
      {
        code,
        message,
        data: details ?? null,
      },
      httpStatus,
    );
    this.code = code;
    this.details = details;
  }
}
