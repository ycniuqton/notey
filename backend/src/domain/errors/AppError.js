import { HttpStatus, ErrorCode } from "../constants.js";

// Base application error carrying an HTTP status and a stable machine code.
export class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message) {
    super(message, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Password required or incorrect.") {
    super(message, HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHORIZED);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "Note is too large.") {
    super(message, HttpStatus.PAYLOAD_TOO_LARGE, ErrorCode.PAYLOAD_TOO_LARGE);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many attempts. Please wait and try again.") {
    super(message, HttpStatus.TOO_MANY_REQUESTS, ErrorCode.RATE_LIMITED);
  }
}

export class StorageLimitError extends AppError {
  constructor(message = "Note storage is full.") {
    super(message, HttpStatus.INSUFFICIENT_STORAGE, ErrorCode.STORAGE_FULL);
  }
}
